import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Phase 0 exit criterion (docs/ROADMAP.md): "a deliberate boundary violation
 * fails lint". Lints in-memory files with the project's real ESLint config.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));

// Targets that only exist once later phases ship real actions and DTOs.
const PROBES = {
  action: "src/server/actions/boundary-probe.ts",
  dto: "src/server/features/__boundary_probe__/dto.ts",
};

const eslint = new ESLint({ cwd: root });

async function boundaryErrors(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(root, file) });
  return (result?.messages ?? []).filter((m) => m.ruleId === "boundaries/dependencies").map((m) => m.message);
}

// Folders this test had to create, removed again so it leaves no trace.
const createdDirs: string[] = [];

beforeAll(() => {
  for (const file of Object.values(PROBES)) {
    const created = mkdirSync(dirname(join(root, file)), { recursive: true });
    if (created) createdDirs.push(created);
  }
  writeFileSync(join(root, PROBES.action), '"use server";\nexport async function probe() {}\n');
  writeFileSync(join(root, PROBES.dto), "export type ProbeDto = { id: string };\nexport const probeDto = 1;\n");
});

afterAll(() => {
  for (const file of Object.values(PROBES)) rmSync(join(root, file), { force: true });
  for (const dir of createdDirs) if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

const COMPONENT = "src/components/probe/probe.tsx";
const LIB = "src/lib/probe.ts";

describe("server/client boundary", () => {
  it.each([
    ["the database client", 'import { getDb } from "@/server/db/client";\nexport const x = getDb;\n'],
    ["server env", 'import { env } from "@/server/env";\nexport const x = env;\n'],
    ["the logger", 'import { logger } from "@/server/observability/logger";\nexport const x = logger;\n'],
    [
      "the action clients",
      'import { publicAction } from "@/server/actions/_clients";\nexport const x = publicAction;\n',
    ],
    [
      "a DTO module's runtime values",
      'import { probeDto } from "@/server/features/__boundary_probe__/dto";\nexport const x = probeDto;\n',
    ],
  ])("fails when a component imports %s", async (_what, code) => {
    expect(await boundaryErrors(COMPONENT, code)).not.toEqual([]);
  });

  it("fails when lib imports server code", async () => {
    expect(await boundaryErrors(LIB, 'import { env } from "@/server/env";\nexport const x = env;\n')).not.toEqual([]);
  });

  it("fails when lib imports UI", async () => {
    const code = 'import { Button } from "@/components/ui/button";\nexport const x = Button;\n';
    expect(await boundaryErrors(LIB, code)).not.toEqual([]);
  });

  it.each([
    [
      "a Server Action entry file",
      'import { probe } from "@/server/actions/boundary-probe";\nexport const x = probe;\n',
    ],
    [
      "DTO types",
      'import type { ProbeDto } from "@/server/features/__boundary_probe__/dto";\nexport type X = ProbeDto;\n',
    ],
    ["lib helpers", 'import { cn } from "@/lib/utils";\nexport const x = cn;\n'],
    ["UI primitives", 'import { Button } from "@/components/ui/button";\nexport const x = Button;\n'],
  ])("passes when a component imports %s", async (_what, code) => {
    expect(await boundaryErrors(COMPONENT, code)).toEqual([]);
  });

  it("lets routes read from the server (pages await queries)", async () => {
    const code = 'import { env } from "@/server/env";\nexport const x = env;\n';
    expect(await boundaryErrors("src/app/[locale]/probe/page.tsx", code)).toEqual([]);
  });
});
