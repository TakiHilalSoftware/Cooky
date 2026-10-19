"use client";

import { useEffect, useRef, useState } from "react";

/** PRD §3.2: a recording that runs past a minute is too long (and over the 4 MB upload). */
export const MAX_RECORDING_SECONDS = 60;
/** Smaller than this, nothing was really said: no request, no try. */
export const MIN_RECORDING_BYTES = 2_000;

export type RecorderProblem =
  "blocked" | "insecure" | "noMicrophone" | "offline" | "tooLong" | "nothingHeard" | "unsupported" | "unavailable";
export type RecorderState =
  { kind: "idle" } | { kind: "recording"; seconds: number } | { kind: "error"; problem: RecorderProblem };

/**
 * The microphone, for voice features: records with MediaRecorder, stops at a
 * minute, and hands back the audio only when something was said. Every
 * failure becomes a problem the UI can explain.
 */
export function useAudioRecorder(onAudio: (audio: Blob) => void) {
  const [state, setState] = useState<RecorderState>({ kind: "idle" });
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const discard = useRef(false);
  const deliver = useRef(onAudio);
  // The latest callback, for a recording that ends after a re-render.
  useEffect(() => {
    deliver.current = onAudio;
  });

  useEffect(
    () => () => {
      clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    if (!window.isSecureContext) return setState({ kind: "error", problem: "insecure" });
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return setState({ kind: "error", problem: "unsupported" });
    }
    if (!navigator.onLine) return setState({ kind: "error", problem: "offline" });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      const problem: RecorderProblem =
        name === "NotAllowedError" || name === "SecurityError"
          ? "blocked"
          : name === "NotFoundError"
            ? "noMicrophone"
            : "unavailable";
      return setState({ kind: "error", problem });
    }
    chunks.current = [];
    discard.current = false;
    const next = new MediaRecorder(stream);
    next.ondataavailable = (event) => event.data.size > 0 && chunks.current.push(event.data);
    next.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      clearInterval(timer.current);
      if (discard.current) return;
      const audio = new Blob(chunks.current, { type: next.mimeType });
      if (audio.size < MIN_RECORDING_BYTES) return setState({ kind: "error", problem: "nothingHeard" });
      setState({ kind: "idle" });
      deliver.current(audio);
    };
    recorder.current = next;
    next.start();
    setState({ kind: "recording", seconds: 0 });
    timer.current = setInterval(() => {
      setState((current) => {
        if (current.kind !== "recording") return current;
        if (current.seconds + 1 >= MAX_RECORDING_SECONDS) {
          discard.current = true;
          recorder.current?.stop();
          return { kind: "error", problem: "tooLong" };
        }
        return { kind: "recording", seconds: current.seconds + 1 };
      });
    }, 1000);
  }

  return {
    state,
    start,
    stop: () => recorder.current?.stop(),
    /** Report a problem found after recording (e.g. the server heard nothing). */
    fail: (problem: RecorderProblem) => setState({ kind: "error", problem }),
    reset: () => setState({ kind: "idle" }),
  };
}
