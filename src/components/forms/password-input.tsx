"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ComponentProps } from "react";

import { IconButton } from "@/components/feedback/icon-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password input with a show/hide toggle; the toggle explains itself. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pe-12", className)} />
      <IconButton
        type="button"
        label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute end-0.5 top-1/2 -translate-y-1/2"
      >
        {visible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
      </IconButton>
    </div>
  );
}
