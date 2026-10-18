import { vi } from "vitest";

import { nextHeaders } from "../../setup/next-headers";

/**
 * A fake browser for Server Actions: one cookie jar plus request headers.
 * `next/headers` is mocked to read from it, so actions run exactly as in a
 * request (Better Auth's nextCookies plugin writes cookies into the jar).
 */
export const browser = {
  cookies: new Map<string, string>(),
  headers: new Map<string, string>([
    ["x-forwarded-for", "203.0.113.10"],
    ["user-agent", "Cooky integration test"],
  ]),
  /** Set while simulating one request: headers() keeps this cookie header (see freeze()). */
  frozenCookieHeader: null as string | null,
  reset() {
    this.cookies.clear();
    this.frozenCookieHeader = null;
  },
  /**
   * Models Next inside a Server Action: headers() keeps the Cookie header the
   * request arrived with, while cookies() reflects cookies set during it.
   */
  freeze() {
    this.frozenCookieHeader = this.cookieHeader();
  },
  thaw() {
    this.frozenCookieHeader = null;
  },
  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  },
  /** Plain Web Headers, for Requests sent to route handlers. */
  requestHeaders() {
    const h = new Headers([...this.headers]);
    const cookie = this.cookieHeader();
    if (cookie) h.set("cookie", cookie);
    return h;
  },
  /** Exactly what Next 16 hands to Server Actions from `await headers()`. */
  nextRequestHeaders() {
    const cookie = this.frozenCookieHeader ?? this.cookieHeader();
    return nextHeaders({ ...Object.fromEntries(this.headers), ...(cookie ? { cookie } : {}) });
  },
  /** Stores Set-Cookie headers from a route-handler response, like a browser would. */
  absorb(response: Response) {
    for (const line of response.headers.getSetCookie()) {
      const [pair = "", ...attributes] = line.split(";");
      const [name = "", ...rest] = pair.split("=");
      const value = rest.join("=");
      const expired = attributes.some((a) => /max-age=0|expires=thu, 01 jan 1970/i.test(a.trim()));
      if (expired || value === "") this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value);
    }
  },
};

function nextHeadersModule() {
  return {
    headers: async () => browser.nextRequestHeaders(),
    cookies: async () => ({
      get: (name: string) => (browser.cookies.has(name) ? { name, value: browser.cookies.get(name) } : undefined),
      getAll: () => [...browser.cookies].map(([name, value]) => ({ name, value })),
      has: (name: string) => browser.cookies.has(name),
      set: (name: string, value: string, options?: { maxAge?: number }) => {
        if (value === "" || options?.maxAge === 0) browser.cookies.delete(name);
        else browser.cookies.set(name, value);
      },
      delete: (name: string) => browser.cookies.delete(name),
      toString: () => browser.cookieHeader(),
    }),
  };
}

// Better Auth's nextCookies plugin imports "next/headers.js" (with the
// extension), a different module id from the app's "next/headers".
vi.mock("next/headers", nextHeadersModule);
vi.mock("next/headers.js", nextHeadersModule);

// revalidatePath/revalidateTag need Next's per-request cache store, which only
// exists inside a real request. Here they're spies, so tests can assert on them.
export const revalidation = { path: vi.fn(), tag: vi.fn() };
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  revalidatePath: revalidation.path,
  revalidateTag: revalidation.tag,
}));
