import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useOffline: vi.fn(() => false),
}));

vi.mock("next/offline", () => ({
  useOffline: mocks.useOffline,
}));

import { OfflineBanner } from "@/components/offline-banner";

describe("OfflineBanner", () => {
  it("renders nothing while online or during server prerendering", () => {
    mocks.useOffline.mockReturnValue(false);
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces offline status and automatic retry when offline", () => {
    mocks.useOffline.mockReturnValue(true);
    render(<OfflineBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(banner).toHaveTextContent(
      /you're offline.*retry automatically when your connection returns/i,
    );
  });
});
