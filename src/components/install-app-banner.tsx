"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const DISMISS_STORAGE_KEY = "blogs:install-banner-dismissed";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isStandaloneMode(): boolean {
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return true;
    }
  }
  return Boolean((navigator as NavigatorWithStandalone).standalone);
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIosDevice =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIosDevice && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
  } catch {
    // Ignore storage write errors (e.g. private browsing restrictions).
  }
}

/**
 * Dismissible PWA install banner shown when the browser fires
 * `beforeinstallprompt` (Chromium/desktop/Android) or when running in iOS
 * Safari outside standalone mode. Renders nothing on the server or once the
 * app is already installed, preserving the static shell.
 */
export function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandaloneMode() || readDismissed()) {
      setDismissed(true);
      return;
    }

    if (isIosSafari()) {
      setShowIosGuide(true);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setShowIosGuide(false);
      setDismissed(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (dismissed || (!deferredPrompt && !showIosGuide)) {
    return null;
  }

  async function handleInstallClick(promptEvent: BeforeInstallPromptEvent) {
    setDeferredPrompt(null);
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      setDismissed(true);
    }
  }

  function handleDismiss() {
    writeDismissed();
    setDeferredPrompt(null);
    setShowIosGuide(false);
    setDismissed(true);
  }

  return (
    <aside
      aria-label="Install app"
      className="border-brand-200 border-b bg-brand-50/90 px-4 py-2 text-brand-950 text-xs sm:text-sm"
    >
      <div className="container-page flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Download
            aria-hidden="true"
            className="size-4 shrink-0 text-brand-700"
          />
          {deferredPrompt ? (
            <span>
              Install <strong>Blogs</strong> on your device for quick access and
              an app-like reading experience.
            </span>
          ) : (
            <span>
              To install <strong>Blogs</strong> on iOS, tap{" "}
              <Share
                aria-label="Share"
                className="inline size-3.5 align-text-bottom text-brand-700"
              />{" "}
              Share and then <strong>Add to Home Screen</strong>.
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {deferredPrompt && (
            <Button
              className="h-7 px-2.5 text-xs"
              onClick={() => handleInstallClick(deferredPrompt)}
              size="sm"
              variant="primary"
            >
              Install app
            </Button>
          )}
          <button
            aria-label="Dismiss install banner"
            className="inline-flex size-7 items-center justify-center rounded-lg text-brand-700 transition-colors hover:bg-brand-100 hover:text-brand-950"
            onClick={handleDismiss}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
