// What the UI may know about recipe backups. Types only: safe for the UI.

export type BackupExportDto = { filename: string; content: string };

/** Why a file couldn't be imported, in words the UI explains. */
export type BackupProblem = "not_json" | "wrong_format" | "too_many" | "too_large" | "empty";

export type ImportBackupResult =
  | { status: "queued"; total: number }
  | { status: "invalid"; problem: BackupProblem }
  /** An import is already running for this account. */
  | { status: "busy" };

export type BackupImportDto = {
  status: "queued" | "running" | "done" | "failed";
  total: number;
  imported: number;
  skipped: { duplicate: number; full: number; invalid: number };
  createdAt: string;
};

export type BackupOverviewDto = {
  dishCount: number;
  /** Import is a paid feature (`plan_limits.backup_import`). */
  canImport: boolean;
  latestImport: BackupImportDto | null;
};
