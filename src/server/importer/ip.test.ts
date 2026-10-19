import { describe, expect, it } from "vitest";

import { isPublicAddress } from "./ip";

describe("isPublicAddress", () => {
  it.each(["93.184.216.34", "8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2a00:1450:4007:80c::200e"])(
    "allows the public address %s",
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );

  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.10",
    "169.254.169.254", // cloud metadata
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "fc00::abcd",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "64:ff9b::a00:1",
    "2001:db8::1",
  ])("blocks the internal or reserved address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it("treats anything that isn't an IP as not public", () => {
    expect(isPublicAddress("localhost")).toBe(false);
    expect(isPublicAddress("999.1.1.1")).toBe(false);
  });

  it("judges an IPv4-mapped IPv6 by the IPv4 inside", () => {
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
  });
});
