"use client";

import { LogOutIcon, SettingsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useRouter } from "@/i18n/navigation";
import { signOut } from "@/server/actions/auth";
import type { AccountSummaryDto } from "@/server/features/account/dto";

/** Signed-in avatar with the account's shortcuts. */
export function AccountMenu({ account }: { account: AccountSummaryDto }) {
  const t = useTranslations("account");
  const router = useRouter();
  const logOut = useAction(signOut, {
    onSuccess: () => {
      router.replace("/");
      router.refresh();
    },
  });
  const label = t("menu", { name: account.displayName });

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={label} className="rounded-full">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary font-medium text-primary-foreground">
                  {account.initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{account.displayName}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate font-medium text-foreground">{account.displayName}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            <bdi dir="ltr">{account.email}</bdi>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-10">
          <Link href="/settings">
            <SettingsIcon aria-hidden="true" />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-10"
          disabled={logOut.isPending}
          onSelect={(event) => {
            // Keep the menu open so "Logging out…" stays visible until we navigate.
            event.preventDefault();
            logOut.execute();
          }}
        >
          <LogOutIcon aria-hidden="true" className="rtl:-scale-x-100" />
          {logOut.isPending ? t("loggingOut") : t("logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
