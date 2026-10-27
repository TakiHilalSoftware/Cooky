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

import { PHOTO_ACCEPT, photoFileProblem, type PhotoFileProblem } from "./photo-file";
import { PhotoFrame } from "./photo-frame";

type Result = { data?: { photo: PhotoDto | null }; serverError?: ActionErrorCode } | undefined;
type Problem = PhotoFileProblem | "unreadable" | "unavailable" | "offline";

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
    const fileProblem = photoFileProblem(file);
    if (fileProblem) return setProblem(fileProblem);
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
  // Round (profile): the photo sits above its buttons and notes; wide (dish): the same, at full width.
  const layout = cn("flex flex-col gap-3", shape === "round" && "items-start");

  if (!enabled) {
    return (
      <div className={layout}>
        {shape === "round" ? <PhotoFrame src={null} alt={alt} shape={shape} fallback={fallback} /> : null}
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ImageOffIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("disabled")}
        </p>
      </div>
    );
  }

  return (
    <div className={layout}>
      <PhotoFrame
        src={shown}
        alt={alt}
        shape={shape}
        fallback={fallback}
        busy={busy !== null}
        title={t("dropHint")}
        onFile={onPick}
        onBrowse={() => input.current?.click()}
      />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={PHOTO_ACCEPT}
            // The button below is the labelled, keyboard path to this input.
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            disabled={busy !== null}
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            aria-describedby={hintId}
            onClick={() => input.current?.click()}
          >
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
