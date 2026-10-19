import "server-only";

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/server/env";

/** ARCHITECTURE §5.10: read links last 10 minutes. */
const SIGNED_URL_SECONDS = 600;

type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

function config(): R2Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
  };
}

/** False until all four R2 variables are set; photo features then explain they're off. */
export function storageConfigured(): boolean {
  return config() !== null;
}

let cached: { client: S3Client; bucket: string } | null = null;

function bucket(): { client: S3Client; bucket: string } {
  if (cached) return cached;
  const c = config();
  if (!c) throw new Error("R2 is not configured");
  cached = {
    bucket: c.bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
      // Path-style keeps every URL on the one host the CSP allows.
      forcePathStyle: true,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    }),
  };
  return cached;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { client, bucket: name } = bucket();
  await client.send(
    new PutObjectCommand({
      Bucket: name,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "private, max-age=600",
    }),
  );
}

/** Server-side copy within the bucket (no download), e.g. a friend's dish photo into the copier's prefix. */
export async function copyObject(fromKey: string, toKey: string): Promise<void> {
  const { client, bucket: name } = bucket();
  await client.send(new CopyObjectCommand({ Bucket: name, CopySource: `${name}/${encodeURI(fromKey)}`, Key: toKey }));
}

/** Every key under a prefix, e.g. `u/{userId}/` for an account purge. */
export async function listKeys(prefix: string): Promise<string[]> {
  const { client, bucket: name } = bucket();
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: name, Prefix: prefix, ContinuationToken: token }),
    );
    for (const item of page.Contents ?? []) if (item.Key) keys.push(item.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Streams a stored object through the server (data exports never leave via a third-party URL). */
export async function readObject(key: string): Promise<ReadableStream | null> {
  const { client, bucket: name } = bucket();
  const { Body } = await client.send(new GetObjectCommand({ Bucket: name, Key: key }));
  return Body ? Body.transformToWebStream() : null;
}

/** A short-lived read link. Only call after the policy allowed the viewer. */
export async function signedUrl(key: string): Promise<string> {
  const { client, bucket: name } = bucket();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: name, Key: key }), { expiresIn: SIGNED_URL_SECONDS });
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const { client, bucket: name } = bucket();
  for (let i = 0; i < keys.length; i += 1000) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: name,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}
