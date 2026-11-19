import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonClasses } from "@/components/ui/button";

describe("buttonClasses", () => {
  it("defaults to a medium primary button", () => {
    const classes = buttonClasses();
    expect(classes).toContain("bg-brand-600");
    expect(classes).toContain("h-10");
  });

  it.each([
    ["secondary", "border-line"],
    ["ghost", "text-muted"],
    ["danger", "bg-red-600"],
  ] as const)("styles the %s variant", (variant, expected) => {
    expect(buttonClasses(variant)).toContain(expected);
  });

  it("sizes buttons and lets extra classes win", () => {
    expect(buttonClasses("primary", "sm")).toContain("h-8");
    expect(buttonClasses("primary", "lg", "h-14")).toContain("h-14");
    expect(buttonClasses("primary", "lg", "h-14")).not.toContain("h-12");
  });
});

describe("Button", () => {
  it("is a type=button by default and passes props through", async () => {
    const onClick = vi.fn();
    render(
      <Button className="w-full" onClick={onClick} size="sm" variant="ghost">
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("w-full", "h-8", "text-muted");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("can submit a form", () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});
