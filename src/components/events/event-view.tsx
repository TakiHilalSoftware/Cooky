"use client";

import {
  ChevronLeftIcon,
  PencilIcon,
  ShoppingBasketIcon,
  SparklesIcon,
  Trash2Icon,
  WandIcon,
  XIcon,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PickCard } from "@/components/assistant/pick-card";
import { IconButton } from "@/components/feedback/icon-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { TriesMeter } from "@/components/paywall/tries-meter";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { Course } from "@/lib/dishes";
import { deleteEvent, setEventDish, suggestCourse, suggestCourseWithAi, updateEvent } from "@/server/actions/events";
import { addToShopping } from "@/server/actions/shopping";
import type { CourseSuggestionDto, EventCourseDto, EventDto } from "@/server/features/events/dto";

import { EventForm } from "./event-form";

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * One event (PRD §3.5): name, date, guests and one dish per course. Recipes
 * open scaled to the guest count; Suggest fills a course; "Shop for this
 * menu" adds everything to the shopping list.
 */
export function EventView({ event }: { event: EventDto }) {
  const t = useTranslations("events");
  const format = useFormatter();
  const router = useRouter();
  const messages = useFormMessages();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shopping, setShopping] = useState(false);
  const chosen = event.courses.filter((c) => c.dish);

  async function shop() {
    setShopping(true);
    const result = await addToShopping({ source: "event", id: event.id });
    setShopping(false);
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    toast.success(t("shopped", { count: result.data.added }), {
      action: { label: t("openList"), onClick: () => router.push("/shopping") },
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/planner/events"
        className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {t("backToEvents")}
      </Link>

      {editing ? (
        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h1 className="font-heading text-2xl">{t("edit")}</h1>
            <IconButton label={t("cancelEdit")} onClick={() => setEditing(false)}>
              <XIcon aria-hidden="true" />
            </IconButton>
          </div>
          <EventForm
            initial={{ name: event.name, date: event.date, guests: event.guests }}
            submitLabel={t("save")}
            onSubmit={async (values) => {
              const result = await updateEvent({ id: event.id, ...values });
              if (!result?.data) return void toast.error(messages.action(result?.serverError));
              toast.success(t("saved"));
              setEditing(false);
            }}
          />
        </section>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary-strong capitalize">
              {format.dateTime(asDate(event.date), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 className="font-heading text-4xl break-words">{event.name}</h1>
            <p className="text-muted-foreground">{t("guests", { count: event.guests })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon aria-hidden="true" data-icon="inline-start" />
              {t("edit")}
            </Button>
            <Button disabled={chosen.length === 0 || shopping} onClick={shop}>
              {shopping ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ShoppingBasketIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {t("shopForMenu")}
            </Button>
          </div>
        </div>
      )}

      {event.aiSuggest && event.assistantUsage ? <TriesMeter usage={event.assistantUsage} variant="compact" /> : null}

      <ol className="space-y-3">
        {event.courses.map((course) => (
          <CourseRow key={course.course} event={event} course={course} />
        ))}
      </ol>

      <div className="border-t border-border pt-6">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2Icon aria-hidden="true" data-icon="inline-start" />
          {t("delete")}
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { name: event.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                const result = await deleteEvent({ id: event.id });
                if (!result?.data) return void toast.error(messages.action(result?.serverError));
                toast.success(t("deleted", { name: event.name }));
                router.replace("/planner/events");
              }}
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CourseRow({ event, course }: { event: EventDto; course: EventCourseDto }) {
  const t = useTranslations("events");
  const tCourse = useTranslations("dishes.course");
  const locale = useLocale() as AppLocale;
  const messages = useFormMessages();
  const onActionError = useActionErrorHandler();
  const [suggestion, setSuggestion] = useState<CourseSuggestionDto | null>(null);
  const [offered, setOffered] = useState<string[]>([]);
  const [busy, setBusy] = useState<"rules" | "ai" | "set" | null>(null);
  const sameCourse = event.choices.filter((c) => c.course === course.course);
  const others = event.choices.filter((c) => c.course !== course.course);

  async function choose(dishId: string | null) {
    setBusy("set");
    const result = await setEventDish({ eventId: event.id, course: course.course as Course, dishId });
    setBusy(null);
    if (!result?.data) toast.error(messages.action(result?.serverError));
    else setSuggestion(null);
  }

  async function suggest(withAi: boolean) {
    setBusy(withAi ? "ai" : "rules");
    const input = { eventId: event.id, course: course.course, exclude: offered, locale };
    const result = withAi ? await suggestCourseWithAi(input) : await suggestCourse(input);
    setBusy(null);
    if (result?.data) {
      const pick = result.data;
      setSuggestion(pick);
      if (pick.kind === "mine") setOffered((list) => [...list, pick.dishId]);
      return;
    }
    const code = result?.serverError;
    if (code === "not_found") return toast.info(t("noSuggestion", { course: tCourse(course.course) }));
    if (code === "unavailable") return toast.error(t("aiUnavailable"));
    onActionError(code, "ai_suggest");
  }

  return (
    <li className="space-y-3 rounded-3xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl">{tCourse(course.course)}</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => suggest(false)}>
            {busy === "rules" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <WandIcon aria-hidden="true" data-icon="inline-start" />
            )}
            {t("suggest")}
          </Button>
          {event.aiSuggest ? (
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => suggest(true)}>
              {busy === "ai" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SparklesIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {t("suggestAi")}
            </Button>
          ) : null}
        </div>
      </div>

      {course.dish ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted p-3">
          {course.dish.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.dish.photoUrl}
              alt=""
              width={64}
              height={48}
              className="aspect-[4/3] w-16 rounded-lg object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="font-medium break-words">{course.dish.name}</p>
            <Link
              href={`/dishes/${course.dish.id}?servings=${event.guests}`}
              className="text-sm text-primary-strong underline-offset-4 hover:underline"
            >
              {t("recipeFor", { count: event.guests })}
            </Link>
          </div>
          <IconButton
            label={t("clearCourse", { course: tCourse(course.course) })}
            disabled={busy !== null}
            onClick={() => choose(null)}
          >
            <XIcon aria-hidden="true" />
          </IconButton>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noDish")}</p>
      )}

      {event.choices.length > 0 ? (
        <NativeSelect
          aria-label={t("chooseFor", { course: tCourse(course.course) })}
          value=""
          disabled={busy !== null}
          onChange={(e) => e.target.value && void choose(e.target.value)}
          className="w-full sm:w-80"
        >
          <NativeSelectOption value="">{course.dish ? t("change") : t("choose")}</NativeSelectOption>
          {sameCourse.length > 0 ? (
            <NativeSelectOptGroup label={tCourse(course.course)}>
              {sameCourse.map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {d.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ) : null}
          {others.length > 0 ? (
            <NativeSelectOptGroup label={t("otherDishes")}>
              {others.map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {d.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ) : null}
        </NativeSelect>
      ) : null}

      {suggestion ? (
        <div className="space-y-2">
          <ul>
            <PickCard pick={suggestion} />
          </ul>
          <div className="flex flex-wrap gap-2">
            {suggestion.kind === "mine" ? (
              <Button size="sm" disabled={busy !== null} onClick={() => choose(suggestion.dishId)}>
                {t("useIt")}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">{t("saveFirst")}</p>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
              {t("dismiss")}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
