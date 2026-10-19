import "server-only";

import { render } from "@react-email/components";
import { createTranslator } from "next-intl";

import { directionOf, type AppLocale } from "@/i18n/routing";

import ar from "../../../../messages/ar.json";
import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

import { ActionEmail } from "./action-email";

const CATALOGS = { en, fr, ar } as const;

export const EMAIL_TEMPLATES = [
  "verifyEmail",
  "resetPassword",
  "passwordChanged",
  "trialEnding",
  "paymentFailed",
  "cancellationConfirmed",
  "receipt",
  "dataExportReady",
  "accountDeletionScheduled",
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export type RenderedEmail = { subject: string; html: string; text: string };

/** Renders a transactional email in the recipient's language (AGENT_RULES §5). */
export async function renderEmail(
  template: EmailTemplate,
  locale: AppLocale,
  data: { name: string; url: string },
): Promise<RenderedEmail> {
  const t = createTranslator({ locale, messages: CATALOGS[locale], namespace: "emails" });
  const copy = {
    preview: t(`${template}.preview`),
    heading: t(`${template}.heading`),
    greeting: t("greeting", { name: data.name }),
    body: t(`${template}.body`),
    button: t(`${template}.button`),
    expiry: t(`${template}.expiry`),
    ignore: t(`${template}.ignore`),
    linkFallback: t("linkFallback"),
    footer: t("footer"),
  };
  const element = ActionEmail({ copy, url: data.url, lang: locale, dir: directionOf(locale) });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: t(`${template}.subject`), html, text };
}
