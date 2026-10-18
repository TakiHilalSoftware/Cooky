import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HANDLED_EVENTS } from "./events";

const quoted = (text: string) => [...text.matchAll(/"([a-z_]+(?:\.[a-z_]+)+)"/g)].map((m) => m[1]);

describe("Stripe webhook events", () => {
  it("are exactly what local forwarding subscribes to", () => {
    const script = readFileSync("scripts/stripe-listen.mjs", "utf8");
    const list = script.slice(script.indexOf("const EVENTS"), script.indexOf("];", script.indexOf("const EVENTS")));
    expect(quoted(list)).toEqual([...HANDLED_EVENTS]);
  });

  it("are all listed in the setup guide for the dashboard endpoint", () => {
    const guide = readFileSync("docs/SETUP_KEYS.md", "utf8");
    const line = guide.split("\n").find((l) => l.includes("/api/webhooks/stripe") && l.includes("events")) ?? "";
    const expanded = line.replace(/customer\.subscription\.([a-z_|]+)/, (_, names: string) =>
      names
        .split("|")
        .map((n) => `customer.subscription.${n}`)
        .join(" "),
    );
    for (const event of HANDLED_EVENTS) expect(expanded).toContain(event);
  });
});
