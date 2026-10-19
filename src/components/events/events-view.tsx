"use client";

import { ChevronLeftIcon, PartyPopperIcon, PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, useRouter } from "@/i18n/navigation";
import { addDays } from "@/lib/dates";
import { createEvent } from "@/server/actions/events";
import type { EventsPageDto, EventSummaryDto } from "@/server/features/events/dto";

import { EventForm } from "./event-form";

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

/** Events & guests (PRD §3.5): upcoming and past meals for guests, and a new one. */
export function EventsView({ page }: { page: EventsPageDto }) {
  const t = useTranslations("events");
  const router = useRouter();
  const onActionError = useActionErrorHandler();
  const [creating, setCreating] = useState(false);
  const { allowance } = page;

  function startNew() {
    // Over the plan's cap: the upgrade sheet explains instead of a form that would fail.
    if (!allowance.canAdd)
      return onActionError(allowance.limit === 0 ? "plan_required" : "quota_exceeded", "upcoming_events");
    setCreating(true);
  }

  return (
    <div className="space-y-6">
      <Link
        href="/planner"
        className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {t("backToPlanner")}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
          {allowance.limit !== null ? (
            <p className="text-sm text-muted-foreground">
              {t("allowance", { count: allowance.count, limit: allowance.limit })}
            </p>
          ) : null}
        </div>
        <Button onClick={startNew}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          {t("new")}
        </Button>
      </div>

      {page.upcoming.length === 0 && page.past.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyBody")}
          illustration={<PartyPopperIcon aria-hidden="true" className="size-14 text-tile" />}
          action={
            <Button onClick={startNew}>
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              {t("new")}
            </Button>
          }
        />
      ) : (
        <>
          <EventList title={t("upcoming")} events={page.upcoming} empty={t("noUpcoming")} />
          {page.past.length > 0 ? <EventList title={t("past")} events={page.past} /> : null}
        </>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("new")}</DialogTitle>
            <DialogDescription>{t("newBody")}</DialogDescription>
          </DialogHeader>
          <EventForm
            initial={{ name: "", date: addDays(page.today, 7), guests: 6 }}
            submitLabel={t("create")}
            onSubmit={async (values) => {
              const result = await createEvent(values);
              if (result?.data) {
                setCreating(false);
                router.push(`/planner/events/${result.data.id}`);
                return;
              }
              const code = result?.serverError;
              if (code === "quota_exceeded" || code === "plan_required") setCreating(false);
              // The upgrade sheet for the cap; a toast for anything else.
              onActionError(code, "upcoming_events");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventList({ title, events, empty }: { title: string; events: EventSummaryDto[]; empty?: string }) {
  const t = useTranslations("events");
  const format = useFormatter();
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-2xl">{title}</h2>
      {events.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/planner/events/${event.id}`}
                className="block space-y-1 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary-strong"
              >
                <p className="text-sm font-medium text-primary-strong capitalize">
                  {format.dateTime(asDate(event.date), {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="font-heading text-xl break-words">{event.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t("guests", { count: event.guests })} · {t("courseCount", { count: event.courses })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
