import "server-only";

import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

import { isPublicAddress } from "./ip";

/** Why a page couldn't be fetched, in terms the action turns into copy. */
export type FetchProblem = "invalid_url" | "blocked" | "unreachable" | "too_large" | "wrong_type";

export class ImportFetchError extends Error {
  constructor(readonly problem: FetchProblem) {
    super(problem);
  }
}

const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

/** What a request accepts: the Accept header, which content types are kept, and a size cap. */
type Want = { accept: string; type: RegExp; maxBytes: number };

const PAGE: Want = {
  accept: "text/html,application/xhtml+xml",
  type: /text\/html|application\/xhtml\+xml/i,
  maxBytes: 3 * 1024 * 1024,
};

/**
 * A link someone pasted, checked before anything is sent: http(s) only, the
 * standard ports, no credentials, and an IP literal must be public.
 */
export function checkUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportFetchError("invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ImportFetchError("invalid_url");
  if (url.username || url.password) throw new ImportFetchError("invalid_url");
  if (url.port && url.port !== "80" && url.port !== "443") throw new ImportFetchError("blocked");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new ImportFetchError("blocked");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new ImportFetchError("blocked");
  }
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * DNS for the importer: every address a name resolves to must be public, and
 * the connection is made to one of those checked addresses, so a name that
 * re-resolves to an internal one (DNS rebinding) can't slip through.
 */
export function guardedLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses as LookupAddress[];
    if (list.length === 0 || !list.every((a) => isPublicAddress(a.address))) {
      return callback(new ImportFetchError("blocked") as NodeJS.ErrnoException, []);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
}

function decode(response: IncomingMessage): NodeJS.ReadableStream {
  const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
  if (encoding === "gzip") return response.pipe(createGunzip());
  if (encoding === "deflate") return response.pipe(createInflate());
  if (encoding === "br") return response.pipe(createBrotliDecompress());
  return response;
}

function requestOnce(url: URL, want: Want): Promise<{ redirect: string | null; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(
      url,
      {
        lookup: guardedLookup,
        timeout: TIMEOUT_MS,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; CookyRecipeImporter/1.0)",
          accept: want.accept,
          "accept-encoding": "gzip, deflate, br",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          return resolve({ redirect: response.headers.location, body: Buffer.alloc(0) });
        }
        if (status < 200 || status >= 300) {
          response.resume();
          return reject(new ImportFetchError("unreachable"));
        }
        const type = String(response.headers["content-type"] ?? "");
        if (!want.type.test(type)) {
          response.resume();
          return reject(new ImportFetchError("wrong_type"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        const body = decode(response);
        body.on("data", (chunk: Buffer) => {
          size += chunk.length;
          // Counted after decompression, so a small gzip bomb can't fill memory.
          if (size > want.maxBytes) {
            request.destroy();
            reject(new ImportFetchError("too_large"));
            return;
          }
          chunks.push(chunk);
        });
        body.on("end", () => resolve({ redirect: null, body: Buffer.concat(chunks) }));
        body.on("error", () => reject(new ImportFetchError("unreachable")));
      },
    );
    request.on("timeout", () => request.destroy(new ImportFetchError("unreachable")));
    request.on("error", (err) => reject(err instanceof ImportFetchError ? err : new ImportFetchError("unreachable")));
  });
}

/** Every outbound request from user input goes through here (AGENT_RULES §4). Each redirect hop is checked again. */
async function guardedGet(raw: string, want: Want): Promise<{ url: URL; body: Buffer }> {
  let url = checkUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { redirect, body } = await requestOnce(url, want);
    if (!redirect) return { url, body };
    url = checkUrl(new URL(redirect, url));
  }
  throw new ImportFetchError("unreachable");
}

/** A recipe page from a link someone pasted. Returns the final URL and HTML. */
export async function fetchPage(raw: string): Promise<{ url: URL; html: string }> {
  const { url, body } = await guardedGet(raw, PAGE);
  return { url, html: body.toString("utf8") };
}

/** An imported recipe's photo, through the same guard. The caller still checks the bytes. */
export async function fetchImage(raw: string, maxBytes: number): Promise<Uint8Array> {
  const { body } = await guardedGet(raw, {
    accept: "image/avif,image/webp,image/png,image/jpeg",
    type: /^image\//i,
    maxBytes,
  });
  return new Uint8Array(body);
}
