import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AutoTextarea, fitToContent } from "@/components/admin/auto-textarea";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  errorFor,
  errorWithin,
  FieldError,
} from "@/components/admin/field-error";
import { editPath, postPath } from "@/components/admin/paths";
import {
  formatDate,
  PostRows,
  parseStatusFilter,
} from "@/components/admin/post-rows";
import { StatusBadge } from "@/components/admin/status-badge";
import { StatusTabs } from "@/components/admin/status-tabs";
import { makeSummary } from "./utils";

describe("paths", () => {
  it("builds editor and public paths", () => {
    expect(editPath("p1")).toBe("/admin/posts/p1");
    expect(postPath("hi")).toBe("/blog/hi");
  });
});

describe("StatusBadge", () => {
  it("labels each status", () => {
    render(
      <>
        <StatusBadge status="draft" />
        <StatusBadge className="extra" status="published" />
      </>,
    );
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Published")).toHaveClass("extra");
  });
});

describe("StatusTabs", () => {
  it("marks the active tab", () => {
    render(<StatusTabs active="draft" />);
    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByRole("link", { name: "Published" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks none without an active filter", () => {
    render(<StatusTabs />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });
});

describe("PostRows", () => {
  const draft = makeSummary({ id: "d1", title: "A draft", slug: "a-draft" });
  const live = makeSummary({
    id: "p1",
    title: "Live post",
    slug: "live",
    status: "published",
  });
  const table = (ui: React.ReactNode) =>
    render(
      <table>
        <tbody>{ui}</tbody>
      </table>,
    );

  it("parses the status filter", () => {
    expect(parseStatusFilter("draft")).toBe("draft");
    expect(parseStatusFilter(["published", "draft"])).toBe("published");
    expect(parseStatusFilter("nope")).toBe("all");
    expect(parseStatusFilter(undefined)).toBe("all");
    expect(formatDate("2026-02-03T00:00:00.000Z")).toBe("Feb 3, 2026");
  });

  it("lists every post with edit links and view links for published ones", () => {
    table(<PostRows filter="all" posts={[draft, live]} />);
    expect(screen.getByRole("link", { name: "A draft" })).toHaveAttribute(
      "href",
      "/admin/posts/d1",
    );
    expect(screen.getByRole("link", { name: "Edit Live post" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View Live post" }),
    ).toHaveAttribute("href", "/blog/live");
    expect(screen.queryByRole("link", { name: "View A draft" })).toBeNull();
    expect(screen.getAllByText("Feb 3, 2026")).toHaveLength(2);
  });

  it("filters by status", () => {
    table(<PostRows filter="draft" posts={[draft, live]} />);
    expect(screen.getByText("A draft")).toBeInTheDocument();
    expect(screen.queryByText("Live post")).toBeNull();
  });

  it("shows an empty state per filter", () => {
    const { unmount } = table(<PostRows filter="all" posts={[]} />);
    expect(
      screen.getByRole("link", { name: "Write your first one" }),
    ).toHaveAttribute("href", "/admin/posts/new");
    unmount();
    table(<PostRows filter="draft" posts={[live]} />);
    expect(screen.getByText("No drafts.")).toBeInTheDocument();
    table(<PostRows filter="published" posts={[draft]} />);
    expect(screen.getByText("Nothing published yet.")).toBeInTheDocument();
  });
});

describe("FieldError", () => {
  it("renders only with a message", () => {
    const { container } = render(<FieldError id="x" />);
    expect(container).toBeEmptyDOMElement();
    render(<FieldError id="y" message="Required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("finds errors by key or within a key", () => {
    const errors = { title: ["A", "B"], "tags.2": ["Too long"] };
    expect(errorFor(errors, "title")).toBe("A");
    expect(errorFor(errors, "slug")).toBeUndefined();
    expect(errorWithin(errors, "tags")).toBe("Too long");
    expect(errorWithin(errors, "title")).toBe("A");
    expect(errorWithin(errors, "blocks")).toBeUndefined();
  });
});

describe("AutoTextarea", () => {
  it("grows to fit its content on input", () => {
    const onInput = vi.fn();
    render(
      <AutoTextarea aria-label="Body" defaultValue="" onInput={onInput} />,
    );
    const box = screen.getByRole("textbox", { name: "Body" });
    Object.defineProperty(box, "scrollHeight", { value: 120 });
    fireEvent.input(box, { target: { value: "lots" } });
    expect(box.style.height).toBe("120px");
    expect(onInput).toHaveBeenCalled();
  });

  it("forwards its element to a ref", () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    render(<AutoTextarea aria-label="Body" defaultValue="" ref={ref} />);
    expect(ref.current).toBe(screen.getByRole("textbox"));
  });

  it("works without an input handler and ignores null elements", () => {
    render(<AutoTextarea aria-label="Body" defaultValue="" />);
    fireEvent.input(screen.getByRole("textbox"), { target: { value: "x" } });
    expect(() => fitToContent(null)).not.toThrow();
  });
});

const dialogText = {
  title: "Delete this post?",
  description: "Gone for good.",
  confirmLabel: "Delete post",
};

/** Opens the dialog from a button, to check where focus goes back to. */
function Opener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Open
      </button>
      <ConfirmDialog
        {...dialogText}
        onCancel={() => setOpen(false)}
        onConfirm={vi.fn()}
        open={open}
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  const base = {
    title: "Delete this post?",
    description: "Gone for good.",
    confirmLabel: "Delete post",
  };

  it("renders nothing while closed", () => {
    const { container } = render(
      <ConfirmDialog
        {...base}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("focuses Cancel and confirms or cancels", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        {...base}
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
      />,
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete this post?",
    });
    expect(dialog).toHaveAccessibleDescription("Gone for good.");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Delete post" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.keyDown(dialog, { key: "a" });
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it("keeps Tab inside and gives focus back to its opener on close", async () => {
    const user = userEvent.setup();
    render(<Opener />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Delete post" });
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
  });

  it("keeps focus put while every button is disabled", () => {
    render(
      <ConfirmDialog
        {...base}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
        pending
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(fireEvent.keyDown(dialog, { key: "Tab" })).toBe(false);
    expect(fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })).toBe(
      false,
    );
  });

  it("disables both buttons while pending", () => {
    render(
      <ConfirmDialog
        {...base}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
        pending
      />,
    );
    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
