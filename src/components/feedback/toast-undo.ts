import { toast } from "sonner";

/** PRD §3.10: reversible deletes happen at once and offer Undo for 6 seconds. */
export const UNDO_WINDOW_MS = 6000;

type UndoToastOptions = {
  undoLabel: string;
  onUndo: () => void;
};

export function toastUndo(message: string, { undoLabel, onUndo }: UndoToastOptions) {
  return toast(message, {
    duration: UNDO_WINDOW_MS,
    action: { label: undoLabel, onClick: onUndo },
  });
}
