import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { EventsView } from "@/components/events/events-view";
import { getEvents } from "@/server/features/events/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("events");
  return { title: t("title") };
}

export default async function EventsPage() {
  const page = await getEvents();
  if (!page) notFound();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <EventsView page={page} />
    </div>
  );
}
