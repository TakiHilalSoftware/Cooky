"use client";

import { CameraIcon, ImageOffIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useOnline } from "@/components/app-shell/use-online";
import type { ActionErrorCode } from "@/lib/errors";
import type { PhotoDto } from "@/server/features/photos/dto";
import { cn } from "@/lib/utils";

/** The formats sharp re-encodes. Asking for JPEG makes iPhones convert HEIC photos on the way out. */
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";
/** Matches the server's cap (MAX_PHOTO_BYTES); checked here only to answer instantly. */
const MAX_BYTES = 5 * 1024 * 1024;

type Result = { data?: { photo: PhotoDto | null }; serverError?: ActionErrorCode } | undefined;
type Problem = "tooLarge" | "wrongType" | "unreadable" | "unavailable" | "offline";

/**
 * Add, replace or remove one photo. Changes save at once (they aren't part of
 * a form's Save). While uploading, the chosen picture shows from the device.
 */
export function PhotoPicker({
  photo,
  enabled,
  shape,
  alt,
  upload,
  remove,
  onQuotaExceeded,
  fallback,
}: {
  photo: PhotoDto | null;
  enabled: boolean;
  shape: "wide" | "round";
  /** Describes the picture, e.g. the dish name. */
  alt: string;
  upload: (file: File) => Promise<Result>;
  remove: () => Promise<Result>;
  onQuotaExceeded?: () => void;
  /** Shown in the frame when there's no photo, e.g. the person's initials. */
  fallback?: ReactNode;
}) {
  const t = useTranslations("photos");
  const online = useOnline();
  const inputId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(photo);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  // A fresh server render (after revalidation) wins over what this component last saw.
  const [seen, setSeen] = useState(photo);
  if (photo !== seen) {
    setSeen(photo);
    setCurrent(photo);
  }
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function fail(code: ActionErrorCode | undefined) {
    if (code === "quota_exceeded" && onQuotaExceeded) return onQuotaExceeded();
    setProblem(code === "unavailable" ? "unavailable" : "unreadable");
  }

  async function onPick(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    setProblem(null);
    if (!online) return setProblem("offline");
    if (!ACCEPT.split(",").includes(file.type)) return setProblem("wrongType");
    if (file.size > MAX_BYTES) return setProblem("tooLarge");
    setPreview(URL.createObjectURL(file));
    setBusy("upload");
    const result = await upload(file);
    setBusy(null);
    setPreview(null);
    if (result?.data) {
      setCurrent(result.data.photo);
      toast.success(t("saved"));
    } else fail(result?.serverError);
  }

  async function onRemove() {
    setProblem(null);
    if (!online) return setProblem("offline");
    setBusy("remove");
    const result = await remove();
    setBusy(null);
    if (result?.data) {
      setCurrent(null);
      toast.success(t("removed"));
    } else fail(result?.serverError);
  }

  const shown = preview ?? current?.url ?? null;
  const frame = shape === "round" ? "size-24 rounded-full" : "aspect-[4/3] w-full max-w-sm rounded-2xl";

  const empty = fallback ?? <CameraIcon aria-hidden="true" className="size-8 text-muted-foreground" />;
  // Round (profile): the photo sits above its buttons and notes; wide (dish): the same, at full width.
  const layout = cn("flex flex-col gap-3", shape === "round" && "items-start");
  const frameClass = cn(
    "relative grid shrink-0 place-items-center overflow-hidden border border-border bg-muted",
    frame,
  );

  if (!enabled) {
    return (
      <div className={layout}>
        {shape === "round" ? <div className={frameClass}>{empty}</div> : null}
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ImageOffIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("disabled")}
        </p>
      </div>
    );
  }

  return (
    <div className={layout}>
      <div className={frameClass}>
        {shown ? (
          // A plain <img>: signed URLs change every render, so the image optimizer would only re-download them.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={alt} className="size-full object-cover" />
        ) : (
          empty
        )}
        {busy === "upload" ? (
          <div className="absolute inset-0 grid place-items-center bg-background/60">
            <Spinner />
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-describedby={hintId}
            disabled={busy !== null}
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => input.current?.click()}>
            <CameraIcon aria-hidden="true" data-icon="inline-start" />
            {busy === "upload" ? t("uploading") : current ? t("replace") : t("add")}
          </Button>
          {current ? (
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={onRemove}>
              {busy === "remove" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2Icon aria-hidden="true" data-icon="inline-start" />
              )}
              {t("remove")}
            </Button>
          ) : null}
        </div>
        <p id={hintId} className="text-sm text-muted-foreground">
          {t("hint")}
        </p>
        <p aria-live="polite" className="text-sm text-destructive">
          {problem ? t(`errors.${problem}`) : null}
        </p>
      </div>
    </div>
  );
}
