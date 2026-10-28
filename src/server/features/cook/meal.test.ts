import { describe, expect, it } from "vitest";

import { DEFAULT_MEAL_TIMES, type MealTimes } from "@/lib/meal-times";

import { MEAL_GRACE_MINUTES, mealMoment, mealsOfDay, nextMeal } from "./meal";

const at = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return h! * 60 + m!;
};
const clock = (time: string, today = "2026-10-28") => ({ today, minutes: at(time) });
// Breakfast 08:00, lunch 12:30, snack 16:30, dinner 19:30.
const day = DEFAULT_MEAL_TIMES;

describe("nextMeal", () => {
  it("suggests lunch mid-morning, with how long until it", () => {
    expect(nextMeal(day, clock("10:00"))).toEqual({
      slot: "lunch",
      at: at("12:30"),
      date: "2026-10-28",
      when: "later",
      inMinutes: 150,
    });
  });

  it("keeps a meal for a while after its time: they may be cooking or just sitting down", () => {
    expect(nextMeal(day, clock("12:30"))).toMatchObject({ slot: "lunch", when: "now", inMinutes: 0 });
    expect(nextMeal(day, clock("13:14"))).toMatchObject({ slot: "lunch", when: "now" });
    // Once the grace is over, the afternoon snack is next.
    expect(nextMeal(day, clock("13:15"))).toMatchObject({ slot: "snack", when: "later", inMinutes: 195 });
  });

  it("after the last meal, it's tomorrow's first one, on tomorrow's date", () => {
    expect(nextMeal(day, clock("22:00"))).toEqual({
      slot: "breakfast",
      at: at("08:00"),
      date: "2026-10-29",
      when: "tomorrow",
      inMinutes: 600,
    });
  });

  it("rolls over the month end", () => {
    expect(nextMeal(day, clock("23:30", "2026-10-31"))?.date).toBe("2026-11-01");
  });

  it("before breakfast, breakfast is next today", () => {
    expect(nextMeal(day, clock("05:00"))).toMatchObject({ slot: "breakfast", when: "later", date: "2026-10-28" });
  });

  it("skips meals the person doesn't have", () => {
    const noSnack: MealTimes = { ...day, snack: null };
    expect(nextMeal(noSnack, clock("14:00"))).toMatchObject({ slot: "dinner" });
  });

  it("follows the person's own clock, not the usual order (a late lunch after a snack)", () => {
    const late: MealTimes = { breakfast: null, snack: at("11:00"), lunch: at("15:00"), dinner: at("21:00") };
    expect(nextMeal(late, clock("10:00"))).toMatchObject({ slot: "snack" });
    expect(nextMeal(late, clock("12:00"))).toMatchObject({ slot: "lunch" });
  });

  it("is null when every meal is switched off: Cook simply ranks as before", () => {
    expect(nextMeal({ breakfast: null, lunch: null, snack: null, dinner: null }, clock("12:00"))).toBeNull();
  });

  it("with a single meal, it's today's until it passes, then tomorrow's", () => {
    const one: MealTimes = { breakfast: null, lunch: null, snack: null, dinner: at("20:00") };
    expect(nextMeal(one, clock("09:00"))).toMatchObject({ slot: "dinner", when: "later" });
    expect(nextMeal(one, clock("21:00"))).toMatchObject({ slot: "dinner", when: "tomorrow", inMinutes: 23 * 60 });
  });
});

describe("mealMoment", () => {
  it("a meal picked by hand is today's if it hasn't passed", () => {
    expect(mealMoment("dinner", day, clock("10:00"))).toMatchObject({ when: "later", date: "2026-10-28" });
  });

  it("and tomorrow's once it has (breakfast picked in the afternoon)", () => {
    expect(mealMoment("breakfast", day, clock("15:00"))).toMatchObject({ when: "tomorrow", date: "2026-10-29" });
  });

  it("is null for a meal the person skips", () => {
    expect(mealMoment("snack", { ...day, snack: null }, clock("10:00"))).toBeNull();
  });

  it("the grace is exactly MEAL_GRACE_MINUTES", () => {
    const lunch = at("12:30");
    expect(mealMoment("lunch", day, { today: "2026-10-28", minutes: lunch + MEAL_GRACE_MINUTES - 1 })?.when).toBe(
      "now",
    );
    expect(mealMoment("lunch", day, { today: "2026-10-28", minutes: lunch + MEAL_GRACE_MINUTES })?.when).toBe(
      "tomorrow",
    );
  });
});

describe("mealsOfDay", () => {
  it("orders meals by time and leaves out skipped ones", () => {
    expect(mealsOfDay({ ...day, breakfast: null }).map((m) => m.slot)).toEqual(["lunch", "snack", "dinner"]);
  });

  it("keeps the usual order for two meals at the same time", () => {
    const same: MealTimes = { breakfast: null, lunch: at("13:00"), snack: at("13:00"), dinner: null };
    expect(mealsOfDay(same).map((m) => m.slot)).toEqual(["lunch", "snack"]);
  });
});
