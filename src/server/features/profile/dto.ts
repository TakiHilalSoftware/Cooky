// What Settings → Account may know. Types only: safe for the UI.
import type { AppLocale } from "@/i18n/routing";
import type { Appearance } from "@/lib/appearance";

export type ProfileSettingsDto = Appearance & {
  displayName: string;
  initials: string;
  /** The viewer's own address; read-only for now. */
  email: string;
  locale: AppLocale;
};
