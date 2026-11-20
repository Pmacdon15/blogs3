import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BeforeInstallPromptEvent,
  InstallAppBanner,
} from "@/components/install-app-banner";

function createPromptEvent(
  outcome: "accepted" | "dismissed" = "accepted",
): BeforeInstallPromptEvent & { promptMock: ReturnType<typeof vi.fn> } {
  const promptMock = vi.fn(async () => {});
  const event = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as BeforeInstallPromptEvent & { promptMock: ReturnType<typeof vi.fn> };
  event.prompt = promptMock;
  event.promptMock = promptMock;
  event.userChoice = Promise.resolve({ outcome, platform: "web" });
  return event;
}

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function setUserAgent(
  userAgent: string,
  options: {
    platform?: string;
    maxTouchPoints?: number;
    standalone?: boolean;
  } = {},
) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: options.platform ?? "Linux x86_64",
  });
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: options.maxTouchPoints ?? 0,
  });
  Object.defineProperty(window.navigator, "standalone", {
    configurable: true,
    value: options.standalone,
  });
}

describe("InstallAppBanner", () => {
  const originalMatchMedia = window.matchMedia;
  const originalUserAgent = window.navigator.userAgent;
  const originalPlatform = window.navigator.platform;
  const originalMaxTouchPoints = window.navigator.maxTouchPoints;

  beforeEach(() => {
    window.localStorage.clear();
    setMatchMedia(false);
    setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    );
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    setUserAgent(originalUserAgent, {
      platform: originalPlatform,
      maxTouchPoints: originalMaxTouchPoints,
      standalone: undefined,
    });
    vi.restoreAllMocks();
  });

  it("renders nothing initially when no install prompt has fired on desktop", () => {
    const { container } = render(<InstallAppBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the install banner when beforeinstallprompt fires and installs on click", async () => {
    render(<InstallAppBanner />);

    const promptEvent = createPromptEvent("accepted");
    act(() => {
      window.dispatchEvent(promptEvent);
    });

    expect(promptEvent.defaultPrevented).toBe(true);
    const banner = screen.getByRole("complementary", { name: /install app/i });
    expect(banner).toHaveTextContent(/install blogs on your device/i);

    const installButton = screen.getByRole("button", { name: /install app/i });
    await act(async () => {
      fireEvent.click(installButton);
    });

    expect(promptEvent.promptMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("complementary", { name: /install app/i }),
    ).toBeNull();
  });

  it("hides the banner when the user declines the native install prompt and can show again if re-prompted", async () => {
    render(<InstallAppBanner />);

    const declinedPrompt = createPromptEvent("dismissed");
    act(() => {
      window.dispatchEvent(declinedPrompt);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /install app/i }));
    });

    expect(declinedPrompt.promptMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("complementary", { name: /install app/i }),
    ).toBeNull();

    const secondPrompt = createPromptEvent("accepted");
    act(() => {
      window.dispatchEvent(secondPrompt);
    });
    expect(
      screen.getByRole("complementary", { name: /install app/i }),
    ).toBeInTheDocument();
  });

  it("shows iOS Add to Home Screen instructions on iPhone Safari and iPadOS Safari", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      { platform: "iPhone", maxTouchPoints: 5 },
    );

    const { unmount } = render(<InstallAppBanner />);
    const banner = screen.getByRole("complementary", { name: /install app/i });
    expect(banner).toHaveTextContent(/add to home screen/i);
    expect(screen.queryByRole("button", { name: /^install app$/i })).toBeNull();
    unmount();

    // iPadOS desktop-class User-Agent (MacIntel with multi-touch)
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      { platform: "MacIntel", maxTouchPoints: 5 },
    );
    render(<InstallAppBanner />);
    expect(
      screen.getByRole("complementary", { name: /install app/i }),
    ).toHaveTextContent(/add to home screen/i);
  });

  it("does not show iOS Safari guide on iOS Chrome (CriOS)", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/135.0.0.0 Mobile/15E148 Safari/604.1",
      { platform: "iPhone", maxTouchPoints: 5 },
    );
    const { container } = render(<InstallAppBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when already running in standalone display mode or navigator.standalone", () => {
    setMatchMedia(true);
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      { platform: "iPhone", maxTouchPoints: 5 },
    );

    const { container, unmount } = render(<InstallAppBanner />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    // Also test when matchMedia is unavailable and navigator.standalone is true
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      { platform: "iPhone", maxTouchPoints: 5, standalone: true },
    );

    const second = render(<InstallAppBanner />);
    expect(second.container).toBeEmptyDOMElement();
  });

  it("persists dismissal in localStorage and skips showing when previously dismissed", () => {
    const { unmount } = render(<InstallAppBanner />);

    act(() => {
      window.dispatchEvent(createPromptEvent());
    });

    fireEvent.click(
      screen.getByRole("button", { name: /dismiss install banner/i }),
    );
    expect(
      screen.queryByRole("complementary", { name: /install app/i }),
    ).toBeNull();
    expect(window.localStorage.getItem("blogs:install-banner-dismissed")).toBe(
      "1",
    );
    unmount();

    // Re-mounting when already dismissed does not show the banner
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      { platform: "iPhone", maxTouchPoints: 5 },
    );
    const { container } = render(<InstallAppBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tolerates localStorage failures when reading or writing dismissal state", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    render(<InstallAppBanner />);
    act(() => {
      window.dispatchEvent(createPromptEvent());
    });

    expect(
      screen.getByRole("complementary", { name: /install app/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /dismiss install banner/i }),
    );
    expect(
      screen.queryByRole("complementary", { name: /install app/i }),
    ).toBeNull();
  });

  it("hides the banner when the appinstalled event fires", () => {
    render(<InstallAppBanner />);

    act(() => {
      window.dispatchEvent(createPromptEvent());
    });
    expect(
      screen.getByRole("complementary", { name: /install app/i }),
    ).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(
      screen.queryByRole("complementary", { name: /install app/i }),
    ).toBeNull();
  });
});
