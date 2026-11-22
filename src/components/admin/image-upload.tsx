"use client";

import { ImageUp, Link2, X } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useId,
  useRef,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUploadImage } from "@/hooks/admin/use-post-mutations";
import { cn } from "@/lib/cn";
import {
  clampImageWidth,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_WIDTH,
  MIN_IMAGE_WIDTH,
} from "@/lib/schemas";

/** True for a well-formed https URL (what the schemas accept for images). */
export function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Why a file can't be uploaded, or null if it can. */
export function imageFileProblem(file: File) {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Upload a PNG, JPEG, WebP, GIF or AVIF image.";
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return "Images must be under 4 MB.";
  }
  return null;
}

/** Computes the new image width percentage from a horizontal drag delta. */
export function resizedWidth(
  startWidth: number,
  deltaX: number,
  trackWidth: number,
) {
  const safeTrack = trackWidth > 0 ? trackWidth : 500;
  return clampImageWidth(startWidth + (deltaX / safeTrack) * 100);
}

/*
 * An image picker: upload a file (stored by the uploadImageAction) or paste
 * an https URL. Shows a preview once the URL is usable, with optional
 * drag-to-resize handles on the left and right edges.
 */
export function ImageUpload({
  label,
  value,
  onChange,
  width,
  onWidthChange,
  error,
  className,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
  error?: string;
  className?: string;
}) {
  const inputId = useId();
  const errorId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const upload = useUploadImage();
  const showPreview = isHttpsUrl(value);
  const currentWidth = clampImageWidth(width ?? MAX_IMAGE_WIDTH);

  function pick(file: File | undefined) {
    if (!file) return;
    const problem = imageFileProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    upload.mutate(file, { onSuccess: (url) => onChange(url) });
  }

  function startResize(
    event: ReactPointerEvent<HTMLDivElement>,
    side: "left" | "right",
    onResize: (nextWidth: number) => void,
  ) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = currentWidth;
    const trackWidth = (
      previewRef.current as HTMLDivElement
    ).getBoundingClientRect().width;
    const direction = side === "right" ? 1 : -1;

    function onPointerMove(moveEvent: PointerEvent) {
      const deltaX = (moveEvent.clientX - startX) * direction;
      onResize(resizedWidth(startWidth, deltaX, trackWidth));
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onResizeKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
    onResize: (nextWidth: number) => void,
  ) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onResize(clampImageWidth(currentWidth - 5));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onResize(clampImageWidth(currentWidth + 5));
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="font-medium text-ink text-xs" htmlFor={inputId}>
        {label}
      </label>
      {showPreview ? (
        <div
          className="relative flex justify-center overflow-hidden rounded-lg border border-line bg-canvas"
          ref={previewRef}
        >
          <div
            className="group/preview relative max-w-full"
            data-testid="image-preview-box"
            style={{ width: `${currentWidth}%` }}
          >
            <Image
              alt=""
              className={cn(
                "w-full",
                onWidthChange
                  ? "h-auto max-h-80 object-contain"
                  : "h-40 object-cover",
              )}
              height={320}
              src={value}
              unoptimized
              width={640}
            />
            {onWidthChange ? (
              <>
                <span className="pointer-events-none absolute bottom-2 left-3 rounded-md bg-surface/90 px-2 py-0.5 font-mono text-ink text-xs shadow-xs backdrop-blur">
                  {currentWidth}%
                </span>
                {(["left", "right"] as const).map((side) => (
                  <div
                    aria-label={`Resize image ${side}`}
                    aria-valuemax={MAX_IMAGE_WIDTH}
                    aria-valuemin={MIN_IMAGE_WIDTH}
                    aria-valuenow={currentWidth}
                    aria-valuetext={`${currentWidth}%`}
                    className={cn(
                      "group/handle absolute inset-y-0 flex w-6 cursor-ew-resize touch-none items-center justify-center focus-visible:outline-none",
                      side === "left" ? "left-0" : "right-0",
                    )}
                    key={side}
                    onDoubleClick={() => onWidthChange(MAX_IMAGE_WIDTH)}
                    onKeyDown={(event) => onResizeKeyDown(event, onWidthChange)}
                    onPointerDown={(event) =>
                      startResize(event, side, onWidthChange)
                    }
                    role="slider"
                    tabIndex={0}
                    title="Drag to resize (double-click to reset)"
                  >
                    <span
                      aria-hidden="true"
                      className="h-10 w-1.5 rounded-full bg-surface/90 shadow-sm ring-1 ring-ink/20 transition-colors group-hover/preview:bg-brand-500 group-focus-visible/handle:bg-brand-600 group-focus-visible/handle:ring-2 group-focus-visible/handle:ring-white"
                    />
                  </div>
                ))}
              </>
            ) : null}
          </div>
          <Button
            aria-label={`Remove ${label.toLowerCase()}`}
            className="absolute top-2 right-2 bg-surface/90 backdrop-blur"
            onClick={() => onChange("")}
            size="sm"
            variant="secondary"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"
          />
          <input
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-8 text-sm placeholder:text-muted focus:border-brand-500"
            id={inputId}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://…"
            type="url"
            value={value}
          />
        </div>
        <Button
          disabled={upload.isPending}
          onClick={() => fileRef.current?.click()}
          size="sm"
          variant="secondary"
          className="h-9"
        >
          <ImageUp aria-hidden="true" className="size-4" />
          {upload.isPending ? "Uploading…" : "Upload"}
        </Button>
        <input
          accept={IMAGE_TYPES.join(",")}
          aria-label={`Upload ${label.toLowerCase()}`}
          className="sr-only"
          onChange={(event) => {
            pick(event.target.files?.[0]);
            event.target.value = "";
          }}
          ref={fileRef}
          tabIndex={-1}
          type="file"
        />
      </div>
      {error ? (
        <p className="text-red-600 text-xs" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
