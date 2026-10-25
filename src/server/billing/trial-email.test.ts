import { describe, expect, it } from "vitest";

import { trialInbox } from "./trial-email";

describe("trialInbox", () => {
  it("ignores case and surrounding spaces", () => {
    expect(trialInbox("  Amina@Example.COM ")).toBe("amina@example.com");
  });

  it("treats +tags as the same inbox", () => {
    expect(trialInbox("amina+trial2@example.com")).toBe("amina@example.com");
    expect(trialInbox("amina+a+b@example.com")).toBe("amina@example.com");
  });

  it("ignores dots on Gmail, and googlemail.com is Gmail", () => {
    expect(trialInbox("a.m.i.n.a@gmail.com")).toBe("amina@gmail.com");
    expect(trialInbox("A.Mina+x@googlemail.com")).toBe("amina@gmail.com");
  });

  it("keeps dots where the provider treats them as different inboxes", () => {
    expect(trialInbox("a.mina@example.com")).toBe("a.mina@example.com");
  });

  it("leaves something that isn't an address as typed (lowercased)", () => {
    expect(trialInbox("NotAnEmail")).toBe("notanemail");
  });
});
