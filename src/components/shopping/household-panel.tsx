"use client";

import { HomeIcon, LockIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/feedback/icon-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import {
  inviteToHousehold,
  leaveHousehold,
  removeHouseholdMember,
  respondToHouseholdInvite,
} from "@/server/actions/household";
import type { HouseholdDto } from "@/server/features/shopping/dto";

/** Without realtime yet (Pusher arrives with Phase 6), a shared list refreshes this often while in view. */
const REFRESH_MS = 15_000;

/**
 * The household list (Pro, PRD §3.5): invite people to shop from one list,
 * answer invites, or leave. Shared lists refresh while open.
 */
export function HouseholdPanel({ household }: { household: HouseholdDto }) {
  const t = useTranslations("shopping.household");
  const router = useRouter();
  const messages = useFormMessages();
  const onActionError = useActionErrorHandler();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const shared = household.sharedBy !== null || household.members.some((m) => m.status === "active");

  useEffect(() => {
    if (!shared) return;
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [shared, router]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await inviteToHousehold({ email });
    setBusy(false);
    if (result?.data) {
      toast.success(t("invited", { email }));
      setEmail("");
    } else if (result?.serverError === "conflict") toast.error(t("full"));
    else if (result?.validationErrors) toast.error(messages.field("emailInvalid"));
    else onActionError(result?.serverError, "household_list");
  }

  async function run(action: () => Promise<{ data?: unknown; serverError?: string } | undefined>, success: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    toast.success(success);
  }

  return (
    <div className="space-y-3">
      {household.invites.map((inv) => (
        <div key={inv.listId} role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary p-4">
          <HomeIcon aria-hidden="true" className="size-5 text-primary-strong" />
          <p className="flex-1 text-sm">{t("inviteFrom", { name: inv.fromName })}</p>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(() => respondToHouseholdInvite({ listId: inv.listId, accept: true }), t("joined"))}
          >
            {t("accept")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => run(() => respondToHouseholdInvite({ listId: inv.listId, accept: false }), t("declined"))}
          >
            {t("decline")}
          </Button>
        </div>
      ))}

      {household.sharedBy ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-4">
          <HomeIcon aria-hidden="true" className="size-5 text-primary-strong" />
          <p className="flex-1 text-sm">{t("sharedBy", { name: household.sharedBy })}</p>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => leaveHousehold({}), t("left"))}>
            {t("leave")}
          </Button>
        </div>
      ) : (
        <details className="group rounded-2xl border border-border p-4">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <HomeIcon aria-hidden="true" className="size-4 text-primary-strong" />
            {t("heading")}
            {household.members.length > 0 ? (
              <span className="text-muted-foreground">({t("memberCount", { count: household.members.length })})</span>
            ) : null}
          </summary>
          <div className="mt-3 space-y-3">
            {!household.canShare ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LockIcon aria-hidden="true" className="size-4" />
                  {t("proOnly")}
                </p>
                <Button size="sm" variant="outline" onClick={() => onActionError("plan_required", "household_list")}>
                  {t("seePlans")}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t("description")}</p>
                <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row">
                  <Label htmlFor="household-email" className="sr-only">
                    {t("emailLabel")}
                  </Label>
                  <Input
                    id="household-email"
                    type="email"
                    autoComplete="off"
                    required
                    value={email}
                    placeholder={t("emailPlaceholder")}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Button type="submit" disabled={busy || !email}>
                    {busy ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <UserPlusIcon aria-hidden="true" data-icon="inline-start" />
                    )}
                    {t("invite")}
                  </Button>
                </form>
                {household.members.length > 0 ? (
                  <ul className="space-y-1">
                    {household.members.map((member) => (
                      <li key={member.userId} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">
                          {member.name}{" "}
                          <span className="text-muted-foreground">
                            · {member.status === "active" ? t("active") : t("pending")}
                          </span>
                        </span>
                        <IconButton
                          label={t("remove", { name: member.name })}
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => removeHouseholdMember({ userId: member.userId }),
                              t("removed", { name: member.name }),
                            )
                          }
                        >
                          <XIcon aria-hidden="true" />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
