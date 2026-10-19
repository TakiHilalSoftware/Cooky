import "server-only";

import type { AssistantPick } from "@/server/db/schema";

// Turning the model's answer into safe picks (ARCHITECTURE §5.8). Pure: unit-tested.

/** The model only ever sees short aliases ("m3", "d12"); this maps them back. */
export type AliasMap = Map<string, { kind: "mine"; dishId: string } | { kind: "discover"; slug: string }>;

/** Known aliases only (anything invented is dropped), each dish once, at most three. */
export function toPicks(picks: { id: string; why: string }[], aliases: AliasMap): AssistantPick[] {
  const seen = new Set<string>();
  const out: AssistantPick[] = [];
  for (const pick of picks) {
    const target = aliases.get(pick.id.trim().toLowerCase());
    if (!target) continue;
    const key = target.kind === "mine" ? `m:${target.dishId}` : `d:${target.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const why = pick.why.trim().slice(0, 240);
    out.push(
      target.kind === "mine"
        ? { kind: "mine", dishId: target.dishId, why }
        : { kind: "discover", slug: target.slug, why },
    );
    if (out.length === 3) break;
  }
  return out;
}

/** A thread is listed by its first question, cut at a word near 60 characters. */
export function threadTitle(question: string): string {
  const text = question.replace(/\s+/g, " ").trim();
  if (text.length <= 60) return text;
  const cut = text.slice(0, 60);
  const space = cut.lastIndexOf(" ");
  return `${(space > 30 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Words worth matching against dish names and ingredients (3+ letters). */
export function questionWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length >= 3),
    ),
  ];
}
