import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { EventView } from "@/components/events/event-view";
import { asAppLocale } from "@/i18n/routing";
import { getEvent } from "@/server/features/events/queries";
import { eventIdSchema } from "@/server/features/events/schema";

async function load(params: PageProps<"/[locale]/planner/events/[id]">["params"]) {
  const { locale, id } = await params;
  const parsed = eventIdSchema.safeParse({ id });
  return parsed.success ? getEvent(parsed.data.id, asAppLocale(locale)) : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/planner/events/[id]">): Promise<Metadata> {
  const [event, t] = await Promise.all([load(params), getTranslations("events")]);
  return { title: event?.name ?? t("title") };
}

export default async function EventPage({ params }: PageProps<"/[locale]/planner/events/[id]">) {
  const event = await load(params);
  if (!event) notFound();
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <EventView event={event} />
    </div>
  );
}
