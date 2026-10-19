import { http, HttpResponse } from "msw";

/** Matches tests/integration/setup/env.ts. */
const ACCOUNT = "0123456789abcdef0123456789abcdef";
const BUCKET = "cooky-test";
const BASE = `https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}`;

/**
 * A tiny R2 bucket in memory: the S3 calls Cooky makes (put, copy, get,
 * list by prefix, batch delete). Photo reads go through signed URLs, which are
 * only built, never fetched, on the server.
 */
export const fakeR2 = {
  objects: new Map<string, { body: Uint8Array; contentType: string | null }>(),
  failPuts: false,
  reset() {
    this.objects.clear();
    this.failPuts = false;
  },
};

export const r2Handlers = [
  http.put(`${BASE}/*`, async ({ request }) => {
    if (fakeR2.failPuts) return new HttpResponse(null, { status: 503 });
    const key = decodeURIComponent(new URL(request.url).pathname.slice(`/${BUCKET}/`.length));
    const copySource = request.headers.get("x-amz-copy-source");
    if (copySource) {
      const from = fakeR2.objects.get(decodeURIComponent(copySource).replace(/^\/?[^/]+\//, ""));
      if (!from) return new HttpResponse(null, { status: 404 });
      fakeR2.objects.set(key, from);
      return new HttpResponse(
        '<?xml version="1.0" encoding="UTF-8"?><CopyObjectResult><ETag>"etag"</ETag></CopyObjectResult>',
        { headers: { "content-type": "application/xml" } },
      );
    }
    fakeR2.objects.set(key, {
      body: new Uint8Array(await request.arrayBuffer()),
      contentType: request.headers.get("content-type"),
    });
    return new HttpResponse(null, { status: 200, headers: { ETag: '"etag"' } });
  }),
  // ListObjectsV2 by prefix (the account purge) arrives as GET /bucket/?list-type=2; anything else is a read.
  http.get(`${BASE}*`, ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.has("list-type")) {
      const prefix = url.searchParams.get("prefix") ?? "";
      const keys = [...fakeR2.objects.keys()].filter((k) => k.startsWith(prefix));
      const contents = keys.map((k) => `<Contents><Key>${k}</Key><Size>1</Size></Contents>`).join("");
      return new HttpResponse(
        `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>${BUCKET}</Name><Prefix>${prefix}</Prefix><KeyCount>${keys.length}</KeyCount><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`,
        { headers: { "content-type": "application/xml" } },
      );
    }
    const key = decodeURIComponent(url.pathname.slice(`/${BUCKET}/`.length));
    const object = fakeR2.objects.get(key);
    return object
      ? new HttpResponse(object.body, { headers: { "content-type": object.contentType ?? "application/octet-stream" } })
      : new HttpResponse(null, { status: 404 });
  }),
  http.post(BASE, async ({ request }) => {
    const xml = await request.text();
    for (const [, key] of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) fakeR2.objects.delete(key!);
    return new HttpResponse('<?xml version="1.0" encoding="UTF-8"?><DeleteResult></DeleteResult>', {
      headers: { "content-type": "application/xml" },
    });
  }),
];
