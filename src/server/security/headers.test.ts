import { describe, expect, it } from "vitest";

import { buildCsp, staticSecurityHeaders } from "./headers";

function directive(csp: string, name: string): string[] {
  const entry = csp.split("; ").find((d) => d.startsWith(`${name} `));
  return entry ? entry.split(" ").slice(1) : [];
}

describe("buildCsp", () => {
  const prod = buildCsp({ nonce: "abc123", isDev: false });

  it("locks scripts to the request nonce", () => {
    expect(directive(prod, "script-src")).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
  });

  it("never allows eval or inline scripts in production", () => {
    expect(prod).not.toContain("unsafe-eval");
    expect(directive(prod, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("allows eval only in development, for React's error overlay", () => {
    expect(directive(buildCsp({ nonce: "n", isDev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  it("lets the browser talk only to Cooky itself by default", () => {
    expect(directive(prod, "connect-src")).toEqual(["'self'"]);
  });

  it("adds only the configured Pusher cluster's socket hosts", () => {
    const csp = buildCsp({ nonce: "n", isDev: false, pusherCluster: "eu" });
    expect(directive(csp, "connect-src")).toEqual(["'self'", "wss://ws-eu.pusher.com", "https://sockjs-eu.pusher.com"]);
  });

  it("forbids framing, plugins and foreign form targets", () => {
    expect(directive(prod, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(prod, "object-src")).toEqual(["'none'"]);
    expect(directive(prod, "form-action")).toEqual(["'self'"]);
    expect(directive(prod, "base-uri")).toEqual(["'self'"]);
  });

  it("accepts extra image hosts for signed upload URLs", () => {
    const csp = buildCsp({ nonce: "n", isDev: false, imageHosts: ["https://bucket.r2.example"] });
    expect(directive(csp, "img-src")).toContain("https://bucket.r2.example");
  });
});

describe("staticSecurityHeaders", () => {
  const headers = new Map(staticSecurityHeaders().map(({ key, value }) => [key, value]));

  it("enables HSTS for two years with preload", () => {
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload");
  });

  it("blocks MIME sniffing and framing", () => {
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("keeps the camera off and the microphone first-party only", () => {
    const policy = headers.get("Permissions-Policy") ?? "";
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=(self)");
  });
});
