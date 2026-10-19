import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { FeedbackView } from "@/components/admin/moderation-views";
import { feedbackKindParam, feedbackStatusParam, pageParam } from "@/server/features/admin/params";
import { listFeedback } from "@/server/features/admin/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("feedback") };
}

export default async function AdminFeedbackPage({ searchParams }: PageProps<"/[locale]/admin/feedback">) {
  const sp = await searchParams;
  const status = feedbackStatusParam.parse(sp.status ?? null);
  const kind = feedbackKindParam.parse(sp.kind ?? null);
  const feedback = await listFeedback({ status, kind }, pageParam.parse(sp.page));
  if (!feedback) notFound();
  return <FeedbackView feedback={feedback} status={status} kind={kind} />;
}
