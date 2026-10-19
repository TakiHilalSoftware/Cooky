import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CalendarView } from "@/components/planner/calendar-view";
import { asAppLocale } from "@/i18n/routing";
import { getCalendar } from "@/server/features/planner/queries";
import { calendarParamsSchema } from "@/server/features/planner/schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("title") };
}

export default async function CalendarPage({ params, searchParams }: PageProps<"/[locale]/calendar">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const calendar = await getCalendar(calendarParamsSchema.parse(query).month, asAppLocale(locale));
  if (!calendar) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <CalendarView calendar={calendar} />
    </div>
  );
}
