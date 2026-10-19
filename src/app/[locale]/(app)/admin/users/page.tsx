import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { UsersList } from "@/components/admin/users-list";
import { pageParam, queryParam } from "@/server/features/admin/params";
import { listUsers } from "@/server/features/admin/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("users") };
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/[locale]/admin/users">) {
  const sp = await searchParams;
  const q = queryParam.parse(sp.q);
  const users = await listUsers(q, pageParam.parse(sp.page));
  if (!users) notFound();
  return <UsersList users={users} q={q} />;
}
