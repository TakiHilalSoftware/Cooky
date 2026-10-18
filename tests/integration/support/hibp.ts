import { createHash } from "node:crypto";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/** Passwords the fake Have I Been Pwned API reports as breached. */
export const BREACHED_PASSWORD = "password123breached";

const breachedHash = createHash("sha1").update(BREACHED_PASSWORD).digest("hex").toUpperCase();

/** k-anonymity range API: answers with suffixes for the 5-char prefix. */
export const hibp = setupServer(
  http.get("https://api.pwnedpasswords.com/range/:prefix", ({ params }) => {
    const prefix = String(params.prefix).toUpperCase();
    const body = breachedHash.startsWith(prefix)
      ? `${breachedHash.slice(5)}:12345\r\n`
      : "0000000000000000000000000000000000A:1\r\n";
    return HttpResponse.text(body);
  }),
);
