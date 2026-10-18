"use client";

import dynamic from "next/dynamic";
import { useAction } from "next-safe-action/hooks";
import { createContext, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import type { PlanFeature } from "@/lib/plan-features";
import { getUpgradeOffer } from "@/server/actions/billing";

import type { UpgradeRequest, UpgradeSheetState } from "./upgrade-sheet";

// Loaded on first use, so pages that never hit a limit don't ship the sheet.
const UpgradeSheet = dynamic(() => import("./upgrade-sheet").then((m) => m.UpgradeSheet));

const OpenUpgradeContext = createContext<((request: UpgradeRequest) => void) | null>(null);

/** One upgrade sheet for the whole app (PRD §3.10: one dialog/sheet component). */
export function UpgradeSheetProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<UpgradeRequest | null>(null);
  const [open, setOpen] = useState(false);
  const offer = useAction(getUpgradeOffer);

  function load(feature: PlanFeature) {
    offer.reset();
    offer.execute({ feature });
  }

  function show(next: UpgradeRequest) {
    setRequest(next);
    setOpen(true);
    load(next.feature);
  }

  const state: UpgradeSheetState = offer.result.data
    ? { status: "ready", offer: offer.result.data }
    : offer.hasErrored
      ? { status: "error" }
      : { status: "loading" };

  return (
    <OpenUpgradeContext.Provider value={show}>
      {children}
      {request ? (
        <UpgradeSheet
          request={request}
          state={state}
          open={open}
          onOpenChange={setOpen}
          onRetry={() => load(request.feature)}
        />
      ) : null}
    </OpenUpgradeContext.Provider>
  );
}

/** Opens the upgrade sheet for a feature, e.g. from a "Get more" button. */
export function useUpgradeSheet() {
  const open = useContext(OpenUpgradeContext);
  if (!open) throw new Error("useUpgradeSheet needs <UpgradeSheetProvider> (it's in the app Providers).");
  return open;
}

/**
 * The one way to react to a failed action (AGENT_RULES §5 "Paywall UX"): a
 * plan limit opens the upgrade sheet for that feature, so the person is never
 * dead-ended; anything else becomes the usual error toast.
 */
export function useActionErrorHandler() {
  const openUpgrade = useUpgradeSheet();
  const messages = useFormMessages();
  return (code: unknown, feature: PlanFeature) => {
    if (code === "quota_exceeded" || code === "plan_required") openUpgrade({ feature, reason: code });
    else toast.error(messages.action(code));
  };
}
