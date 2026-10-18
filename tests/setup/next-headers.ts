import { HeadersAdapter } from "next/dist/server/web/spec-extension/adapters/headers";

/**
 * What `await headers()` really returns in Next 16: a sealed HeadersAdapter
 * built from Node's plain header object (see next/dist/server/async-storage/
 * request-store.js). It's a Headers subclass that also carries its own
 * `.headers` property, so code that duck-types on `.headers` breaks on it.
 * Mock `next/headers` with this, never with a native `new Headers()`.
 */
export function nextHeaders(init: Record<string, string> = {}): Headers {
  const plain = Object.fromEntries(Object.entries(init).map(([key, value]) => [key.toLowerCase(), value]));
  return HeadersAdapter.seal(HeadersAdapter.from(plain));
}
