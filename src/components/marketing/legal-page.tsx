import { useMessages, useTranslations } from "next-intl";

import { LEGAL_VERSIONS, OPERATOR, PROCESSORS } from "@config/legal";
import { Link } from "@/i18n/navigation";

export type LegalDocument = "terms" | "privacy" | "refunds" | "imprint";

/** Sections that end with how to reach the operator. */
const WITH_CONTACT = new Set(["who", "rights", "request", "contact"]);

/**
 * A legal document in plain language (PRD §3.0 footer, release gate "Legal").
 * Terms and privacy carry the version recorded when someone signs up.
 */
export function LegalPage({ document }: { document: LegalDocument }) {
  const t = useTranslations("legal");
  const version = document === "terms" || document === "privacy" ? LEGAL_VERSIONS[document] : null;
  // The copy is data: a document's sections, in reading order, as written in the catalog.
  const sections: [string, { title: string; body?: string }][] = Object.entries(useMessages().legal[document].sections);
  const contact = OPERATOR.email ? t("contactEmail", { email: OPERATOR.email }) : t("contactInApp");
  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-3">
        <h1 className="font-heading text-4xl text-balance">{t(`${document}.title`)}</h1>
        {version ? <p className="text-sm text-muted-foreground">{t("version", { version })}</p> : null}
        <p className="text-pretty text-muted-foreground">{t(`${document}.intro`)}</p>
      </header>
      <nav aria-label={t("contents")} className="rounded-2xl border border-border bg-muted/50 p-4">
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {sections.map(([key, section]) => (
            <li key={key}>
              <a href={`#${key}`} className="inline-flex min-h-9 items-center underline-offset-4 hover:underline">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map(([key, section]) => (
        <section key={key} id={key} aria-labelledby={`${key}-heading`} className="scroll-mt-24 space-y-3">
          <h2 id={`${key}-heading`} className="font-heading text-2xl">
            {section.title}
          </h2>
          {key === "operator" ? <Operator /> : null}
          {(section.body ?? "")
            .split("\n\n")
            .filter(Boolean)
            .map((paragraph, i) => (
              <p key={i} className="text-pretty">
                {paragraph}
              </p>
            ))}
          {WITH_CONTACT.has(key) ? <p className="text-pretty">{contact}</p> : null}
          {key === "processors" ? <ProcessorTable /> : null}
        </section>
      ))}
      <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
        {t.rich("related", {
          terms: (chunks) => <LegalLink href="/terms">{chunks}</LegalLink>,
          privacy: (chunks) => <LegalLink href="/privacy">{chunks}</LegalLink>,
          refunds: (chunks) => <LegalLink href="/refunds">{chunks}</LegalLink>,
          imprint: (chunks) => <LegalLink href="/imprint">{chunks}</LegalLink>,
        })}
      </footer>
    </article>
  );
}

function LegalLink({
  href,
  children,
}: {
  href: "/terms" | "/privacy" | "/refunds" | "/imprint";
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="font-medium text-foreground underline underline-offset-4">
      {children}
    </Link>
  );
}

/** The operator's details, as far as they're set in config/legal.ts. */
function Operator() {
  const t = useTranslations("legal.imprint");
  const rows = [
    ["name", OPERATOR.name],
    ["address", OPERATOR.address],
    ["director", OPERATOR.director],
    ["registration", OPERATOR.registration],
    ["vatId", OPERATOR.vatId],
    ["email", OPERATOR.email],
  ] as const;
  const filled = rows.filter(([, value]) => value);
  if (filled.length === 0) return <p className="text-pretty">{t("operatorPending")}</p>;
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
      {filled.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-sm text-muted-foreground">{t(`fields.${key}`)}</dt>
          <dd className="whitespace-pre-line">{key === "email" ? <bdi dir="ltr">{value}</bdi> : value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProcessorTable() {
  const t = useTranslations("legal.privacy.processorTable");
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[30rem] text-start text-sm">
        <caption className="sr-only">{t("caption")}</caption>
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th scope="col" className="p-3 text-start font-medium">
              {t("name")}
            </th>
            <th scope="col" className="p-3 text-start font-medium">
              {t("purpose")}
            </th>
            <th scope="col" className="p-3 text-start font-medium">
              {t("location")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {PROCESSORS.map((p) => (
            <tr key={p.name}>
              <th scope="row" className="p-3 text-start font-medium">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  {p.name}
                </a>
              </th>
              <td className="p-3">{t(`purposes.${p.purpose}`)}</td>
              <td className="p-3">
                <bdi dir="ltr">{p.location}</bdi>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
