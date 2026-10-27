"use client";

import { CameraIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * The picture (or its empty placeholder) in a photo slot. A file dropped on it
 * is picked like one chosen with the button; clicking it opens the file chooser.
 * The button next to it stays the labelled, keyboard path, so the frame itself
 * isn't focusable.
 */
export function PhotoFrame({
  src,
  alt,
  shape,
  busy = false,
  fallback,
  title,
  onFile,
  onBrowse,
}: {
  src: string | null;
  alt: string;
  shape: "wide" | "round";
  busy?: boolean;
  /** Shown when there's no photo, e.g. the person's initials. */
  fallback?: ReactNode;
  /** Tooltip saying what clicking or dropping does. */
  title?: string;
  onFile?: (file: File | undefined) => void;
  onBrowse?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const interactive = Boolean(onFile) && !busy;

  return (
    <div
      title={interactive ? title : undefined}
      onClick={interactive ? onBrowse : undefined}
      onDragOver={
        interactive
          ? (e) => {
              e.preventDefault();
              setDragging(true);
            }
          : undefined
      }
      onDragLeave={interactive ? () => setDragging(false) : undefined}
      onDrop={
        interactive
          ? (e) => {
              e.preventDefault();
              setDragging(false);
              onFile?.(e.dataTransfer.files[0]);
            }
          : undefined
      }
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden border border-border bg-muted transition-colors",
        shape === "round" ? "size-24 rounded-full" : "aspect-[4/3] w-full max-w-sm rounded-2xl",
        interactive && "cursor-pointer hover:border-primary/60",
        dragging && "border-2 border-dashed border-primary bg-primary/5",
      )}
    >
      {src ? (
        // A plain <img>: signed URLs change every render, so the image optimizer would only re-download them.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        (fallback ?? <CameraIcon aria-hidden="true" className="size-8 text-muted-foreground" />)
      )}
      {busy ? (
        <div className="absolute inset-0 grid place-items-center bg-background/60">
          <Spinner />
        </div>
      ) : null}
    </div>
  );
}
