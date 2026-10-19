"use client";

import {
  BadgeCheckIcon,
  BanIcon,
  ChevronLeftIcon,
  GiftIcon,
  LockOpenIcon,
  LogOutIcon,
  ShieldIcon,
  ShieldOffIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { COMP_MONTHS } from "@/lib/admin";
import {
  adminDeleteUser,
  adminGrantComp,
  adminMarkVerified,
  adminSetRole,
  adminSetSuspended,
  adminSignOutEverywhere,
  adminUnlock,
} from "@/server/actions/admin";
import type { AdminUserDetailDto } from "@/server/features/admin/dto";

import { UserBadges } from "./users-list";

type Confirm = "suspend" | "unsuspend" | "signOut" | "makeAdmin" | "revokeAdmin" | "delete" | null;

/** One account and what an admin can do with it (PRD §3.8). Every action is audit-logged. */
export function UserDetail({ user: u }: { user: AdminUserDetailDto }) {
  const t = useTranslations("admin.users");
  const format = useFormatter();
  const messages = useFormMessages();
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [compPlan, setCompPlan] = useState<"plus" | "pro">("plus");
  const [compMonths, setCompMonths] = useState<(typeof COMP_MONTHS)[number]>(1);

  async function run(
    call: () => Promise<{ data?: unknown; serverError?: unknown } | undefined>,
    done: string,
  ): Promise<boolean> {
    const result = await call();
    if (result?.data) {
      toast.success(done);
      return true;
    }
    toast.error(result?.serverError === "forbidden" ? t("notOnYourself") : messages.action(result?.serverError));
    return false;
  }

  const dialogs: Record<Exclude<Confirm, null>, { action: () => Promise<boolean>; label: string }> = {
    suspend: {
      label: t("suspend"),
      action: () => run(() => adminSetSuspended({ userId: u.id, suspended: true }), t("suspendedDone")),
    },
    unsuspend: {
      label: t("unsuspend"),
      action: () => run(() => adminSetSuspended({ userId: u.id, suspended: false }), t("unsuspendedDone")),
    },
    signOut: {
      label: t("signOut"),
      action: () => run(() => adminSignOutEverywhere({ userId: u.id }), t("signedOutDone")),
    },
    makeAdmin: {
      label: t("makeAdmin"),
      action: () => run(() => adminSetRole({ userId: u.id, admin: true }), t("adminDone")),
    },
    revokeAdmin: {
      label: t("revokeAdmin"),
      action: () => run(() => adminSetRole({ userId: u.id, admin: false }), t("revokedDone")),
    },
    delete: {
      label: t("delete"),
      action: async () => {
        const ok = await run(() => adminDeleteUser({ userId: u.id }), t("deletedDone"));
        if (ok) router.replace("/admin/users");
        return ok;
      },
    },
  };

  const action = (key: Exclude<Confirm, null>, Icon: typeof BanIcon, destructive = false) => (
    <Button
      variant={destructive ? "destructive" : "outline"}
      disabled={u.isSelf && key !== "makeAdmin"}
      title={u.isSelf ? t("notOnYourself") : undefined}
      onClick={() => setConfirm(key)}
    >
      <Icon aria-hidden="true" data-icon="inline-start" />
      {dialogs[key].label}
    </Button>
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {t("back")}
      </Link>
      <header className="space-y-2 rounded-3xl border border-border bg-card p-5">
        <h2 className="font-heading text-3xl break-words">{u.displayName}</h2>
        <p className="text-sm text-muted-foreground">
          <bdi dir="ltr">{u.email}</bdi>
        </p>
        <UserBadges user={u} />
        <dl className="grid gap-3 pt-2 text-sm sm:grid-cols-4">
          <Fact label={t("dishes")} value={format.number(u.dishCount)} />
          <Fact label={t("sessions")} value={format.number(u.activeSessions)} />
          <Fact label={t("reportsAgainst")} value={format.number(u.reportsAgainst)} />
          <Fact
            label={t("lockout")}
            value={u.lockedUntil ? format.dateTime(new Date(u.lockedUntil), { timeStyle: "short" }) : t("notLocked")}
          />
        </dl>
        {u.isSelf ? <p className="text-sm text-muted-foreground">{t("selfNote")}</p> : null}
      </header>

      <section aria-labelledby="account-actions" className="space-y-3 rounded-3xl border border-border bg-card p-5">
        <h3 id="account-actions" className="font-heading text-xl">
          {t("accountActions")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {u.emailVerified ? null : (
            <Button
              variant="outline"
              onClick={() => void run(() => adminMarkVerified({ userId: u.id }), t("verifiedDone"))}
            >
              <BadgeCheckIcon aria-hidden="true" data-icon="inline-start" />
              {t("markVerified")}
            </Button>
          )}
          {u.lockedUntil ? (
            <Button variant="outline" onClick={() => void run(() => adminUnlock({ userId: u.id }), t("unlockedDone"))}>
              <LockOpenIcon aria-hidden="true" data-icon="inline-start" />
              {t("unlock")}
            </Button>
          ) : null}
          {action("signOut", LogOutIcon)}
          {u.isAdmin ? action("revokeAdmin", ShieldOffIcon) : action("makeAdmin", ShieldIcon)}
          {u.suspended ? action("unsuspend", BanIcon) : action("suspend", BanIcon, true)}
          {action("delete", Trash2Icon, true)}
        </div>
      </section>

      <section aria-labelledby="comp-plan" className="space-y-3 rounded-3xl border border-border bg-card p-5">
        <h3 id="comp-plan" className="font-heading text-xl">
          {t("compHeading")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {u.planSource === "comp"
            ? u.compEndsAt
              ? t("compUntil", {
                  plan: t(`plan.${u.plan}`),
                  date: format.dateTime(new Date(u.compEndsAt), { dateStyle: "medium" }),
                })
              : t("compForever", { plan: t(`plan.${u.plan}`) })
            : t("compHint")}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="comp-plan-select">{t("compPlan")}</Label>
            <NativeSelect
              id="comp-plan-select"
              value={compPlan}
              onChange={(e) => setCompPlan(e.target.value === "pro" ? "pro" : "plus")}
            >
              <NativeSelectOption value="plus">{t("plan.plus")}</NativeSelectOption>
              <NativeSelectOption value="pro">{t("plan.pro")}</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="comp-months-select">{t("compLength")}</Label>
            <NativeSelect
              id="comp-months-select"
              value={String(compMonths)}
              onChange={(e) => setCompMonths(COMP_MONTHS.find((m) => String(m) === e.target.value) ?? 1)}
            >
              {COMP_MONTHS.map((m) => (
                <NativeSelectOption key={m} value={String(m)}>
                  {m === 0 ? t("compUntilRevoked") : t("compMonths", { count: m })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button
            onClick={() =>
              void run(() => adminGrantComp({ userId: u.id, plan: compPlan, months: compMonths }), t("compDone"))
            }
          >
            <GiftIcon aria-hidden="true" data-icon="inline-start" />
            {t("grantComp")}
          </Button>
          {u.planSource === "comp" ? (
            <Button
              variant="outline"
              onClick={() =>
                void run(() => adminGrantComp({ userId: u.id, plan: null, months: 0 }), t("compRevokedDone"))
              }
            >
              {t("revokeComp")}
            </Button>
          ) : null}
        </div>
      </section>

      {confirm ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setConfirm(null))}
          title={t(`confirm.${confirm}.title`, { name: u.displayName })}
          description={t(`confirm.${confirm}.body`, { name: u.displayName })}
          confirmLabel={dialogs[confirm].label}
          destructive={confirm === "suspend" || confirm === "delete" || confirm === "revokeAdmin"}
          onConfirm={dialogs[confirm].action}
        />
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
