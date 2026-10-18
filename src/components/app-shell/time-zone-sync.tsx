"use client";

import { useEffect } from "react";

import { TIME_ZONE_COOKIE } from "@/i18n/time-zone";

/**
 * Tells the server the browser's time zone, so times render in the person's
 * local zone from the next request on. Renders nothing.
 */
export function TimeZoneSync() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current = document.cookie.match(new RegExp(`(?:^|; )${TIME_ZONE_COOKIE.replace(".", "\.")}=([^;]*)`))?.[1];
    if (zone && decodeURIComponent(current ?? "") !== zone) {
      document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);
  return null;
}
