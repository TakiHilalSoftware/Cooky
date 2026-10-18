// No `import "server-only"` here: next.config.ts loads this module at build
// time, outside React's server graph. It holds no secrets, only policy strings.

type CspOptions = {
  nonce: string;
  isDev: boolean;
  /** Pusher cluster, e.g. "eu". Opens only that cluster's socket hosts. */
  pusherCluster?: string;
  /** Extra image hosts, e.g. the R2 signed-URL host once uploads ship. */
  imageHosts?: readonly string[];
};

/**
 * Builds the per-request Content Security Policy.
 *
 * Scripts are locked to the nonce ('strict-dynamic'), so injected markup can't
 * run code. Styles allow 'unsafe-inline' because Radix positions popovers with
 * style attributes and sonner injects its stylesheet at runtime; style
 * injection can't execute code, so the trade-off is accepted.
 */
export function buildCsp({ nonce, isDev, pusherCluster, imageHosts = [] }: CspOptions): string {
  const connect = ["'self'"];
  if (pusherCluster) {
    connect.push(`wss://ws-${pusherCluster}.pusher.com`, `https://sockjs-${pusherCluster}.pusher.com`);
  }
  // React's dev overlay reconstructs server stacks with eval; never in production.
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": script,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", ...imageHosts],
    "font-src": ["'self'"],
    "connect-src": connect,
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Headers that never change per request, applied from next.config.ts. */
export function staticSecurityHeaders(): { key: string; value: string }[] {
  return [
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      // Microphone and geolocation stay available to Cooky itself (voice
      // dictation, "use my location"); everything else is switched off.
      value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), browsing-topics=()",
    },
  ];
}
