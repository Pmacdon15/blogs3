import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/actions/posts", () => ({ uploadImageAction: vi.fn() }));

import { BlockEditor, indent } from "@/components/admin/block-editor";
import type { FieldErrors } from "@/components/admin/field-error";
import { type Block, MAX_BLOCKS } from "@/lib/schemas";
import { renderWithClient } from "./utils";

let latest: Block[] = [];

function Harness({
  initial = [],
  errors = {},
}: {
  initial?: Block[];
  errors?: FieldErrors;
}) {
  const [blocks, setBlocks] = useState(initial);
  latest = blocks;
  return <BlockEditor blocks={blocks} errors={errors} onChange={setBlocks} />;
}

const toolbar = () => screen.getByRole("toolbar", { name: "Add a block" });

describe("BlockEditor", () => {
  it("indents with two spaces", () => {
    expect(indent("ab", 1, 1)).toEqual({ value: "a  b", caret: 3 });
    expect(indent("abcd", 1, 3)).toEqual({ value: "a  d", caret: 3 });
  });

  it("adds each kind of block from the toolbar and edits it", async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness />);
    expect(screen.getByText(/No content yet/)).toBeVisible();

    for (const name of ["Heading", "Text", "Image", "Code"]) {
      await user.click(within(toolbar()).getByRole("button", { name }));
    }
    expect(latest.map((block) => block.type)).toEqual([
      "heading",
      "text",
      "image",
      "code",
    ]);

    await user.type(screen.getByLabelText("Heading block 1"), "Intro");
    await user.type(screen.getByLabelText("Text block 2"), "Hello");
    await user.type(screen.getByLabelText("Image"), "https://img/a.png");
    await user.type(screen.getByLabelText("Alt text"), "A cat");
    await user.type(screen.getByLabelText("Caption"), "Cute");
    fireEvent.keyDown(screen.getByLabelText("Resize image right"), {
      key: "ArrowLeft",
    });
    await user.selectOptions(
      screen.getByLabelText("Language for Code block 4"),
      "bash",
    );
    await user.type(screen.getByLabelText("Code block 4"), "ls");
    expect(latest).toMatchObject([
      { text: "Intro" },
      { text: "Hello" },
      { url: "https://img/a.png", alt: "A cat", caption: "Cute", width: 95 },
      { language: "bash", code: "ls" },
    ]);
  });

  it("inserts Tab as two spaces in code and leaves Shift+Tab alone", () => {
    renderWithClient(
      <Harness
        initial={[{ id: "c", type: "code", language: "go", code: "ab" }]}
      />,
    );
    const code = screen.getByLabelText("Code block 1") as HTMLTextAreaElement;
    code.setSelectionRange(1, 1);
    fireEvent.keyDown(code, { key: "Tab" });
    expect(code).toHaveValue("a  b");
    expect(code.selectionStart).toBe(3);
    fireEvent.keyDown(code, { key: "Tab", shiftKey: true });
    fireEvent.keyDown(code, { key: "a" });
    expect(code).toHaveValue("a  b");

    // Switching themes and picking a starter snippet updates the code block.
    fireEvent.change(screen.getByLabelText("Theme for Code block 1"), {
      target: { value: "aurora" },
    });
    expect(screen.getByLabelText("Theme for Code block 1")).toHaveValue(
      "aurora",
    );
    fireEvent.change(
      screen.getByLabelText("Starter snippet for Code block 1"),
      {
        target: { value: "0" },
      },
    );
    expect(latest[0]).toMatchObject({
      type: "code",
      language: "typescript",
    });
    expect((latest[0] as { code: string }).code).toContain("fetchJson");
  });

  it("moves, duplicates, deletes and inserts between blocks", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <Harness
        initial={[
          { id: "a", type: "heading", text: "A" },
          { id: "b", type: "text", text: "B" },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Move Heading block 1 up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Text block 2 down" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Move Heading block 1 down" }),
    );
    expect(latest.map((block) => block.id)).toEqual(["b", "a"]);
    await user.click(
      screen.getByRole("button", { name: "Move Heading block 2 up" }),
    );
    expect(latest.map((block) => block.id)).toEqual(["a", "b"]);

    await user.click(
      screen.getByRole("button", { name: "Duplicate Text block 2" }),
    );
    expect(latest).toHaveLength(3);
    await user.click(
      screen.getByRole("button", { name: "Delete Text block 3" }),
    );
    expect(latest).toHaveLength(2);

    await user.click(
      screen.getByRole("button", { name: "Insert a block at position 2" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(latest).toHaveLength(2);
    await user.click(
      screen.getByRole("button", { name: "Insert a block at position 2" }),
    );
    await user.click(
      within(
        screen.getByRole("group", { name: "Block type for position 2" }),
      ).getByRole("button", { name: "Code" }),
    );
    expect(latest.map((block) => block.type)).toEqual([
      "heading",
      "code",
      "text",
    ]);
  });

  it("shows field errors on the right block", () => {
    renderWithClient(
      <Harness
        errors={{
          "blocks.0.text": ["Heading can't be empty"],
          "blocks.1.text": ["Text can't be empty"],
          "blocks.2.url": ["Image must be an https URL"],
          "blocks.2.alt": ["Too long"],
          "blocks.2.caption": ["Caption too long"],
          "blocks.3.code": ["Code can't be empty"],
          blocks: ["Too many blocks"],
        }}
        initial={[
          { id: "a", type: "heading", text: "" },
          { id: "b", type: "text", text: "" },
          { id: "c", type: "image", url: "", alt: "" },
          { id: "d", type: "code", language: "go", code: "" },
        ]}
      />,
    );
    expect(
      screen.getByLabelText("Heading block 1"),
    ).toHaveAccessibleDescription("Heading can't be empty");
    expect(screen.getByLabelText("Text block 2")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Code block 4")).toHaveAccessibleDescription(
      "Code can't be empty",
    );
    for (const message of [
      "Text can't be empty",
      "Image must be an https URL",
      "Too long",
      "Caption too long",
      "Too many blocks",
    ]) {
      expect(screen.getByText(message)).toBeVisible();
    }
    expect(screen.getByLabelText("Caption")).toHaveValue("");
  });

  it("stops adding at the block limit", () => {
    const many: Block[] = Array.from({ length: MAX_BLOCKS }, (_, i) => ({
      id: `b${i}`,
      type: "heading",
      text: "x",
    }));
    renderWithClient(<Harness initial={many} />);
    expect(
      within(toolbar()).getByRole("button", { name: "Text" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Duplicate Heading block 1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Insert a block at position 2" }),
    ).toBeDisabled();
  });

  it("reorders blocks via drag and drop", () => {
    renderWithClient(
      <Harness
        initial={[
          { id: "a", type: "heading", text: "A" },
          { id: "b", type: "text", text: "B" },
          { id: "c", type: "code", language: "bash", code: "ls" },
        ]}
      />,
    );

    const card2 = screen.getByLabelText("Text block 2").closest("li")
      ?.lastElementChild as HTMLElement;
    const card3 = screen.getByLabelText("Code block 3").closest("li")
      ?.lastElementChild as HTMLElement;

    // Drag events without an active drag are ignored.
    fireEvent.dragOver(card2);
    fireEvent.drop(card2);
    expect(latest.map((block) => block.id)).toEqual(["a", "b", "c"]);

    // Drag block 1 over block 3 and drop it there.
    const handle1 = screen.getByRole("button", {
      name: "Drag Heading block 1",
    });
    const setData = vi.fn();
    fireEvent.dragStart(handle1, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "0");

    fireEvent.dragOver(card3);
    // Repeated dragOver on the same target is a no-op.
    fireEvent.dragOver(card3);
    fireEvent.drop(card3);
    expect(latest.map((block) => block.id)).toEqual(["b", "c", "a"]);

    // Dropping on the dragged block itself keeps the order unchanged.
    const handleFirst = screen.getByRole("button", {
      name: "Drag Text block 1",
    });
    const card1 = screen.getByLabelText("Text block 1").closest("li")
      ?.lastElementChild as HTMLElement;
    fireEvent.dragStart(handleFirst);
    fireEvent.drop(card1);
    expect(latest.map((block) => block.id)).toEqual(["b", "c", "a"]);

    // Cancelling a drag clears the drag state without reordering.
    fireEvent.dragStart(handleFirst);
    fireEvent.dragOver(card2);
    fireEvent.dragEnd(handleFirst);
    expect(latest.map((block) => block.id)).toEqual(["b", "c", "a"]);
  });
});
