import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";

/**
 * Builds a fresh `cooky_test` database from the committed migrations, so the
 * integration suite proves the migrations themselves, not just the code.
 */
export default async function setup() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI provides TEST_DATABASE_URL directly.
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example).");

  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(dbName))
    throw new Error(`Refusing to reset "${dbName}": test databases must end in _test.`);

  const admin = new Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).toString() });
  await admin.connect();
  const exists = await admin.query("select 1 from pg_database where datname = $1", [dbName]);
  if (exists.rowCount === 0) await admin.query(`create database "${dbName}"`);
  await admin.end();

  const pool = new Pool({ connectionString: url });
  await pool.query(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });

  // Tier limits from the same table pnpm db:seed uses (one source of truth).
  const { LIMITS } = await import("../../../scripts/seed-plan-limits");
  for (const [plan, features] of Object.entries(LIMITS)) {
    for (const [feature, row] of Object.entries(features)) {
      await pool.query(
        'insert into plan_limits (plan, feature, "limit", period) values ($1, $2, $3, $4) on conflict (plan, feature) do update set "limit" = excluded."limit", period = excluded.period',
        [plan, feature, row.limit, row.period],
      );
    }
  }

  // The ingredient dictionary, from the same list pnpm db:seed:ingredients uses.
  const { STAPLES } = await import("../../../scripts/seed-ingredients");
  const { searchTextFor } = await import("../../../src/server/features/ingredients/service");
  for (const s of STAPLES) {
    await pool.query(
      "insert into ingredients (id, slug, name_en, name_fr, name_ar, variants, aisle, default_unit, is_common_staple, search) values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [s.slug, s.nameEn, s.nameFr, s.nameAr, s.variants, s.aisle, s.defaultUnit, s.isCommonStaple, searchTextFor(s)],
    );
  }
  await pool.end();
}
