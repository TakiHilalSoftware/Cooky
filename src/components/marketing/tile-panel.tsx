"use client";

import {
  ChefHatIcon,
  CloudRainIcon,
  DicesIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SparklesIcon,
  TimerIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SHOWCASE_DISHES = [
  {
    slug: "chicken-tagine-preserved-lemon",
    name: "Chicken tagine with preserved lemon & olives",
    country: "Morocco",
    flag: "🇲🇦",
    time: "65 min",
    servings: 4,
    difficulty: "Medium",
    image: "/images/hero/hero-tagine.jpg",
    weatherTip: "Rainy 14°C · Warm fragrant stews ranked first",
    ingredients: ["Chicken", "Preserved lemon", "Green olives", "Saffron"],
    step: "Brown chicken pieces with ginger, saffron, garlic, and onions in olive oil until golden.",
    stepTimer: 450,
  },
  {
    slug: "couscous-seven-vegetables",
    name: "Couscous with seven vegetables & lamb",
    country: "Morocco",
    flag: "🇲🇦",
    time: "105 min",
    servings: 6,
    difficulty: "Hard",
    image: "/images/dishes/couscous-seven-vegetables.jpg",
    weatherTip: "Chilly evening · Hearty celebratory feast",
    ingredients: ["Semolina", "Lamb", "Pumpkin", "Zucchini"],
    step: "Steam semolina twice in the couscoussier over simmering vegetable broth.",
    stepTimer: 900,
  },
  {
    slug: "shakshuka",
    name: "Spicy Shakshuka with poached eggs",
    country: "Tunisia",
    flag: "🇹🇳",
    time: "25 min",
    servings: 2,
    difficulty: "Easy",
    image: "/images/dishes/shakshuka.jpg",
    weatherTip: "Quick dinner · High protein comfort",
    ingredients: ["Eggs", "Tomatoes", "Bell pepper", "Harissa"],
    step: "Simmer tomatoes and peppers, create small wells, and gently crack fresh eggs in.",
    stepTimer: 360,
  },
  {
    slug: "harira",
    name: "Velvety Harira soup with chickpeas & lentils",
    country: "Morocco",
    flag: "🇲🇦",
    time: "80 min",
    servings: 6,
    difficulty: "Medium",
    image: "/images/dishes/harira.jpg",
    weatherTip: "Rainy & cold · Traditional warming bowl",
    ingredients: ["Lentils", "Chickpeas", "Tomato", "Coriander"],
    step: "Simmer chickpeas and lentils in rich spiced broth until tender and fragrant.",
    stepTimer: 600,
  },
];

type TilePanelProps = {
  className?: string;
  src?: string;
  alt?: string;
};

/**
 * Interactive Hero Culinary Showcase.
 * Replaces the old geometric logo placeholder with an authentic culinary experience:
 * live weather recommendation, pantry match rating, interactive spin dish switcher,
 * and working cooking mode timer preview.
 */
export function TilePanel({ className }: TilePanelProps) {
  const t = useTranslations("home");
  const [index, setIndex] = useState(0);
  const [cookingMode, setCookingMode] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);

  const currentDish = SHOWCASE_DISHES[index]!;
  const [secondsLeft, setSecondsLeft] = useState(SHOWCASE_DISHES[0]!.stepTimer);

  useEffect(() => {
    if (!timerRunning || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, secondsLeft]);

  const handleNextDish = () => {
    setCookingMode(false);
    setTimerRunning(false);
    const nextIndex = (index + 1) % SHOWCASE_DISHES.length;
    setIndex(nextIndex);
    setSecondsLeft(SHOWCASE_DISHES[nextIndex]!.stepTimer);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "group relative mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border/80 bg-card p-3 shadow-2xl transition-all duration-300 hover:shadow-primary/5 dark:shadow-black/50",
        className,
      )}
    >
      {/* Visual Canvas Area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={currentDish.slug}
          src={currentDish.image}
          alt={currentDish.name}
          width={800}
          height={600}
          loading="eager"
          className="size-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.03]"
        />

        {/* Ambient subtle vignette */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/30"
        />

        {/* Top bar over photo: Live weather adaptation chip */}
        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-medium text-white shadow-md backdrop-blur-md">
            <CloudRainIcon className="size-3.5 text-amber-300" aria-hidden="true" />
            <span>{t("rainyTagline")}</span>
          </div>

          <Badge className="border-0 bg-primary font-semibold text-primary-foreground shadow-sm">
            <SparklesIcon className="me-1 size-3" aria-hidden="true" />
            {t("readyToCook")}
          </Badge>
        </div>

        {/* Floating action controls over photo */}
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <div className="max-w-[75%] space-y-1 text-white">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-200">
              <span>{currentDish.flag}</span>
              <span>{currentDish.country}</span>
              <span>·</span>
              <TimerIcon className="size-3" aria-hidden="true" />
              <span>{currentDish.time}</span>
            </p>
            <h3 className="font-heading text-lg font-bold leading-tight drop-shadow-sm sm:text-xl">
              {currentDish.name}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleNextDish}
            aria-label={t("spinPrompt")}
            title={t("spinPrompt")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-white/30 active:scale-95"
          >
            <DicesIcon className="size-5 transition-transform duration-300 hover:rotate-45" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Interactive Lower Console */}
      <div className="mt-3 flex flex-col gap-3 px-1.5 pb-1">
        {cookingMode ? (
          /* Live Cooking Mode Simulation */
          <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-strong">
                <ChefHatIcon className="size-4" aria-hidden="true" />
                {t("stepCounter")}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                  {formatTime(secondsLeft)}
                </span>
                <button
                  type="button"
                  onClick={() => setTimerRunning((r) => !r)}
                  className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                  aria-label={timerRunning ? t("pauseTimer") : t("resumeTimer")}
                >
                  {timerRunning ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5 fill-current" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setSecondsLeft(currentDish.stepTimer);
                  }}
                  className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-transform hover:scale-105 active:scale-95"
                  aria-label="Reset timer"
                >
                  <RotateCcwIcon className="size-3.5" />
                </button>
              </div>
            </div>

            <p className="text-sm font-medium leading-snug text-foreground text-pretty">{currentDish.step}</p>

            <button
              type="button"
              onClick={() => setCookingMode(false)}
              className="text-xs font-semibold text-primary-strong underline-offset-4 hover:underline"
            >
              ← {t("backToPantry")}
            </button>
          </div>
        ) : (
          /* Pantry Matching Engine */
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-primary-strong">{t("weatherRecommendation")}</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                {t("zeroMissing")}
              </span>
            </div>

            {/* Pantry ingredient pills */}
            <div className="flex flex-wrap gap-1.5">
              {currentDish.ingredients.map((ing) => (
                <span
                  key={ing}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/80 px-2 py-0.5 text-xs text-foreground"
                >
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                  <span>{ing}</span>
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setCookingMode(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-strong underline-offset-4 hover:underline"
              >
                <ChefHatIcon className="size-3.5" aria-hidden="true" />
                <span>{t("testCookingMode")}</span>
                <span>→</span>
              </button>

              <button
                type="button"
                onClick={handleNextDish}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <DicesIcon className="size-3.5" aria-hidden="true" />
                <span>{t("spinPrompt")}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
