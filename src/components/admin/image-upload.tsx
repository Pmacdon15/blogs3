"use client";

import { ImageUp, Link2, X } from "lucide-react";
import Image from "next/image";
import { useId, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUploadImage } from "@/hooks/admin/use-post-mutations";
import { cn } from "@/lib/cn";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/schemas";

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

/*
 * An image picker: upload a file (stored by the uploadImageAction) or paste
 * an https URL. Shows a preview once the URL is usable.
 */
export function ImageUpload({
  label,
  value,
  onChange,
  error,
  className,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  error?: string;
  className?: string;
}) {
  const inputId = useId();
  const errorId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImage();
  const showPreview = isHttpsUrl(value);

  function pick(file: File | undefined) {
    if (!file) return;
    const problem = imageFileProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    upload.mutate(file, { onSuccess: (url) => onChange(url) });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="font-medium text-ink text-xs" htmlFor={inputId}>
        {label}
      </label>
      {showPreview ? (
        <div className="relative overflow-hidden rounded-lg border border-line bg-canvas">
          <Image
            alt=""
            className="h-40 w-full object-cover"
            height={320}
            src={value}
            unoptimized
            width={640}
          />
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
            className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-8 text-sm placeholder:text-muted/70 focus:border-brand-400"
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
