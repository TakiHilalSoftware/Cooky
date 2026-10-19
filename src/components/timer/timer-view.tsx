"use client";

import { BellRingIcon, FlagIcon, PauseIcon, PlayIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { alarm } from "@/components/cook/step-timer";
import { IconButton } from "@/components/feedback/icon-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** PRD §3.5: countdowns up to 24 hours. */
const MAX_MS = 24 * 60 * 60 * 1000;
const PRESETS = [1, 3, 5, 10, 15, 20, 30, 45, 60];
/** Running timers survive a reload (a UI convenience, allowed in localStorage by AGENT_RULES §2). */
const STORAGE_KEY = "cooky.timers";

type Countdown = {
  id: string;
  label: string;
  totalMs: number;
  endsAt: number | null;
  remainingMs: number;
  done: boolean;
};
type Stopwatch = { startedAt: number | null; elapsedMs: number; laps: number[] };
type Saved = { countdowns: Countdown[]; stopwatch: Stopwatch };

const EMPTY: Saved = { countdowns: [], stopwatch: { startedAt: null, elapsedMs: 0, laps: [] } };

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Saved) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function clock(ms: number, withTenths = false) {
  const total = Math.max(0, ms);
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  const mmss = `${String(minutes).padStart(hours ? 2 : 1, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${hours ? `${hours}:` : ""}${mmss}${withTenths ? `.${tenths}` : ""}`;
}

/** Wall-clock time, kept out of render (the timer only reads it in events and intervals). */
const nowMs = () => Date.now();

const remainingOf = (c: Countdown, now: number) => (c.endsAt !== null ? c.endsAt - now : c.remainingMs);

/** Keeps the screen on while something runs. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    void navigator.wakeLock
      .request("screen")
      .then((l) => {
        if (cancelled) void l.release();
        else lock = l;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, [active]);
}

/**
 * The kitchen timer (PRD §3.5): several named countdowns at once and a
 * stopwatch with laps. When a countdown ends: a banner, a beep, a buzz, and a
 * notification if Cooky is in the background (with permission).
 */
