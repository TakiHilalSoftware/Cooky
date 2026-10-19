import { ChevronRightIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { AdminUserRowDto, Paged } from "@/server/features/admin/dto";

import { AdminHeader, EmptyRow, Pager, SearchBox } from "./admin-ui";

/** Users: search by name or email, newest first (PRD §3.8). */
export function UsersList({ users, q }: { users: Paged<AdminUserRowDto>; q: string }) {
  const t = useTranslations("admin.users");
  return (
    <>
      <AdminHeader title={t("heading")} description={t("description", { count: users.total })} />
      <SearchBox label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={q} />
      {users.rows.length === 0 ? (
        <EmptyRow>{q ? t("noMatch", { q }) : t("none")}</EmptyRow>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {users.rows.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/users/${u.id}`} className="flex min-h-16 items-center gap-3 p-4 hover:bg-muted">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">{u.displayName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    <bdi dir="ltr">{u.email}</bdi>
                  </p>
                  <UserBadges user={u} />
                </div>
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager path="/admin/users" query={{ q }} page={users.page} pageCount={users.pageCount} />
    </>
  );
}

/** Plan and account state as small labels, readable without colour. */
export function UserBadges({ user: u }: { user: AdminUserRowDto }) {
  const t = useTranslations("admin.users");
  const format = useFormatter();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary">{t(`plan.${u.plan}`)}</Badge>
      {u.planSource === "comp" ? <Badge variant="outline">{t("comp")}</Badge> : null}
      {u.isAdmin ? <Badge>{t("admin")}</Badge> : null}
      {u.suspended ? <Badge variant="destructive">{t("suspended")}</Badge> : null}
      {u.pendingDeletion ? <Badge variant="destructive">{t("pendingDeletion")}</Badge> : null}
      {u.emailVerified ? null : <Badge variant="outline">{t("unverified")}</Badge>}
      <span className="text-xs text-muted-foreground">
        {t("joined", { date: format.dateTime(new Date(u.createdAt), { dateStyle: "medium" }) })}
      </span>
    </div>
  );
}
