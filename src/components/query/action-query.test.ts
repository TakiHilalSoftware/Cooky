import { describe, expect, it } from "vitest";

import { ActionError, errorCode, shouldRetryQuery, unwrap } from "./action-query";

describe("unwrap", () => {
  it("returns the data, falsy values included", () => {
    expect(unwrap({ data: { ok: true } })).toEqual({ ok: true });
    expect(unwrap({ data: 0 })).toBe(0);
    expect(unwrap({ data: null })).toBeNull();
  });

  it("throws the typed code, and only the code", () => {
    const error = (() => {
      try {
        unwrap({ serverError: "conflict" });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ActionError);
    expect(errorCode(error)).toBe("conflict");
  });

  it("reads schema failures as invalid, and anything else (unknown text, nothing at all) as unavailable", () => {
    expect(() => unwrap({ validationErrors: { name: ["x"] } })).toThrow(new ActionError("invalid"));
    expect(() => unwrap({ serverError: "Error: connect ECONNREFUSED 10.0.0.1" })).toThrow(
      new ActionError("unavailable"),
    );
    expect(() => unwrap(undefined)).toThrow(new ActionError("unavailable"));
  });
});

describe("errorCode", () => {
  it("never passes a raw message through", () => {
    expect(errorCode(new TypeError("Failed to fetch"))).toBe("unavailable");
    expect(errorCode("boom")).toBe("unavailable");
  });
});

describe("shouldRetryQuery", () => {
  it("retries dropped connections and outages twice", () => {
    expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetryQuery(1, new ActionError("unavailable"))).toBe(true);
    expect(shouldRetryQuery(2, new ActionError("unavailable"))).toBe(false);
  });

  it("never retries a final answer", () => {
    for (const code of ["unauthorized", "forbidden", "not_found", "invalid", "rate_limited", "conflict"] as const)
      expect(shouldRetryQuery(0, new ActionError(code))).toBe(false);
  });
});
