import { useFormatter, useTranslations } from "next-intl";

import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type FeedbackKind, type FeedbackStatus } from "@/lib/admin";
import { REPORT_STATUSES, type ReportStatus } from "@/lib/social";
import type {
  AuditEntryDto,
  FeedbackDto,
  Paged,
  ReportDto,
  ReviewModerationDto,
  SharedDishModerationDto,
} from "@/server/features/admin/dto";

import { AdminHeader, EmptyRow, FilterTabs, Pager, SearchBox } from "./admin-ui";
import { FeedbackRow, ReportRow, ReviewRow, SharedDishRow } from "./moderation";

const LIST = "divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card";

/** Content (PRD §3.8): recent written reviews and recently shared dishes. */
export function ContentView(
  props: { tab: "reviews"; rows: Paged<ReviewModerationDto> } | { tab: "shared"; rows: Paged<SharedDishModerationDto> },
) {
  const t = useTranslations("admin.content");
  return (
    <>
      <AdminHeader title={t("heading")} description={t("description")} />
      <FilterTabs
        label={t("tabsLabel")}
        path="/admin/content"
        query={{}}
        param="tab"
        value={props.tab}
        options={[
          { value: "reviews", label: t("tabs.reviews") },
          { value: "shared", label: t("tabs.shared") },
        ]}
      />
      {props.rows.rows.length === 0 ? (
        <EmptyRow>{t(props.tab === "reviews" ? "noReviews" : "noShared")}</EmptyRow>
      ) : props.tab === "reviews" ? (
        <ul className={LIST}>
          {props.rows.rows.map((r) => (
            <ReviewRow key={r.id} review={r} />
          ))}
        </ul>
      ) : (
        <ul className={LIST}>
          {props.rows.rows.map((d) => (
            <SharedDishRow key={d.id} dish={d} />
          ))}
        </ul>
      )}
      <Pager path="/admin/content" query={{ tab: props.tab }} page={props.rows.page} pageCount={props.rows.pageCount} />
    </>
  );
}

/** The reports queue (PRD §3.8): open first, closed ones kept for the record. */
export function ReportsView({ reports, status }: { reports: Paged<ReportDto>; status: ReportStatus }) {
  const t = useTranslations("admin.reports");
  return (
    <>
      <AdminHeader title={t("heading")} description={t("description")} />
      <FilterTabs
        label={t("statusLabel")}
        path="/admin/reports"
        query={{}}
        param="status"
        value={status}
        options={REPORT_STATUSES.map((s) => ({ value: s, label: t(`tabs.${s}`) }))}
      />
      {reports.rows.length === 0 ? (
        <EmptyRow>{t(status === "open" ? "noneOpen" : "none")}</EmptyRow>
      ) : (
        <ul className={LIST}>
          {reports.rows.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </ul>
      )}
      <Pager path="/admin/reports" query={{ status }} page={reports.page} pageCount={reports.pageCount} />
    </>
  );
}

/** Feedback from Settings (PRD §3.8), filtered by status and type. */
export function FeedbackView({
  feedback,
  status,
  kind,
}: {
  feedback: Paged<FeedbackDto>;
  status: FeedbackStatus | null;
  kind: FeedbackKind | null;
}) {
  const t = useTranslations("admin.feedback");
  const tKind = useTranslations("helpFeedback.kind");
  return (
    <>
      <AdminHeader title={t("heading")} description={t("description")} />
      <FilterTabs
        label={t("statusLabel")}
        path="/admin/feedback"
        query={{ kind }}
        param="status"
        value={status}
        options={[
          { value: null, label: t("all") },
          ...FEEDBACK_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
        ]}
      />
      <FilterTabs
        label={t("kindLabel")}
        path="/admin/feedback"
        query={{ status }}
        param="kind"
        value={kind}
        options={[{ value: null, label: t("allKinds") }, ...FEEDBACK_KINDS.map((k) => ({ value: k, label: tKind(k) }))]}
      />
      {feedback.rows.length === 0 ? (
        <EmptyRow>{t("none")}</EmptyRow>
      ) : (
        <ul className={LIST}>
          {feedback.rows.map((f) => (
            <FeedbackRow key={f.id} item={f} />
          ))}
        </ul>
      )}
      <Pager path="/admin/feedback" query={{ status, kind }} page={feedback.page} pageCount={feedback.pageCount} />
    </>
  );
}

/** The audit log viewer (PRD §3.8): every admin action and sensitive user action. */
export function AuditView({ entries, action }: { entries: Paged<AuditEntryDto>; action: string }) {
  const t = useTranslations("admin.audit");
  const format = useFormatter();
  return (
    <>
      <AdminHeader title={t("heading")} description={t("description")} />
      <SearchBox label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={action} />
      {entries.rows.length === 0 ? (
        <EmptyRow>{t("none")}</EmptyRow>
      ) : (
        <ol className={LIST}>
          {entries.rows.map((e) => (
            <li key={e.id} className="space-y-1 p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="font-mono text-xs break-all">{e.action}</code>
                <time dateTime={e.at} className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(e.at), { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </div>
              <p className="text-muted-foreground">
                {e.actor ?? t("system")}
                {e.targetType ? ` → ${e.targetType}` : ""}
                {e.targetId ? (
                  <>
                    {" "}
                    <code className="font-mono text-xs break-all">{e.targetId}</code>
                  </>
                ) : null}
              </p>
              {e.meta ? (
                <code className="block font-mono text-xs break-all text-muted-foreground">{e.meta}</code>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <Pager path="/admin/audit" query={{ q: action }} page={entries.page} pageCount={entries.pageCount} />
    </>
  );
}