export function TimerView({ notify = true }: { notify?: boolean }) {
  const t = useTranslations("timer");
  // Rendered client-only (see TimerPage), so localStorage is there from the first render.
  const [state, setState] = useState<Saved>(load);
  const [now, setNow] = useState(nowMs);
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState("10");
  const [seconds, setSeconds] = useState("0");
  const [hours, setHours] = useState("0");
  const notified = useRef(new Set<string>());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage blocked: timers still run, they just won't survive a reload.
    }
  }, [state]);

  const running = state.countdowns.some((c) => c.endsAt !== null) || state.stopwatch.startedAt !== null;
  useWakeLock(running);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      const current = nowMs();
      setNow(current);
      setState((s) => {
        const due = s.countdowns.filter((c) => c.endsAt !== null && c.endsAt <= current);
        if (due.length === 0) return s;
        alarm();
        for (const c of due) {
          if (notified.current.has(c.id)) continue;
          notified.current.add(c.id);
          if (
            notify &&
            document.visibilityState === "hidden" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            void navigator.serviceWorker?.ready.then((reg) =>
              reg.showNotification(t("notifyTitle"), { body: c.label, tag: c.id }),
            );
          }
        }
        return {
          ...s,
          countdowns: s.countdowns.map((c) =>
            due.some((d) => d.id === c.id) ? { ...c, endsAt: null, remainingMs: 0, done: true } : c,
          ),
        };
      });
    }, 250);
    return () => clearInterval(tick);
  }, [running, t, notify]);

  const update = (id: string, change: (c: Countdown) => Countdown) =>
    setState((s) => ({ ...s, countdowns: s.countdowns.map((c) => (c.id === id ? change(c) : c)) }));

  function start(totalMs: number, name: string) {
    if (totalMs <= 0 || totalMs > MAX_MS) return;
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    const current = nowMs();
    setNow(current);
    setState((s) => ({
      ...s,
      countdowns: [
        ...s.countdowns,
        {
          id: crypto.randomUUID(),
          label: name || t("defaultLabel", { minutes: Math.round(totalMs / 60_000) }),
          totalMs,
          endsAt: current + totalMs,
          remainingMs: totalMs,
          done: false,
        },
      ],
    }));
    setLabel("");
  }

  function onCustom(event: FormEvent) {
    event.preventDefault();
    const total = (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000;
    start(Math.min(total, MAX_MS), label.trim());
  }

  const ringing = state.countdowns.filter((c) => c.done);
  const sw = state.stopwatch;
  const swElapsed = sw.startedAt !== null ? sw.elapsedMs + (now - sw.startedAt) : sw.elapsedMs;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {ringing.length > 0 ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-3xl bg-primary p-4 text-primary-foreground"
        >
          <BellRingIcon aria-hidden="true" className="size-6 motion-safe:animate-bounce" />
          <p className="flex-1 font-heading text-xl">
            {t("timeUp", { names: ringing.map((c) => c.label).join(", ") })}
          </p>
          <Button
            variant="secondary"
            onClick={() => setState((s) => ({ ...s, countdowns: s.countdowns.filter((c) => !c.done) }))}
          >
            {t("dismiss")}
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="new-timer" className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 id="new-timer" className="font-heading text-2xl">
          {t("newTimer")}
        </h2>
        <div className="space-y-2">
          <Label htmlFor="timer-label">{t("labelLabel")}</Label>
          <Input
            id="timer-label"
            value={label}
            maxLength={40}
            placeholder={t("labelPlaceholder")}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("presets")}</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((m) => (
              <Button key={m} variant="outline" onClick={() => start(m * 60_000, label.trim())}>
                {t("minutes", { count: m })}
              </Button>
            ))}
          </div>
        </div>
        <form onSubmit={onCustom} className="flex flex-wrap items-end gap-3">
          {(
            [
              ["hours", hours, setHours, 23],
              ["minutesField", minutes, setMinutes, 59],
              ["seconds", seconds, setSeconds, 59],
            ] as const
          ).map(([key, value, set, max]) => (
            <div key={key} className="w-20 space-y-1">
              <Label htmlFor={`timer-${key}`}>{t(key)}</Label>
              <Input
                id={`timer-${key}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={max}
                value={value}
                onChange={(e) => set(e.target.value)}
              />
            </div>
          ))}
          <Button type="submit">
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            {t("start")}
          </Button>
        </form>
      </section>

      {state.countdowns.length > 0 ? (
        <section aria-labelledby="running-timers" className="space-y-3">
          <h2 id="running-timers" className="font-heading text-2xl">
            {t("running")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {state.countdowns.map((c) => {
              const remaining = remainingOf(c, now);
              const paused = c.endsAt === null && !c.done;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "space-y-3 rounded-3xl border bg-card p-5",
                    c.done ? "border-primary-strong" : "border-border",
                  )}
                >
                  <p className="truncate font-medium">{c.label}</p>
                  <p role="timer" aria-live="off" className="font-heading text-5xl tabular-nums">
                    {clock(remaining)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {c.done ? null : paused ? (
                      <Button onClick={() => update(c.id, (x) => ({ ...x, endsAt: nowMs() + x.remainingMs }))}>
                        <PlayIcon aria-hidden="true" data-icon="inline-start" />
                        {t("resume")}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() =>
                          update(c.id, (x) => ({
                            ...x,
                            endsAt: null,
                            remainingMs: Math.max(0, (x.endsAt ?? 0) - nowMs()),
                          }))
                        }
                      >
                        <PauseIcon aria-hidden="true" data-icon="inline-start" />
                        {t("pause")}
                      </Button>
                    )}
                    <IconButton
                      label={t("restart", { name: c.label })}
                      onClick={() =>
                        update(c.id, (x) => ({
                          ...x,
                          done: false,
                          endsAt: nowMs() + x.totalMs,
                          remainingMs: x.totalMs,
                        }))
                      }
                    >
                      <RotateCcwIcon aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={t("delete", { name: c.label })}
                      onClick={() => setState((s) => ({ ...s, countdowns: s.countdowns.filter((x) => x.id !== c.id) }))}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="stopwatch" className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 id="stopwatch" className="font-heading text-2xl">
          {t("stopwatch")}
        </h2>
        <p role="timer" aria-live="off" className="font-heading text-5xl tabular-nums">
          {clock(swElapsed, true)}
        </p>
        <div className="flex flex-wrap gap-2">
          {sw.startedAt === null ? (
            <Button
              onClick={() => {
                const current = nowMs();
                setNow(current);
                setState((s) => ({ ...s, stopwatch: { ...s.stopwatch, startedAt: current } }));
              }}
            >
              <PlayIcon aria-hidden="true" data-icon="inline-start" />
              {sw.elapsedMs > 0 ? t("resume") : t("startStopwatch")}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    stopwatch: {
                      ...s.stopwatch,
                      startedAt: null,
                      elapsedMs: s.stopwatch.elapsedMs + (nowMs() - (s.stopwatch.startedAt ?? nowMs())),
                    },
                  }))
                }
              >
                <PauseIcon aria-hidden="true" data-icon="inline-start" />
                {t("pause")}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setState((s) => ({ ...s, stopwatch: { ...s.stopwatch, laps: [...s.stopwatch.laps, swElapsed] } }))
                }
              >
                <FlagIcon aria-hidden="true" data-icon="inline-start" />
                {t("lap")}
              </Button>
            </>
          )}
          {sw.elapsedMs > 0 || sw.startedAt !== null ? (
            <Button variant="ghost" onClick={() => setState((s) => ({ ...s, stopwatch: EMPTY.stopwatch }))}>
              <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
              {t("reset")}
            </Button>
          ) : null}
        </div>
        {sw.laps.length > 0 ? (
          <ol className="space-y-1 text-sm tabular-nums">
            {sw.laps.map((lap, i) => (
              <li key={i} className="flex justify-between gap-4 border-b border-border py-1.5">
                <span>{t("lapNumber", { number: i + 1 })}</span>
                <span>
                  {clock(lap - (sw.laps[i - 1] ?? 0), true)} · {clock(lap, true)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}
