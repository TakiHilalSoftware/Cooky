"use client";

import { CameraIcon, ImageOffIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { PHOTO_ACCEPT, photoFileProblem, type PhotoFileProblem } from "@/components/photos/photo-file";
import { PhotoFrame } from "@/components/photos/photo-frame";
import { Button } from "@/components/ui/button";

/**
 * The photo of a dish that doesn't exist yet. The chosen file only shows from
 * the device; the form uploads it once the dish is saved.
 */
export function NewDishPhotoField({
  file,
  onChange,
  enabled,
  alt,
  importedFrom,
  disabled = false,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Whether photo storage works at all. */
  enabled: boolean;
  alt: string;
  /** The site an imported recipe came from, when it brought a photo along. */
  importedFrom?: string | null;
  /** While the form is saving. */
  disabled?: boolean;
}) {
  const t = useTranslations("photos");
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<PhotoFileProblem | null>(null);
  // The device-local link for the picked file. It only counts while that file is still the chosen one.
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const shown = preview && preview.file === file ? preview.url : null;
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview.url)), [preview]);

  if (!enabled) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ImageOffIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t("disabled")}
      </p>
    );
  }

  function pick(next: File | undefined) {
    if (input.current) input.current.value = "";
    if (!next) return;
    const nextProblem = photoFileProblem(next);
    setProblem(nextProblem);
    if (nextProblem) return;
    setPreview({ file: next, url: URL.createObjectURL(next) });
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <PhotoFrame
        src={shown}
        alt={alt}
        shape="wide"
        title={t("dropHint")}
        onFile={disabled ? undefined : pick}
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
            disabled={disabled}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-describedby={hintId}
            onClick={() => input.current?.click()}
          >
            <CameraIcon aria-hidden="true" data-icon="inline-start" />
            {file ? t("replace") : t("add")}
          </Button>
          {file ? (
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                setProblem(null);
                onChange(null);
              }}
            >
              <Trash2Icon aria-hidden="true" data-icon="inline-start" />
              {t("remove")}
            </Button>
          ) : null}
        </div>
        <p id={hintId} className="text-sm text-muted-foreground">
          {!file && importedFrom ? `${t("fromImport", { site: importedFrom })} ` : null}
          {t("hint")}
        </p>
        <p aria-live="polite" className="text-sm text-destructive">
          {problem ? t(`errors.${problem}`) : null}
        </p>
      </div>
    </div>
  );
}
