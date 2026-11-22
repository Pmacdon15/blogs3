"use client";

import type { ComponentProps, RefObject } from "react";
import { cn } from "@/lib/cn";

/** Grows a textarea to fit its content. */
export function fitToContent(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

/**
 * A textarea that grows with its text instead of scrolling: CSS
 * `field-sizing: content` where supported, measured on input elsewhere.
 */
export function AutoTextarea({
  className,
  onInput,
  ref,
  ...props
}: ComponentProps<"textarea"> & {
  ref?: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <textarea
      className={cn(
        "field-sizing-content resize-none overflow-hidden",
        className,
      )}
      onInput={(event) => {
        fitToContent(event.currentTarget);
        onInput?.(event);
      }}
      ref={(element) => {
        fitToContent(element);
        if (ref) ref.current = element;
      }}
      rows={3}
      {...props}
    />
  );
}
