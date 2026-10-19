import { describe, expect, it, vi } from "vitest";

const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns", () => ({ lookup: dns.lookup }));

const { checkUrl, guardedLookup, ImportFetchError } = await import("./fetch");

const problem = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return err instanceof ImportFetchError ? err.problem : "other";
  }
  return null;
};

describe("checkUrl", () => {
  it("accepts ordinary http(s) recipe links", () => {
    expect(checkUrl("https://www.example.com/recipes/harira?x=1").hostname).toBe("www.example.com");
    expect(checkUrl("http://example.com:80/a").port).toBe("");
  });

  it.each([
    ["not a url", "invalid_url"],
    ["ftp://example.com/file", "invalid_url"],
    ["file:///etc/passwd", "invalid_url"],
    ["javascript:alert(1)", "invalid_url"],
    ["https://user:pass@example.com/", "invalid_url"],
    ["https://example.com:8080/", "blocked"],
    ["http://127.0.0.1/", "blocked"],
    ["http://169.254.169.254/latest/meta-data", "blocked"],
    ["http://[::1]/", "blocked"],
    ["http://localhost/", "blocked"],
    ["http://db.internal/", "blocked"],
    ["http://printer.local/", "blocked"],
  ])("refuses %s (%s)", (url, expected) => {
    expect(problem(() => checkUrl(url))).toBe(expected);
  });
});

describe("guardedLookup", () => {
  const run = (addresses: { address: string; family: number }[], all = false) =>
    new Promise<{ err: unknown; address: unknown }>((resolve) => {
      dns.lookup.mockImplementation((_host, _opts, cb) => cb(null, addresses));
      guardedLookup("example.com", { all }, (err, address) => resolve({ err, address }));
    });

  it("connects to the checked public address", async () => {
    expect(await run([{ address: "93.184.216.34", family: 4 }])).toEqual({ err: null, address: "93.184.216.34" });
  });

  it("refuses a name that resolves to an internal address (DNS rebinding), even among public ones", async () => {
    const { err } = await run([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    expect(err).toBeInstanceOf(ImportFetchError);
  });

  it("returns every checked address when asked for all", async () => {
    const list = [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1::1", family: 6 },
    ];
    expect((await run(list, true)).address).toEqual(list);
  });
});
