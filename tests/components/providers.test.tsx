import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="clerk">{children}</div>
  ),
}));
vi.mock("sonner", () => ({
  Toaster: (props: { position: string; richColors: boolean }) => (
    <div
      data-position={props.position}
      data-rich={String(props.richColors)}
      data-testid="toaster"
    />
  ),
}));

import { Providers } from "@/components/providers";

function QueryDefaults() {
  const options = useQueryClient().getDefaultOptions().queries;
  return (
    <p>
      stale {String(options?.staleTime)} retry {String(options?.retry)}
    </p>
  );
}

describe("Providers", () => {
  it("wraps the app in Clerk, TanStack Query and the toaster", () => {
    const { rerender } = render(
      <Providers>
        <QueryDefaults />
      </Providers>,
    );
    expect(screen.getByTestId("clerk")).toContainElement(
      screen.getByText("stale 30000 retry 1"),
    );
    expect(screen.getByTestId("toaster")).toHaveAttribute(
      "data-position",
      "bottom-right",
    );
    expect(screen.getByTestId("toaster")).toHaveAttribute("data-rich", "true");
    // The query client survives re-renders.
    rerender(
      <Providers>
        <QueryDefaults />
      </Providers>,
    );
    expect(screen.getByText("stale 30000 retry 1")).toBeInTheDocument();
  });
});
