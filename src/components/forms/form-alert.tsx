import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/** One message above the form: what happened and, ideally, what to do next. */
export function FormAlert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const Icon = tone === "error" ? CircleAlertIcon : CircleCheckIcon;
  return (
    <Alert variant={tone === "error" ? "destructive" : "default"} aria-live="polite">
      <Icon aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
