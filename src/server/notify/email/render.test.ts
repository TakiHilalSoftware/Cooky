import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";

import { EMAIL_TEMPLATES, renderEmail } from "./render";

const URL_WITH_TOKEN = "https://cooky.example/api/auth/verify-email?token=abc123&callbackURL=%2Fen";

describe("renderEmail", () => {
  for (const template of EMAIL_TEMPLATES) {
    for (const locale of routing.locales) {
      it(`renders ${template} in ${locale}`, async () => {
        const email = await renderEmail(template, locale, { name: "Lina", url: URL_WITH_TOKEN });
        expect(email.subject.length).toBeGreaterThan(5);
        expect(email.html).toContain(`lang="${locale}"`);
        expect(email.html).toContain(locale === "ar" ? 'dir="rtl"' : 'dir="ltr"');
        // The link is clickable and also printed for clients that block buttons.
        expect(email.html).toContain("token=abc123");
        expect(email.text).toContain("token=abc123");
        expect(email.text).toContain("Lina");
        // No untranslated message keys leaked into the email.
        expect(email.text).not.toMatch(/emails\.|verifyEmail\.|resetPassword\./);
      });
    }
  }
});
