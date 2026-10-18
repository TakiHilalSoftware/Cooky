// Runs before any app module loads: point the app at the test database and
// keep every third-party integration in its local fallback.
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides TEST_DATABASE_URL directly.
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL;
process.env.BETTER_AUTH_SECRET = "integration-test-secret-integration-test-secret";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
for (const key of [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "APPLE_CLIENT_ID",
  "APPLE_CLIENT_SECRET",
  "STRIPE_AUTOMATIC_TAX",
]) {
  delete process.env[key];
}

// Google sign-in runs for real against a mocked token endpoint (tests/integration/support/google.ts).
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";

// Stripe runs for real against an in-memory fake API (tests/integration/support/stripe.ts).
process.env.STRIPE_SECRET_KEY = "sk_test_integration";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_integration";
process.env.CRON_SECRET = "integration-cron-secret-0123456789abcdef";
