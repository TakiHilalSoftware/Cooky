import { vi } from "vitest";

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
  reset() {
    this.cookies.clear();
  },
  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  },
  requestHeaders() {
    const h = new Headers([...this.headers]);
    const cookie = this.cookieHeader();
    if (cookie) h.set("cookie", cookie);
    return h;
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

vi.mock("next/headers", () => ({
  headers: async () => browser.requestHeaders(),
  cookies: async () => ({
    get: (name: string) => (browser.cookies.has(name) ? { name, value: browser.cookies.get(name) } : undefined),
    getAll: () => [...browser.cookies].map(([name, value]) => ({ name, value })),
    has: (name: string) => browser.cookies.has(name),
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      if (value === "" || options?.maxAge === 0) browser.cookies.delete(name);
      else browser.cookies.set(name, value);
    },
    delete: (name: string) => browser.cookies.delete(name),
  }),
}));
