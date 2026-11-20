"use client";

import { WifiOff } from "lucide-react";
import { useOffline } from "next/offline";

/**
 * Connectivity banner shown across the app whenever Next.js detects an offline
 * state (browser offline event or failed navigation / Server Action fetch).
 * Renders nothing on the server and while online, preserving the static shell.
 */
export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div
      aria-live="polite"
      className="border-amber-200 border-b bg-amber-50 px-4 py-2 text-amber-950 text-xs sm:text-sm"
      role="status"
    >
      <div className="container-page flex items-center justify-center gap-2 font-medium">
        <WifiOff
          aria-hidden="true"
          className="size-4 shrink-0 text-amber-700"
        />
        <span>
          You&apos;re offline. Pending navigations and actions will retry
          automatically when your connection returns.
        </span>
      </div>
    </div>
  );
}
