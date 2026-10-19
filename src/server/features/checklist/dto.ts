// The first-week checklist (PRD §3.1). Types only: safe for the UI.

export const CHECKLIST_STEPS = ["dishes", "kitchen", "cook", "plan", "friend"] as const;
export type ChecklistStep = (typeof CHECKLIST_STEPS)[number];

export type ChecklistDto = {
  /** Each step and whether the person has done it (decided by the server from their data). */
  steps: { step: ChecklistStep; done: boolean }[];
};
