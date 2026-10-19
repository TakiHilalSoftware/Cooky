import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ThreadView } from "@/components/messages/thread-view";
import { getThread } from "@/server/features/messages/queries";
import { threadLimitSchema } from "@/server/features/messages/schema";

type Props = PageProps<"/[locale]/messages/[id]">;

async function load({ params, searchParams }: Props) {
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return null;
  return getThread(parsed.data, threadLimitSchema.parse((await searchParams).limit));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const thread = await load(props);
  return thread ? { title: thread.person.displayName } : {};
}

export default async function ThreadPage(props: Props) {
  const thread = await load(props);
  // Someone else's chat and a missing one look the same.
  if (!thread) notFound();
  return <ThreadView thread={thread} />;
}
