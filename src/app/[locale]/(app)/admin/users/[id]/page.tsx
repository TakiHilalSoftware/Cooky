import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UserDetail } from "@/components/admin/user-detail";
import { getAdminUser } from "@/server/features/admin/queries";
import { personSchema } from "@/server/features/social/schema";

type Props = PageProps<"/[locale]/admin/users/[id]">;

async function load({ params }: Props) {
  const parsed = personSchema.safeParse({ userId: (await params).id });
  return parsed.success ? getAdminUser(parsed.data.userId) : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const user = await load(props);
  return user ? { title: user.displayName } : {};
}

export default async function AdminUserPage(props: Props) {
  const user = await load(props);
  if (!user) notFound();
  return <UserDetail user={user} />;
}
