import { describe, expect, it } from "vitest";

import {
  backupCodeSignInSchema,
  totpCodeSchema,
  webAuthnAuthenticationSchema,
  webAuthnRegistrationSchema,
} from "./schema";

describe("totpCodeSchema", () => {
  it.each(["123456", "123 456", " 123456 "])("accepts %j as 123456", (code) => {
    expect(totpCodeSchema.parse({ code }).code).toBe("123456");
  });

  it.each(["12345", "1234567", "12a456", ""])("rejects %j", (code) => {
    expect(totpCodeSchema.safeParse({ code }).success).toBe(false);
  });
});

describe("backupCodeSignInSchema", () => {
  it("accepts a code as Better Auth issues it, and rejects anything else", () => {
    expect(backupCodeSignInSchema.safeParse({ code: "a1B2c-3D4e5", locale: "en" }).success).toBe(true);
    expect(backupCodeSignInSchema.safeParse({ code: "<script>", locale: "en" }).success).toBe(false);
  });
});

const assertion = {
  id: "Y3JlZA",
  rawId: "Y3JlZA",
  type: "public-key",
  response: { clientDataJSON: "eyJ0", authenticatorData: "SZYN", signature: "MEUC" },
  clientExtensionResults: {},
};

describe("WebAuthn schemas", () => {
  it("accept a well-formed passkey assertion", () => {
    expect(webAuthnAuthenticationSchema.safeParse(assertion).success).toBe(true);
  });

  it("reject non-base64url data and the wrong credential type", () => {
    expect(webAuthnAuthenticationSchema.safeParse({ ...assertion, id: "not base64!" }).success).toBe(false);
    expect(webAuthnAuthenticationSchema.safeParse({ ...assertion, type: "password" }).success).toBe(false);
  });

  it("keep only the transports WebAuthn defines", () => {
    const parsed = webAuthnRegistrationSchema.parse({
      ...assertion,
      response: { clientDataJSON: "eyJ0", attestationObject: "o2Nm", transports: ["internal", "hybrid", "teleport"] },
    });
    expect(parsed.response.transports).toEqual(["internal", "hybrid"]);
  });
});
