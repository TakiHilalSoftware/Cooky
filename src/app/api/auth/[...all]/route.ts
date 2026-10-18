import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth/auth";

// Better Auth's own endpoints: email links, OAuth callbacks (AGENT_RULES §1).
export const { GET, POST } = toNextJsHandler(auth);
