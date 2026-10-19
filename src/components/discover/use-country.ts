import { useLocale } from "next-intl";

/**
 * Country names in the viewer's language (built-in Intl.DisplayNames). Server
 * components only: browsers and Node name some regions differently. No flag
 * emoji either, since Windows shows them as plain letters.
 */
export function useCountry() {
  const locale = useLocale();
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return { name: (code: string) => names.of(code) ?? code };
}
