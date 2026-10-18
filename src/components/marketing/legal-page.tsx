import { useTranslations } from "next-intl";

import { LEGAL_VERSIONS } from "@config/legal";

const POINTS = {
  terms: [
    "terms.points.account",
    "terms.points.content",
    "terms.points.fairUse",
    "terms.points.plans",
    "terms.points.changes",
  ],
  privacy: [
    "privacy.points.collect",
    "privacy.points.never",
    "privacy.points.processors",
    "privacy.points.rights",
    "privacy.points.cookies",
  ],
} as const;

/** Plain-language summary of a legal document, versioned like the consent record. */
export function LegalPage({ document }: { document: "terms" | "privacy" }) {
  const t = useTranslations("legal");
  return (
    <article className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-2">
        <h1 className="font-heading text-4xl">{t(`${document}.title`)}</h1>
        <p className="text-sm text-muted-foreground">{t("version", { version: LEGAL_VERSIONS[document] })}</p>
      </header>
      <p className="rounded-2xl border border-border bg-muted p-4 text-sm text-pretty">{t("draftNotice")}</p>
      <ul className="space-y-4">
        {POINTS[document].map((point) => (
          <li key={point} className="flex gap-3 text-pretty">
            <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary-strong" />
            <span>{t(point)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
