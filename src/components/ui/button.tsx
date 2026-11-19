import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "border border-line bg-surface text-ink hover:border-brand-200 hover:bg-brand-50",
  ghost: "text-muted hover:bg-brand-50 hover:text-brand-700",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-sm",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-base",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/** Class names for a button, so links can look like buttons too. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={buttonClasses(variant, size, className)}
      type={type}
      {...props}
    />
  );
}
