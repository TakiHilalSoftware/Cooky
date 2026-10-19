import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPage } from "@/components/marketing/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.refunds");
  return { title: t("title") };
}

export default function RefundsPage() {
  return <LegalPage document="refunds" />;
}
