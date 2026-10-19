import { ChevronLeftIcon, LockIcon, UtensilsCrossedIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { FriendProfileDto } from "@/server/features/social/dto";

import { PersonAvatar } from "./person-avatar";
import { PersonMenu } from "./person-menu";
import { RelationButton } from "./relation-button";
import { SharedDishCard } from "./shared-dish-card";

/** Someone's profile (PRD §3.6): their shared dishes, Message, Unfriend/Block, Report. */
export function FriendProfileView({ profile }: { profile: FriendProfileDto }) {
  const t = useTranslations("friends");
  const format = useFormatter();
  const { person } = profile;
  const isFriend = person.relation === "friend";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/friends"
        className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {t("backToFriends")}
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <PersonAvatar person={person} className="size-20 text-2xl" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="font-heading text-3xl break-words sm:text-4xl">{person.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {isFriend && profile.since
              ? t("friendsSince", { date: format.dateTime(new Date(profile.since), { dateStyle: "long" }) })
              : t(`status.${person.relation === "self" ? "none" : person.relation}`)}
          </p>
          {isFriend ? (
            <p className="text-sm text-muted-foreground">{t("sharedCount", { count: profile.sharedCount })}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <RelationButton person={person} size="default" />
          {profile.conversationId && !isFriend ? (
            <Button asChild variant="outline">
              <Link href={`/messages/${profile.conversationId}`}>{t("oldChat")}</Link>
            </Button>
          ) : null}
          <PersonMenu person={person} afterBlock="/friends" />
        </div>
      </header>

      <section aria-labelledby="shared-heading" className="space-y-4">
        <h2 id="shared-heading" className="font-heading text-2xl">
          {t("sharedHeading", { name: person.displayName })}
        </h2>
        {!isFriend ? (
          <EmptyState
            headingLevel={3}
            title={t("notFriendsTitle")}
            description={t("notFriendsBody", { name: person.displayName })}
            illustration={<LockIcon aria-hidden="true" className="size-12 text-muted-foreground" />}
            action={<RelationButton person={person} size="lg" />}
            className="rounded-3xl border border-dashed border-border py-10"
          />
        ) : profile.dishes.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title={t("noSharedTitle")}
            description={t("noSharedBody", { name: person.displayName })}
            illustration={<UtensilsCrossedIcon aria-hidden="true" className="size-12 text-primary-strong" />}
            action={<RelationButton person={person} size="lg" />}
            className="rounded-3xl border border-dashed border-border py-10"
          />
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.dishes.map((dish) => (
                <SharedDishCard key={dish.id} dish={dish} />
              ))}
            </ul>
            {profile.page > 1 || profile.hasMore ? (
              <nav aria-label={t("pagesLabel")} className="flex flex-wrap items-center justify-between gap-3">
                {profile.page > 1 ? (
                  <Button asChild variant="outline">
                    <Link href={`/friends/${person.id}?page=${profile.page - 1}`}>{t("newer")}</Link>
                  </Button>
                ) : (
                  <span />
                )}
                <span className="text-sm text-muted-foreground tabular-nums">{t("page", { page: profile.page })}</span>
                {profile.hasMore ? (
                  <Button asChild variant="outline">
                    <Link href={`/friends/${person.id}?page=${profile.page + 1}`}>{t("older")}</Link>
                  </Button>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
