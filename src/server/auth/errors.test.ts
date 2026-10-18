import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

import { authErrorCode } from "./errors";

describe("authErrorCode", () => {
  it("returns Better Auth's specific code", () => {
    expect(authErrorCode(new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD" }))).toBe(
      "INVALID_EMAIL_OR_PASSWORD",
    );
  });

  it("keeps a specific code even on a 429 (a lockout is not a generic rate limit)", () => {
    expect(authErrorCode(new APIError("TOO_MANY_REQUESTS", { code: "ACCOUNT_LOCKED" }))).toBe("ACCOUNT_LOCKED");
  });

  it("reports a code-less 429 as RATE_LIMITED", () => {
    expect(authErrorCode(new APIError("TOO_MANY_REQUESTS"))).toBe("RATE_LIMITED");
  });

  it("falls back to the HTTP status for bare errors (e.g. someone else's passkey)", () => {
    expect(authErrorCode(new APIError("UNAUTHORIZED"))).toBe("UNAUTHORIZED");
  });

  it("ignores anything that isn't a Better Auth error", () => {
    expect(authErrorCode(new Error("boom"))).toBeNull();
    expect(authErrorCode("nope")).toBeNull();
  });
});
