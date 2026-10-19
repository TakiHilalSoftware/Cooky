import "server-only";

import type { Unit } from "@/lib/dishes";

// Turns a written ingredient line ("2 cups flour, sifted", "500 g de poulet",
// "ملعقتان كبيرتان زيت") into the dish form's fields. Used by the link import
// and voice dictation. Pure: unit-tested.

export type ParsedIngredient = { name: string; amount: number | null; unit: Unit | null; note: string | null };

const VULGAR: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125 };

/** Unit words in EN/FR/AR (matched after lowercasing). */
const UNIT_WORDS: [Unit, string[]][] = [
  [
    "kg",
    ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms", "kilogramme", "kilogrammes", "كغ", "كيلو", "كيلوغرام"],
  ],
  ["g", ["g", "gr", "grs", "gram", "grams", "gramme", "grammes", "غ", "غرام", "جرام"]],
  ["ml", ["ml", "millilitre", "millilitres", "milliliter", "milliliters", "مل"]],
  ["cl", ["cl", "centilitre", "centilitres"]],
  ["l", ["l", "litre", "litres", "liter", "liters", "لتر"]],
  [
    "tbsp",
    [
      "tbsp",
      "tbs",
      "tablespoon",
      "tablespoons",
      "c. à s.",
      "c.à.s.",
      "càs",
      "cuillère à soupe",
      "cuillères à soupe",
      "ملعقة كبيرة",
      "ملاعق كبيرة",
      "ملعقتان كبيرتان",
    ],
  ],
  [
    "tsp",
    [
      "tsp",
      "teaspoon",
      "teaspoons",
      "c. à c.",
      "c.à.c.",
      "càc",
      "cuillère à café",
      "cuillères à café",
      "ملعقة صغيرة",
      "ملاعق صغيرة",
      "ملعقتان صغيرتان",
    ],
  ],
  ["cup", ["cup", "cups", "tasse", "tasses", "verre", "verres", "كوب", "أكواب", "كوبان"]],
  ["oz", ["oz", "ounce", "ounces", "once", "onces"]],
  ["lb", ["lb", "lbs", "pound", "pounds", "livre", "livres"]],
  ["pinch", ["pinch", "pinches", "pincée", "pincées", "رشة", "رشات"]],
  ["clove", ["clove", "cloves", "gousse", "gousses", "فص", "فصوص", "فصان"]],
  ["bunch", ["bunch", "bunches", "botte", "bottes", "bouquet", "حزمة", "حزم", "باقة"]],
  ["slice", ["slice", "slices", "tranche", "tranches", "شريحة", "شرائح"]],
  ["can", ["can", "cans", "tin", "tins", "boîte", "boîtes", "conserve", "علبة", "علب"]],
  ["piece", ["piece", "pieces", "pc", "pcs", "pièce", "pièces", "حبة", "حبات", "حبتان"]],
];

/** Arabic dual forms carry their own number. */
const DUAL = new Set(["ملعقتان", "كوبان", "فصان", "حبتان"]);

/** Longest first, so "c. à s." wins over "c" and "cuillère à soupe" over "cuillère". */
const UNIT_INDEX = UNIT_WORDS.flatMap(([unit, words]) => words.map((word) => ({ unit, word }))).sort(
  (a, b) => b.word.length - a.word.length,
);

const TO_TASTE = /\b(to taste|as needed|au goût|selon le goût|à volonté)\b|حسب الرغبة|حسب الذوق/i;

/** A comma (Latin or Arabic) that isn't a decimal separator ("0,5 l"). */
const NOTE_COMMA = /(?<!\d)[,،]|[,،](?!\d)/;

