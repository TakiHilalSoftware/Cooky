// What Settings → Account may know. Types only: safe for the UI.
import type { AppLocale } from "@/i18n/routing";
import type { Appearance } from "@/lib/appearance";
import type { DietaryTag } from "@/lib/dishes";
import type { PhotoSlotDto } from "@/server/features/photos/dto";

export type ProfileSettingsDto = Appearance & {
  displayName: string;
  initials: string;
  /** The viewer's own address; read-only for now. */
  email: string;
  locale: AppLocale;
  /** The profile photo, and whether uploads are set up. */
  avatar: PhotoSlotDto;
};

/** Where the person cooks and what they eat (onboarding, Settings → Kitchen). */
export type KitchenDto = {
  city: string | null;
  /** Rounded to about 1 km. */
  latitude: number | null;
  longitude: number | null;
  dietaryPrefs: DietaryTag[];
  onboarded: boolean;
};
