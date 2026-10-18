import { describe, expect, it } from "vitest";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

import { ACTION_ERROR_CODES, errorMessageKey, isActionErrorCode } from "./errors";

describe("action error codes", () => {
  it("match the contract in docs/ARCHITECTURE.md §5.1", () => {
    expect([...ACTION_ERROR_CODES].sort()).toEqual(
      [
        "unauthorized",
        "forbidden",
        "not_found",
        "invalid",
        "rate_limited",
        "quota_exceeded",
        "plan_required",
        "conflict",
        "unavailable",
      ].sort(),
    );
  });

  it.each([
    ["en", en],
    ["fr", fr],
    ["ar", ar],
  ] as const)("each has a translated message in %s", (_locale, catalog) => {
    for (const code of ACTION_ERROR_CODES) {
      expect(errorMessageKey(code)).toBe(`errors.${code}`);
      expect(catalog.errors[code], code).toEqual(expect.any(String));
      expect(catalog.errors[code].length, code).toBeGreaterThan(0);
    }
  });

  it("recognises only known codes", () => {
    expect(isActionErrorCode("forbidden")).toBe(true);
    expect(isActionErrorCode("Forbidden")).toBe(false);
    expect(isActionErrorCode("Error: connection refused")).toBe(false);
    expect(isActionErrorCode(undefined)).toBe(false);
  });
});
