import { describe, expect, it } from "vitest";

import en from "../../../../messages/en.json";

import { checkFields } from "@/lib/forms";

import { safeNextPath, signInSchema, signUpSchema, VALIDATION_KEYS } from "./schema";

const valid = {
  name: "Amina",
  email: "Amina@Example.com ",
  password: "correct horse",
  acceptTerms: true,
  locale: "fr",
};

describe("signUpSchema", () => {
  it("normalises the email and keeps the rest", () => {
    const result = signUpSchema.parse(valid);
    expect(result.email).toBe("amina@example.com");
    expect(result.locale).toBe("fr");
  });

  it.each([
    ["name", { name: "   " }, "nameRequired"],
    ["name", { name: "x".repeat(61) }, "nameTooLong"],
    ["email", { email: "not-an-email" }, "emailInvalid"],
    ["password", { password: "short" }, "passwordTooShort"],
    ["password", { password: "x".repeat(129) }, "passwordTooLong"],
    ["acceptTerms", { acceptTerms: false }, "acceptTermsRequired"],
  ])("reports %s problems with a translatable key", (field, override, key) => {
    const result = checkFields(signUpSchema, { ...valid, ...override });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[field]).toBe(key);
  });

  it("rejects an unsupported locale", () => {
    expect(signUpSchema.safeParse({ ...valid, locale: "de" }).success).toBe(false);
  });
});

describe("validation keys", () => {
  it("match the validation copy in the catalogs exactly", () => {
    expect([...VALIDATION_KEYS].sort()).toEqual(Object.keys(en.validation).sort());
  });
});

describe("safeNextPath (open-redirect guard)", () => {
  it.each(["/settings", "/settings/security", "/settings?tab=devices", "/dishes/42"])(
    "keeps internal path %s",
    (path) => {
      expect(safeNextPath.parse(path)).toBe(path);
    },
  );

  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "settings", "/a b"])(
    "drops unsafe value %s",
    (path) => {
      expect(safeNextPath.parse(path)).toBeUndefined();
    },
  );

  it("drops a bad `next` without failing the whole login", () => {
    const parsed = signInSchema.parse({ email: "a@b.co", password: "pw", next: "//evil.example", locale: "en" });
    expect(parsed.next).toBeUndefined();
  });
});
