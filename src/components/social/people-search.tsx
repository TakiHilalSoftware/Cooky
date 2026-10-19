"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { useOnline } from "@/components/app-shell/use-online";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { searchPeople } from "@/server/actions/friends";
import type { PersonDto } from "@/server/features/social/dto";

import { PersonAvatar } from "./person-avatar";
import { RelationButton } from "./relation-button";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "done"; people: PersonDto[] }
  | { status: "error"; message: string };

/**
 * Find people by display name, or by their exact email (PRD §3.6). Nobody's
 * email is ever shown back: an email only finds someone if it matches exactly.
 */
export function PeopleSearch({ inputRef }: { inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const t = useTranslations("friends.search");
  const messages = useFormMessages();
  const online = useOnline();
  const id = useId();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS || !online) return;
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      setState({ status: "searching" });
      const result = await searchPeople({ query: q });
      // A slower, older answer never overwrites a newer one.
      if (ticket !== latest.current) return;
      setState(
        result?.data
          ? { status: "done", people: result.data.people }
          : { status: "error", message: messages.action(result?.serverError) },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, online, messages]);

  const short = query.trim().length < MIN_CHARS;
  const shown: SearchState = short ? { status: "idle" } : state;

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="space-y-1">
        <h2 id={`${id}-heading`} className="font-heading text-2xl">
          {t("heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={id}>{t("label")}</Label>
        <div className="relative">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={inputRef}
            id={id}
            type="search"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            aria-describedby={`${id}-hint`}
            className="h-11 ps-9"
          />
        </div>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {online ? t("hint") : t("offline")}
        </p>
      </div>

      <div aria-live="polite" aria-busy={shown.status === "searching"}>
        {shown.status === "searching" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> {t("searching")}
          </p>
        ) : shown.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {shown.message}
          </p>
        ) : shown.status === "done" ? (
          shown.people.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              {query.includes("@") ? t("noEmailMatch") : t("noMatch")}
            </p>
          ) : (
            <>
              <p className="sr-only">{t("results", { count: shown.people.length })}</p>
              <ul className="divide-y divide-border">
                {shown.people.map((person) => (
                  <li key={person.id} className="flex items-center gap-3 py-3">
                    <PersonAvatar person={person} />
                    <Link
                      href={`/friends/${person.id}`}
                      className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline"
                    >
                      {person.displayName}
                    </Link>
                    <RelationButton person={person} />
                  </li>
                ))}
              </ul>
            </>
          )
        ) : null}
      </div>
    </section>
  );
}
