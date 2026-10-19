import {
  BookOpenIcon,
  CalendarDaysIcon,
  ChefHatIcon,
  ClipboardListIcon,
  DicesIcon,
  MessageCircleQuestionIcon,
  ShoppingBasketIcon,
  TimerIcon,
} from "lucide-react";

/**
 * The eight things Cooky does (PRD §3.0), in landing-page order. `available`
 * flips on as each page ships, so the landing page never links to a page
 * that doesn't exist yet.
 */
export const FEATURES = [
  { key: "dishes", href: "/dishes", icon: BookOpenIcon, available: true },
  { key: "cook", href: "/cook", icon: ChefHatIcon, available: true },
  { key: "spin", href: "/spin", icon: DicesIcon, available: true },
  { key: "calendar", href: "/calendar", icon: CalendarDaysIcon, available: true },
  { key: "planner", href: "/planner", icon: ClipboardListIcon, available: true },
  { key: "timer", href: "/timer", icon: TimerIcon, available: true },
  { key: "shopping", href: "/shopping", icon: ShoppingBasketIcon, available: true },
  { key: "assistant", href: "/assistant", icon: MessageCircleQuestionIcon, available: true },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];
