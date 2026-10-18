import { useTranslations } from "next-intl";

export const MAIN_CONTENT_ID = "main-content";

/** First focusable element on every page: jumps keyboard users past the top bar. */
export function SkipLink() {
  const t = useTranslations("common");
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
    >
      {t("skipToContent")}
    </a>
  );
}
