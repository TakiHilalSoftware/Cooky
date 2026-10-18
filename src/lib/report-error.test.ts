import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ init: vi.fn(), captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);

async function load(dsn: string) {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
  vi.resetModules();
  return import("./report-error");
}

beforeEach(() => {
  sentry.init.mockClear();
  sentry.captureException.mockClear();
});

describe("reportClientError", () => {
  it("never loads the Sentry SDK while no DSN is configured", async () => {
    const { reportClientError, initClientErrorTracking } = await load("");
    initClientErrorTracking();
    reportClientError(new Error("boom"));
    await vi.dynamicImportSettled();
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("initialises once, privacy-first, and reports when a DSN is set", async () => {
    const { reportClientError, initClientErrorTracking } = await load("https://key@o1.ingest.sentry.io/1");
    initClientErrorTracking();
    const error = new Error("boom");
    reportClientError(error);
    await vi.waitFor(() => expect(sentry.captureException).toHaveBeenCalledWith(error));
    expect(sentry.init).toHaveBeenCalledOnce();
    expect(sentry.init.mock.calls[0]?.[0]).toMatchObject({ dataCollection: { userInfo: false, cookies: false } });
  });
});
