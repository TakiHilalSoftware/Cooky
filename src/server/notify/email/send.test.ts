import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as EnvModule from "@/server/env";

const { send, env, warn } = vi.hoisted(() => ({
  send: vi.fn(),
  env: {
    RESEND_API_KEY: "re_test" as string | undefined,
    EMAIL_FROM: "Cooky <hello@cooky.example>" as string | undefined,
  },
  warn: vi.fn(),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
vi.mock("@/server/env", async (importOriginal) => {
  const { emailFromProblem } = await importOriginal<typeof EnvModule>();
  return { env, emailFromProblem };
});
vi.mock("@/server/observability/logger", () => ({ logger: { warn } }));

const { sendEmail } = await import("./send");
const { PermanentJobError } = await import("@/server/outbox/errors");

const email = { subject: "Hi", html: "<p>Hi</p>", text: "Hi" };
/** Resend's real error shape (resend/dist: ErrorResponse). */
const resendError = (name: string, message: string, statusCode: number) => ({
  data: null,
  error: { name, message, statusCode },
});

beforeEach(() => {
  send.mockReset();
  warn.mockReset();
  env.RESEND_API_KEY = "re_test";
  env.EMAIL_FROM = "Cooky <hello@cooky.example>";
});

describe("sendEmail", () => {
  it("doesn't call Resend with a sender it would reject; logs the reason and the email instead", async () => {
    env.EMAIL_FROM = "angel@gmail.com";
    await expect(sendEmail("amina@example.com", email)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("gmail.com"), text: "Hi" }),
      expect.any(String),
    );
  });

  it("logs instead of sending when no API key is set", async () => {
    env.RESEND_API_KEY = undefined;
    await sendEmail("amina@example.com", email);
    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("sends from the configured sender", async () => {
    send.mockResolvedValue({ data: { id: "1" }, error: null });
    await sendEmail("amina@example.com", email);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Cooky <hello@cooky.example>", to: "amina@example.com" }),
    );
  });

  it("marks an unverified sender domain as permanent, with Resend's explanation", async () => {
    send.mockResolvedValue(
      resendError("validation_error", "The gmail.com domain is not verified. Please, add and verify your domain.", 403),
    );
    const failure = sendEmail("amina@example.com", email);
    await expect(failure).rejects.toBeInstanceOf(PermanentJobError);
    await expect(failure).rejects.toThrow("resend validation_error: The gmail.com domain is not verified");
  });

  it.each(["invalid_api_key", "restricted_api_key", "invalid_from_address", "missing_required_field"])(
    "treats %s as permanent",
    async (name) => {
      send.mockResolvedValue(resendError(name, "nope", 400));
      await expect(sendEmail("a@b.co", email)).rejects.toBeInstanceOf(PermanentJobError);
    },
  );

  it.each(["rate_limit_exceeded", "daily_quota_exceeded", "internal_server_error", "application_error"])(
    "lets %s retry later",
    async (name) => {
      send.mockResolvedValue(resendError(name, "later", 429));
      const failure = sendEmail("a@b.co", email);
      await expect(failure).rejects.toThrow(`resend ${name}`);
      await expect(failure).rejects.not.toBeInstanceOf(PermanentJobError);
    },
  );
});
