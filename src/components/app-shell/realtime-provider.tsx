"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

import { REALTIME_EVENT_NAME } from "@/lib/social";
import { authorizeRealtime } from "@/server/actions/notifications";
import type { RealtimeConfigDto, RealtimeEvent } from "@/server/realtime/dto";

type Listener = (event: RealtimeEvent) => void;
type RealtimeContextValue = { live: boolean; subscribe: (listener: Listener) => () => void };

const RealtimeContext = createContext<RealtimeContextValue>({ live: false, subscribe: () => () => {} });

/**
 * The viewer's private Pusher channel (ARCHITECTURE §5.11). Events carry ids
 * only; listeners refresh through the server. pusher-js loads only when
 * realtime is set up, and the channel is signed by a Server Action, so the
 * browser never calls an auth endpoint directly.
 */
export function RealtimeProvider({ config, children }: { config: RealtimeConfigDto; children: ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const key = config?.key;
  const cluster = config?.cluster;
  const channel = config?.channel;

  useEffect(() => {
    if (!key || !cluster || !channel) return;
    let closed = false;
    let disconnect = () => {};
    void import("pusher-js").then(({ default: Pusher }) => {
      if (closed) return;
      const pusher = new Pusher(key, {
        cluster,
        forceTLS: true,
        channelAuthorization: {
          customHandler: ({ socketId, channelName }, callback) => {
            authorizeRealtime({ socketId, channelName })
              .then((result) =>
                result?.data ? callback(null, { auth: result.data.auth }) : callback(new Error("forbidden"), null),
              )
              .catch((error: unknown) => callback(error instanceof Error ? error : new Error("forbidden"), null));
          },
        },
      });
      pusher.subscribe(channel).bind(REALTIME_EVENT_NAME, (event: RealtimeEvent) => {
        for (const listener of listeners.current) listener(event);
      });
      disconnect = () => pusher.disconnect();
    });
    return () => {
      closed = true;
      disconnect();
    };
  }, [key, cluster, channel]);

  const live = Boolean(config);
  const value = useMemo<RealtimeContextValue>(
    () => ({
      live,
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [live],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/** Runs `handler` for every realtime event while mounted. `live` is false when realtime is off. */
export function useRealtime(handler: Listener): { live: boolean } {
  const context = useContext(RealtimeContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => context.subscribe((event) => latest.current(event)), [context]);
  return { live: context.live };
}
