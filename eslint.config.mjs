import boundaries from "eslint-plugin-boundaries";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Server/client boundary (docs/ARCHITECTURE.md §3, "Enforcement"):
 * UI code (components, lib) may reach the server only through Server Action
 * entry files and type-only imports of `dto.ts`. Everything else in
 * src/server stays out of client bundles.
 */
const boundaryRules = {
  plugins: { boundaries },
  settings: {
    "import/resolver": { typescript: { alwaysTryTypes: true } },
    "boundaries/include": ["src/**/*"],
    "boundaries/elements": [
      { type: "server-actions", pattern: "src/server/actions" },
      { type: "server", pattern: "src/server" },
      { type: "component", pattern: "src/components" },
      { type: "lib", pattern: "src/lib" },
      { type: "i18n", pattern: "src/i18n" },
      { type: "app", pattern: "src/app" },
    ],
    "boundaries/files": [
      { category: "dto", pattern: "src/server/**/dto.ts" },
      // Zod input schemas double as form hints (PROJECT_STRUCTURE: "shared with forms").
      { category: "schema", pattern: "src/server/features/*/schema.ts" },
      // _clients.ts and friends build actions; only the action entry files are public.
      { category: "action-internals", pattern: "src/server/actions/_*.ts" },
    ],
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "allow",
        policies: [
          {
            from: { element: { types: ["component", "lib", "i18n"] } },
            disallow: { to: { element: { types: ["server", "server-actions"] } } },
            message:
              "UI code may only import Server Actions (src/server/actions/*), DTO types (src/server/**/dto.ts) and input schemas (src/server/features/*/schema.ts).",
          },
          {
            from: { element: { type: "component" } },
            allow: { to: { element: { type: "server-actions" } } },
          },
          {
            from: { element: { type: "component" } },
            allow: { to: { file: { categories: "dto" } }, dependency: { kind: "type" } },
          },
          {
            from: { element: { type: "component" } },
            allow: { to: { file: { categories: "schema" } } },
          },
          {
            from: { element: { types: ["component", "lib", "i18n"] } },
            disallow: { to: { file: { categories: "action-internals" } } },
            message: "Import a Server Action entry file, not the action clients that build it.",
          },
          {
            from: { element: { type: "lib" } },
            disallow: { to: { element: { types: ["component", "app"] } } },
            message: "src/lib holds side-effect-free helpers; it must not depend on UI or routes.",
          },
        ],
      },
    ],
  },
};

const strictTypeScript = {
  files: ["**/*.{ts,tsx}"],
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],
    "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  },
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  boundaryRules,
  strictTypeScript,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "drizzle/**",
    "next-env.d.ts",
  ]),
]);
