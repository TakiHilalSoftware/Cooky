"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";

import { useRouter } from "@/i18n/navigation";
import { toggleShoppingItem } from "@/server/actions/shopping";

import { offlineEnabled, readQueue, readValue, wipeOffline, writeValue, type OfflineStrings } from "./store";

/** Replays check-offs made offline, oldest first; the server keeps whichever change is newest. */
export async function replayQueue(): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;
  const sorted = [...queue].sort((a, b) => a.at.localeCompare(b.at));
  for (const tick of sorted) await toggleShoppingItem({ id: tick.itemId, checked: tick.checked, at: tick.at });
  await writeValue("queue", []);
  return sorted.length;
}

/**
 * The offline exception's housekeeping, on every page: registers the service
 * worker (it only ever serves the static offline page), keeps this device's
 * copy tied to the signed-in person (wiped when signed out or someone else
 * signs in), stores the offline page's words in the current language, and
 * replays queued ticks once back online.
 */
export function OfflineSync({ ownerKey }: { ownerKey: string | null }) {
  const t = useTranslations("offline");
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    void (async () => {
      const owner = await readValue<string>("owner");
      if (!ownerKey || !offlineEnabled()) return wipeOffline();
      if (owner && owner !== ownerKey) await wipeOffline();
      await writeValue("owner", ownerKey);
      const strings: OfflineStrings = {
        lang: locale,
        dir: locale === "ar" ? "rtl" : "ltr",
        title: t("title"),
        banner: t("banner"),
        noList: t("noList"),
        // The template itself: the offline page fills in {checked} and {total}.
        progress: String(t.raw("progress")),
        recipe: t("recipe"),
        ingredients: t("ingredients"),
        steps: t("steps"),
        retry: t("retry"),
      };
      await writeValue("strings", strings);
    })();
  }, [ownerKey, locale, t]);

  useEffect(() => {
    if (!ownerKey) return;
    const sync = async () => {
      if (navigator.onLine && (await replayQueue()) > 0) router.refresh();
    };
    void sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [ownerKey, router]);

  return null;
}
