"use client";

import { PauseIcon, PlayIcon, RotateCcwIcon, TimerIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { IconButton } from "@/components/feedback/icon-button";
import { Button } from "@/components/ui/button";

export type TimerState = { endsAt: number | null; remainingMs: number; done: boolean };

export const freshTimer = (minutes: number): TimerState => ({
  endsAt: null,
  remainingMs: minutes * 60_000,
  done: false,
});

/** A short, gentle alarm: three beeps and a buzz where the device supports it. */
export function alarm() {
  try {
    const audio = new AudioContext();
    [0, 0.35, 0.7].forEach((offset) => {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = 880;
      gain.gain.setValueAtTime(0.18, audio.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + offset + 0.25);
      tone.connect(gain).connect(audio.destination);
      tone.start(audio.currentTime + offset);
      tone.stop(audio.currentTime + offset + 0.3);
    });
  } catch {
    // No audio (blocked or unsupported): the banner still shows.
  }
  navigator.vibrate?.([200, 100, 200, 100, 400]);
}

const clock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
};

/** A step's countdown. State lives with the parent, so it keeps running while you look at other steps. */
export function StepTimer({
  minutes,
  state,
  onChange,
}: {
  minutes: number;
  state: TimerState;
  onChange: (next: TimerState) => void;
}) {
  const t = useTranslations("cooking");
  const [now, setNow] = useState(() => Date.now());
  const running = state.endsAt !== null;

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [running]);

  const remaining = running ? state.endsAt! - now : state.remainingMs;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <TimerIcon aria-hidden="true" className="size-6 text-primary-strong" />
      <span role="timer" aria-live="off" className="font-heading text-3xl tabular-nums">
        {clock(remaining)}
      </span>
      {state.done ? <span className="font-medium text-primary-strong">{t("timeUp")}</span> : null}
      <div className="ms-auto flex gap-1">
        {running ? (
          <Button
            variant="outline"
            onClick={() =>
              onChange({ endsAt: null, remainingMs: Math.max(0, state.endsAt! - Date.now()), done: false })
            }
          >
            <PauseIcon aria-hidden="true" data-icon="inline-start" />
            {t("pause")}
          </Button>
        ) : (
          <Button
            onClick={() =>
              onChange({
                endsAt: Date.now() + (state.done ? minutes * 60_000 : state.remainingMs),
                remainingMs: 0,
                done: false,
              })
            }
          >
            <PlayIcon aria-hidden="true" data-icon="inline-start" />
            {state.remainingMs < minutes * 60_000 && !state.done ? t("resume") : t("start", { minutes })}
          </Button>
        )}
        <IconButton label={t("reset")} onClick={() => onChange(freshTimer(minutes))}>
          <RotateCcwIcon aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}
