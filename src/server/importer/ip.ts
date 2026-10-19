import "server-only";

import { isIP } from "node:net";

// Which addresses the link importer may connect to (AGENT_RULES §4: outbound
// fetches from user input go through server/importer). Pure: unit-tested.

function ipv4ToNumber(ip: string): number {
  return ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
}

/** Private, loopback, link-local, CGNAT, multicast, reserved and documentation ranges. */
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function inV4Range(ip: string, [base, bits]: [string, number]): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToNumber(ip) & mask) >>> 0 === (ipv4ToNumber(base) & mask) >>> 0;
}

/** Expands an IPv6 address to 8 groups of 16 bits. */
function ipv6Groups(ip: string): number[] {
  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const parse = (part: string) => (part ? part.split(":") : []);
  let left = parse(head);
  let right = parse(tail);
  // An embedded IPv4 (::ffff:1.2.3.4) counts as two groups.
  const embed = (groups: string[]) =>
    groups.flatMap((g) => {
      if (!g.includes(".")) return [g];
      const n = ipv4ToNumber(g);
      return [((n >>> 16) & 0xffff).toString(16), (n & 0xffff).toString(16)];
    });
  left = embed(left);
  right = embed(right);
  const missing = ip.includes("::") ? 8 - left.length - right.length : 0;
  return [...left, ...Array<string>(missing).fill("0"), ...right].map((g) => parseInt(g, 16));
}

/** True only for addresses on the public internet. */
export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return !BLOCKED_V4.some((range) => inV4Range(ip, range));
  if (version !== 6) return false;
  const g = ipv6Groups(ip);
  if (g.length !== 8 || g.some((n) => Number.isNaN(n))) return false;
  if (g.every((n) => n === 0)) return false; // ::
  if (g.slice(0, 7).every((n) => n === 0) && g[7] === 1) return false; // ::1
  // IPv4-mapped (::ffff:a.b.c.d): judge the IPv4 inside.
  if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) {
    const v4 = `${g[6]! >> 8}.${g[6]! & 255}.${g[7]! >> 8}.${g[7]! & 255}`;
    return isPublicAddress(v4);
  }
  const first = g[0]!;
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return false; // ff00::/8 multicast
  if (first === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (first === 0x0064 && g[1] === 0xff9b) return false; // NAT64 (could reach private v4)
  return true;
}
