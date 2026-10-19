"use client";

import { FlagIcon, StarIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";

import { IconButton } from "@/components/feedback/icon-button";
import { cn } from "@/lib/utils";
import type { ReviewDto, ReviewsDto } from "@/server/features/dishes/dto";

import { PersonAvatar } from "./person-avatar";
import { ReportDialog } from "./report-dialog";

/** Ratings and reviews from people who cooked the dish (PRD §3.2). */
export function ReviewsCard({ reviews, emptyHint }: { reviews: ReviewsDto; emptyHint: string }) {
  const t = useTranslations("reviews");
  const format = useFormatter();
  return (
    <section
      aria-labelledby="reviews-heading"
      className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="reviews-heading" className="font-heading text-xl">
          {t("heading")}
        </h2>
        {reviews.average !== null ? (
          <p className="flex items-center gap-1.5 text-sm">
            <Stars value={Math.round(reviews.average)} />
            <span className="font-medium tabular-nums">
              {t("average", {
                average: format.number(reviews.average, { maximumFractionDigits: 1 }),
                count: reviews.count,
              })}
            </span>
          </p>
        ) : null}
      </div>
      {reviews.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="space-y-4">
          {reviews.items.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewItem({ review }: { review: ReviewDto }) {
  const t = useTranslations("reviews");
  const format = useFormatter();
  const now = useNow();
  const [reporting, setReporting] = useState(false);
  return (
    <li className="flex gap-3">
      <PersonAvatar person={review.person} className="size-9" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium">{review.person.displayName}</span>
          <Stars value={review.stars} />
          <span className="sr-only">{t("stars", { count: review.stars })}</span>
          <span className="text-xs text-muted-foreground">{format.relativeTime(new Date(review.at), now)}</span>
        </div>
        {review.review ? (
          <p dir="auto" className="text-sm break-words whitespace-pre-line">
            {review.review}
          </p>
        ) : null}
      </div>
      <IconButton label={t("report", { name: review.person.displayName })} onClick={() => setReporting(true)}>
        <FlagIcon aria-hidden="true" />
      </IconButton>
      <ReportDialog
        open={reporting}
        onOpenChange={setReporting}
        targetType="review"
        targetId={review.id}
        subject={review.person.displayName}
      />
    </li>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden="true" className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          className={cn("size-4", n <= value ? "fill-primary text-primary" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}
