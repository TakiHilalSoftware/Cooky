"use client";

import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const PendingContext = createContext(false);

/** If the server hasn't answered by then, stop dimming: the old results are better than a stuck screen. */
const GIVE_UP_MS = 15_000;

/** A URL as one comparable string, query order ignored. */
function urlKey(url: URL) {
  url.searchParams.sort();
  return `${url.pathname}?${url.searchParams}`;
}

/** Where a click on a link goes, when it only changes this page's filters (same path, new query). */
function linkTarget(event: MouseEvent): URL | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return null;
  return new URL(link.href);
}

/** Where a GET filter form goes once submitted. */
function formTarget(event: FormEvent): URL | null {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== "get") return null;
  const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
  const url = new URL(form.action);
  url.search = "";
  for (const [name, value] of new FormData(form, submitter)) {
    if (typeof value === "string") url.searchParams.append(name, value);
  }
  return url;
}

/**
 * Wraps a page whose filters live in the URL (links and GET forms). While a
 * new filter is on its way from the server, the results inside
 * `<PendingResults>` stay on screen, dimmed, with "Updating results…",
 * instead of looking final or blinking to a skeleton.
 */
export function PendingScope({ children, className }: { children: ReactNode; className?: string }) {
  const here = new URL(`${usePathname()}?${useSearchParams().toString()}`, "http://x");
  const current = urlKey(here);
  // The URL the person was on when they asked for new results; navigating away from it ends the wait.
  const [waitingOn, setWaitingOn] = useState<string | null>(null);
  const giveUp = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(giveUp.current), []);

  const start = (target: URL | null) => {
    if (!target || target.origin !== window.location.origin || target.pathname !== here.pathname) return;
    if (urlKey(target) === current) return;
    setWaitingOn(current);
    clearTimeout(giveUp.current);
    giveUp.current = setTimeout(() => setWaitingOn(null), GIVE_UP_MS);
  };

  return (
    <PendingContext.Provider value={waitingOn === current}>
      <div
        className={className}
        onClickCapture={(event) => start(linkTarget(event))}
        onSubmitCapture={(event) => start(formTarget(event))}
      >
        {children}
      </div>
    </PendingContext.Provider>
  );
}

/** Results that dim, with a note, while their `PendingScope` waits for new ones. */
export function PendingResults({ children, className }: { children: ReactNode; className?: string }) {
  const t = useTranslations("common");
  const pending = useContext(PendingContext);
  return (
    <div aria-busy={pending || undefined} className={cn("relative", className)}>
      <div
        className={cn(
          "transition-opacity duration-200 motion-reduce:transition-none",
          // Not clickable meanwhile: these results are about to be replaced.
          pending && "pointer-events-none opacity-45 delay-150",
        )}
      >
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0">
        <div role="status" className="sticky top-20 flex justify-center pt-2">
          {pending ? (
            // Fades in after a beat, so a quick answer never flashes it.
            <span className="inline-flex animate-in items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-md delay-150 duration-200 fill-mode-backwards fade-in motion-reduce:animate-none">
              <Spinner className="text-primary-strong" />
              {t("updatingResults")}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
