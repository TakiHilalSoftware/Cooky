import "server-only";

import pino from "pino";

import { env } from "@/server/env";

/**
 * Structured server logger. Anything that may identify a person is redacted
 * at the source, so a careless `logger.info({ user })` can't leak PII.
 */
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  base: { service: "cooky" },
  redact: {
    paths: [
      "email",
      "*.email",
      "password",
      "*.password",
      "token",
      "*.token",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
      "headers.cookie",
      "headers.authorization",
    ],
    censor: "[redacted]",
  },
});
