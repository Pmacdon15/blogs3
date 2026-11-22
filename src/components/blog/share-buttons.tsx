"use client";

import { Check, Link as LinkIcon, Mail, Share2 } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { buttonClasses } from "@/components/ui/button";
import { type ShareNetwork, shareLinks } from "@/lib/share";

const noSubscription = () => () => {};

/** True once hydrated in a browser that offers the native share sheet. */
function useCanNativeShare() {
  return useSyncExternalStore(
    noSubscription,
    () => typeof navigator.share === "function",
    () => false,
  );
}

function BrandIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d={path} />
    </svg>
  );
}

const ICONS: Record<ShareNetwork, ReactNode> = {
  x: (
    <BrandIcon path="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  ),
  bluesky: (
    <BrandIcon path="M5.2 3.3C7.9 5.3 10.9 9.5 12 11.8c1.1-2.3 4.1-6.5 6.8-8.5 2-1.5 5.2-2.6 5.2 1 0 .7-.4 6-.7 6.9-.9 3.1-4.1 3.9-6.9 3.4 4.9.8 6.2 3.6 3.5 6.4-5.1 5.2-7.3-1.3-7.9-3-.1-.3-.1-.5-.1-.3 0-.2 0 0-.1.3-.6 1.7-2.8 8.2-7.9 3-2.7-2.8-1.4-5.6 3.5-6.4-2.8.5-6-.3-6.9-3.4C.4 10.3 0 5 0 4.3c0-3.6 3.2-2.5 5.2-1z" />
  ),
  linkedin: (
    <BrandIcon path="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
  ),
  facebook: (
    <BrandIcon path="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07z" />
  ),
  email: <Mail aria-hidden="true" className="size-4" />,
};

type CopyState = "idle" | "copied" | "failed";

/** Share links for a post, a copy-link button and, where offered, the native share sheet. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const canNativeShare = useCanNativeShare();
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // The reader closed the share sheet; nothing to do.
    }
  };

  const itemClass = buttonClasses("secondary", "sm");

  return (
    <section
      aria-labelledby="share-heading"
      className="flex flex-col gap-3 border-line border-t pt-8 sm:flex-row sm:items-center sm:justify-between"
    >
      <h2 className="font-semibold text-ink text-sm" id="share-heading">
        Share this post
      </h2>
      <ul className="flex flex-wrap items-center gap-2">
        {shareLinks(url, title).map((link) => (
          <li key={link.network}>
            <a
              aria-label={`Share on ${link.label}`}
              className={itemClass}
              href={link.href}
              rel="noopener noreferrer"
              target={link.network === "email" ? undefined : "_blank"}
              title={link.label}
            >
              {ICONS[link.network]}
              <span className="sr-only sm:not-sr-only">{link.label}</span>
            </a>
          </li>
        ))}
        <li>
          <button className={itemClass} onClick={copy} type="button">
            {state === "copied" ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <LinkIcon aria-hidden="true" className="size-4" />
            )}
            {state === "copied" ? "Copied" : "Copy link"}
          </button>
        </li>
        {canNativeShare ? (
          <li>
            <button className={itemClass} onClick={nativeShare} type="button">
              <Share2 aria-hidden="true" className="size-4" />
              Share…
            </button>
          </li>
        ) : null}
      </ul>
      <span aria-live="polite" className="sr-only" role="status">
        {state === "copied"
          ? "Link copied."
          : state === "failed"
            ? "Couldn't copy the link. Copy it from the address bar."
            : ""}
      </span>
    </section>
  );
}