/** A range ("2-3", "2 à 3") counts as its first number. */
const RANGE = String.raw`(?:\s*[-–]\s*\d+(?:[.,]\d+)?|\s+(?:à|to|إلى)\s+\d+(?:[.,]\d+)?)?`;
const MIXED = new RegExp(String.raw`^(\d+)\s+(\d+)\/(\d+)` + RANGE + String.raw`\s*`);
const FRACTION = new RegExp(String.raw`^(\d+)\/(\d+)` + RANGE + String.raw`\s*`);
const PLAIN = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)?\s*([½⅓⅔¼¾⅛])?` + RANGE + String.raw`\s*`, "u");

const round = (n: number) => Math.round(n * 1000) / 1000;

function arabicDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/٫/g, ".");
}

/** "1 1/2", "1/2", "1½", "0,5", "2-3": the number at the start, and the rest. */
function leadingAmount(text: string): { amount: number | null; rest: string } {
  const mixed = text.match(MIXED);
  if (mixed) {
    return { amount: round(Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])), rest: text.slice(mixed[0].length) };
  }
  const fraction = text.match(FRACTION);
  if (fraction)
    return { amount: round(Number(fraction[1]) / Number(fraction[2])), rest: text.slice(fraction[0].length) };
  const plain = text.match(PLAIN);
  if (!plain || (!plain[1] && !plain[2])) return { amount: null, rest: text };
  const whole = plain[1] ? Number(plain[1].replace(",", ".")) : 0;
  return { amount: round(whole + (plain[2] ? VULGAR[plain[2]]! : 0)), rest: text.slice(plain[0].length) };
}

function leadingUnit(text: string): { unit: Unit | null; rest: string; dual: boolean } {
  const lower = text.toLowerCase();
  for (const { unit, word } of UNIT_INDEX) {
    if (!lower.startsWith(word)) continue;
    const after = text.slice(word.length);
    // A whole word only: "g" mustn't eat the start of "garlic".
    if (after && /^[\p{L}\p{N}]/u.test(after)) continue;
    return { unit, rest: after.replace(/^[\s.]*/, ""), dual: DUAL.has(word.split(" ")[0]!) };
  }
  return { unit: null, rest: text, dual: false };
}

export function parseIngredientLine(raw: string): ParsedIngredient {
  let text = arabicDigits(raw).replace(/\s+/g, " ").trim();
  const toTaste = TO_TASTE.test(text);
  if (toTaste)
    text = text
      .replace(TO_TASTE, "")
      .replace(/[\s,،]+$/, "")
      .trim();

  // Notes in brackets, nested or not: "beef (chopped (shank or chuck))", "flour (sifted)".
  const brackets = takeBrackets(text);
  text = brackets.rest;
  let note: string | null = brackets.notes.join(", ") || null;
  const comma = text.search(NOTE_COMMA);
  if (comma > 0) {
    const after = text.slice(comma + 1).trim();
    text = text.slice(0, comma).trim();
    note = [after, note].filter(Boolean).join(", ") || null;
  }

  const parsed = leadingAmount(text);
  let amount = parsed.amount;
  const unitPart = leadingUnit(parsed.rest);
  let unit = unitPart.unit;
  // "ملعقتان كبيرتان": the dual form is the number.
  if (amount === null && unitPart.dual) amount = 2;
  if (toTaste) {
    amount = null;
    unit = null;
  }
  // A second measure after a slash ("600 g / 1.2lb chicken") is a note, not part of the name.
  let rest = unitPart.rest;
  const alternate = rest.match(ALTERNATE_MEASURE);
  if (alternate) {
    rest = rest.slice(alternate[0].length);
    note = [alternate[1]!.trim(), note].filter(Boolean).join(", ");
  }
  // "500 g de poulet", "2 c. à s. d'huile": drop the French "de"/"d'" (and "of").
  const name = rest.replace(/^(de |d'|d’|of )/i, "").trim();
  return { name: name || raw.trim(), amount, unit, note };
}

/** "/ 1.2lb ", "/ 2 cups ": an alternative measure right after the first one. */
const ALTERNATE_MEASURE = /^\/\s*([\d.,½¼¾⅓⅔]+\s*[\p{L}.]*)\s*/u;

/** Top-level bracket groups (with any nested ones inside) taken out as notes. */
function takeBrackets(text: string): { rest: string; notes: string[] } {
  const notes: string[] = [];
  let rest = "";
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") {
      if (depth > 0) current += char;
      depth++;
    } else if (char === ")" && depth > 0) {
      depth--;
      if (depth === 0) {
        const note = current.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
        if (note) notes.push(note);
        current = "";
      } else current += char;
    } else if (depth > 0) current += char;
    else rest += char;
  }
  // An unclosed bracket: keep what was inside as a note rather than losing it.
  if (current.trim()) notes.push(current.replace(/[()]/g, "").trim());
  return { rest: rest.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim(), notes };
}

/** Splits dictated or pasted text into ingredient lines ("2 potatoes, 500 g of chicken and salt"). */
export function splitIngredientText(text: string): string[] {
  return arabicDigits(text)
    .split(/\n|;|،|(?<!\d),|,(?!\d)|\band\b|\bet\b|\sو(?=\s)/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}
