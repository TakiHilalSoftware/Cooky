"use client";

import {
  CloudFogIcon,
  CloudIcon,
  CloudLightningIcon,
  CloudRainIcon,
  FlameIcon,
  MapPinIcon,
  MoonStarIcon,
  SnowflakeIcon,
  SunIcon,
  ThermometerSnowflakeIcon,
  WindIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { WeatherChipDto, WeatherCondition, WeatherDto } from "@/server/weather/dto";

const ICONS: Record<WeatherCondition, LucideIcon> = {
  sunny: SunIcon,
  clear_night: MoonStarIcon,
  cloudy: CloudIcon,
  rainy: CloudRainIcon,
  stormy: CloudLightningIcon,
  snowy: SnowflakeIcon,
  foggy: CloudFogIcon,
  windy: WindIcon,
};

/** A gentle, condition-specific motion; `motion-safe` keeps the icon still for reduced motion. */
const MOTION: Record<WeatherCondition, string> = {
  sunny: "motion-safe:animate-[spin_24s_linear_infinite]",
  clear_night: "motion-safe:animate-pulse",
  cloudy: "motion-safe:animate-[weather-drift_6s_ease-in-out_infinite]",
  rainy: "motion-safe:animate-[weather-bob_2.4s_ease-in-out_infinite]",
  stormy: "motion-safe:animate-[weather-bob_1.6s_ease-in-out_infinite]",
  snowy: "motion-safe:animate-[spin_12s_linear_infinite]",
  foggy: "motion-safe:animate-pulse",
  windy: "motion-safe:animate-[weather-drift_3s_ease-in-out_infinite]",
};

/** The short "feel" after the temperature, when there's something worth saying. */
function feelKey(weather: WeatherDto) {
  if (weather.accent) return weather.accent;
  if (weather.condition === "stormy" || weather.condition === "snowy") return weather.condition;
  if (weather.mood !== "neutral") return weather.mood;
  return null;
}

/**
 * The top-bar weather chip (PRD §3.0): how it feels outside, from the server's
 * numbers. Tapping it explains what Cook does with it.
 */
export function WeatherChip({ chip }: { chip: WeatherChipDto }) {
  const t = useTranslations("weather");
  const tSeason = useTranslations("dishes.season");

  if (chip.status !== "ok") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="gap-1.5 px-2.5 text-muted-foreground">
            <MapPinIcon aria-hidden="true" />
            <span className="hidden sm:inline">{t("setCity")}</span>
            <span className="sr-only sm:hidden">{t("setCity")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" collisionPadding={12} className="w-72 max-w-[calc(100vw-1.5rem)] space-y-3">
          <p className="font-medium">
            {chip.status === "not_found" ? t("notFound", { city: chip.city }) : t("setCity")}
          </p>
          <p className="text-sm text-muted-foreground">
            {chip.status === "not_found" ? t("notFoundHint") : t("setCityHint")}
          </p>
          <Button asChild size="sm">
            <Link href="/settings">{t("openSettings")}</Link>
          </Button>
        </PopoverContent>
      </Popover>
    );
  }

  const { weather } = chip;
  const Icon = ICONS[weather.condition];
  const AccentIcon =
    weather.accent === "hot" ? FlameIcon : weather.accent === "freezing" ? ThermometerSnowflakeIcon : null;
  const condition = t(`condition.${weather.condition}`);
  const feel = feelKey(weather);
  const label = feel
    ? t("labelWithFeel", { condition, temp: weather.tempC, feel: t(`feel.${feel}`) })
    : t("label", { condition, temp: weather.tempC });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="gap-1.5 px-2.5" title={label}>
          <span className="relative inline-flex">
            <Icon aria-hidden="true" className={cn("text-primary-strong", MOTION[weather.condition])} />
            {AccentIcon ? (
              <AccentIcon aria-hidden="true" className="absolute -end-1.5 -top-1.5 size-3 text-primary-strong" />
            ) : null}
          </span>
          <span aria-hidden="true" className="tabular-nums">
            {weather.tempC}°
          </span>
          <span className="sr-only">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="w-72 max-w-[calc(100vw-1.5rem)] space-y-3">
        <div className="flex items-center gap-3">
          <Icon aria-hidden="true" className="size-8 shrink-0 text-primary-strong" />
          <div>
            <p className="font-medium">{condition}</p>
            <p className="font-heading text-3xl tabular-nums">{weather.tempC}°C</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("feelsLike")}</dt>
          <dd className="tabular-nums">{weather.feelsLikeC}°C</dd>
          <dt className="text-muted-foreground">{t("wind")}</dt>
          <dd className="tabular-nums">{t("windValue", { speed: weather.windKmh })}</dd>
          <dt className="text-muted-foreground">{t("rain")}</dt>
          <dd className="tabular-nums">
            {weather.precipMm > 0 ? t("rainValue", { mm: weather.precipMm }) : t("noRain")}
          </dd>
        </dl>
        <p className="text-sm text-muted-foreground">
          {weather.mood === "neutral" ? t("mood.neutral", { season: tSeason(chip.season) }) : t(`mood.${weather.mood}`)}
        </p>
      </PopoverContent>
    </Popover>
  );
}
