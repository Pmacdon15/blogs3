import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { isLoaded: true, isSignedIn: false as boolean | undefined },
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mocks.session,
  SignInButton: ({
    children,
    mode,
  }: {
    children: React.ReactNode;
    mode: string;
  }) => (
    <div data-mode={mode} data-testid="sign-in">
      {children}
    </div>
  ),
  UserButton: () => <div data-testid="user-button" />,
}));

import { AuthButtons } from "@/components/auth-buttons";

beforeEach(() => {
  mocks.session = { isLoaded: true, isSignedIn: false };
});

describe("AuthButtons", () => {
  it("shows a placeholder until Clerk has loaded", () => {
    mocks.session = { isLoaded: false, isSignedIn: undefined };
    const { container } = render(<AuthButtons />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers a modal sign-in when signed out", () => {
    render(<AuthButtons />);
    expect(screen.getByTestId("sign-in")).toHaveAttribute("data-mode", "modal");
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(screen.queryByTestId("user-button")).toBeNull();
  });

  it("shows the user menu and a link to write when signed in", () => {
    mocks.session = { isLoaded: true, isSignedIn: true };
    render(<AuthButtons />);
    expect(screen.getByRole("link", { name: "Write" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByTestId("user-button")).toBeInTheDocument();
  });

  it("can leave out the admin link", () => {
    mocks.session = { isLoaded: true, isSignedIn: true };
    render(<AuthButtons showAdminLink={false} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("user-button")).toBeInTheDocument();
  });
});
