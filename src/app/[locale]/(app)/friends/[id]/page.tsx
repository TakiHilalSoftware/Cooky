import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { FriendProfileView } from "@/components/social/friend-profile-view";
import { getFriendProfile } from "@/server/features/social/queries";
import { personSchema } from "@/server/features/social/schema";

type Props = PageProps<"/[locale]/friends/[id]">;

const pageSchema = z.coerce.number().int().min(1).max(500).catch(1);

async function load({ params, searchParams }: Props) {
  const { id } = await params;
  const parsed = personSchema.safeParse({ userId: id });
  if (!parsed.success) return null;
  return getFriendProfile(parsed.data.userId, pageSchema.parse((await searchParams).page));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const profile = await load(props);
  return profile ? { title: profile.person.displayName } : {};
}

export default async function FriendProfilePage(props: Props) {
  const profile = await load(props);
  // Blocked, suspended, unknown or yourself: a plain "not found".
  if (!profile) notFound();
  return <FriendProfileView profile={profile} />;
}
