"use client";

import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, type ReactNode } from "react";

import type { ThemePreference } from "@/lib/appearance";

/** True when preferences changed in the UI should also be saved to the profile. */
const SavesPreferences = createContext(false);

export function useSavesPreferences(): boolean {
  return useContext(SavesPreferences);
}

/**
 * For signed-in people the profile is the source of truth, so a theme chosen
 * on another device applies here too. Signed-out visitors keep the browser's
 * own choice (a UI convenience in localStorage).
 */
export function PreferencesSync({ savedTheme, children }: { savedTheme: ThemePreference | null; children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (savedTheme && theme !== savedTheme) setTheme(savedTheme);
    // Only when the saved value changes, not on every local toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTheme]);
  return <SavesPreferences.Provider value={savedTheme !== null}>{children}</SavesPreferences.Provider>;
}
