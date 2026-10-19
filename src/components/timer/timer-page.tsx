"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { PageSkeleton } from "@/components/feedback/page-skeleton";

function TimerLoading() {
  const t = useTranslations("common");
  return <PageSkeleton label={t("loading")} />;
}

/** Client-only: running timers live in this browser (localStorage), so there's nothing to render on the server. */
export const TimerPage = dynamic(() => import("./timer-view").then((m) => m.TimerView), {
  ssr: false,
  loading: TimerLoading,
});
