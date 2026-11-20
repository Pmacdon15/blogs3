import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadImageAction: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@/lib/actions/posts", () => ({
  uploadImageAction: mocks.uploadImageAction,
}));

import {
  ImageUpload,
  imageFileProblem,
  isHttpsUrl,
  resizedWidth,
} from "@/components/admin/image-upload";
import { addTag, TagsInput } from "@/components/admin/tags-input";
import { renderWithClient } from "./utils";

function Tags({ initial = [] as string[] }) {
  const [tags, setTags] = useState(initial);
  return <TagsInput onChange={setTags} value={tags} />;
}

describe("TagsInput", () => {
  it("normalizes and dedupes tags, up to the limit", () => {
    expect(addTag([], "  React ")).toEqual(["react"]);
    expect(addTag(["react"], "REACT")).toEqual(["react"]);
    expect(addTag([], " ")).toEqual([]);
    expect(addTag([], "x".repeat(40))).toEqual(["x".repeat(32)]);
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`);
    expect(addTag(ten, "more")).toBe(ten);
  });

  it("adds with Enter, comma and blur; removes with Backspace or ×", async () => {
    const user = userEvent.setup();
    render(<Tags />);
    const input = screen.getByLabelText("Tags");
    await user.type(input, "Next{Enter}");
    await user.type(input, "zod,");
    await user.type(input, "css");
    await user.tab();
    expect(screen.getByText("next")).toBeInTheDocument();
    expect(screen.getByText("zod")).toBeInTheDocument();
    expect(screen.getByText("css")).toBeInTheDocument();
    expect(screen.getByText("3/10 · Enter or comma to add")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Remove tag zod" }));
    expect(screen.queryByText("zod")).toBeNull();
    await user.click(input);
    await user.keyboard("{Backspace}");
    expect(screen.queryByText("css")).toBeNull();
    await user.type(input, "a{Backspace}");
    expect(screen.getByText("next")).toBeInTheDocument();
    await user.keyboard("{Backspace}{Backspace}");
    expect(screen.queryByText("next")).toBeNull();
    // Enter on an empty field adds nothing.
    await user.keyboard("{Enter}");
    expect(screen.getByText("0/10 · Enter or comma to add")).toBeVisible();
  });

  it("disables the field when full and shows errors", () => {
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`);
    render(<TagsInput error="Too many" onChange={vi.fn()} value={ten} />);
    expect(screen.getByLabelText("Tags")).toBeDisabled();
    expect(screen.getByText("Too many")).toBeVisible();
  });
});

function Picker({ initial = "", error }: { initial?: string; error?: string }) {
  const [url, setUrl] = useState(initial);
  return (
    <ImageUpload
      error={error}
      label="Cover image"
      onChange={setUrl}
      value={url}
    />
  );
}

function ResizablePicker() {
  const [url, setUrl] = useState("https://img.example/a.png");
  const [width, setWidth] = useState<number | undefined>(undefined);
  return (
    <ImageUpload
      label="Image"
      onChange={setUrl}
      onWidthChange={setWidth}
      value={url}
      width={width}
    />
  );
}

describe("ImageUpload", () => {
  beforeEach(() => {
    mocks.uploadImageAction.mockResolvedValue({
      ok: true,
      data: { url: "https://img.example/up.png" },
    });
  });

  it("checks URLs and files", () => {
    expect(isHttpsUrl("https://a.b/c.png")).toBe(true);
    expect(isHttpsUrl("http://a.b/c.png")).toBe(false);
    expect(isHttpsUrl("nope")).toBe(false);
    const file = (type: string, size: number) =>
      new File([new Uint8Array(size)], "f", { type });
    expect(imageFileProblem(file("image/png", 10))).toBeNull();
    expect(imageFileProblem(file("text/plain", 10))).toMatch(/PNG/);
    expect(imageFileProblem(file("image/png", 0))).toMatch(/4 MB/);
    expect(imageFileProblem(file("image/png", 5 * 1024 * 1024))).toMatch(
      /4 MB/,
    );
  });

  it("previews a pasted https URL and can remove it", async () => {
    const user = userEvent.setup();
    const { container } = renderWithClient(<Picker />);
    expect(container.querySelector("img")).toBeNull();
    await user.type(
      screen.getByLabelText("Cover image"),
      "https://img.example/a.png",
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://img.example/a.png",
    );
    await user.click(
      screen.getByRole("button", { name: "Remove cover image" }),
    );
    expect(screen.getByLabelText("Cover image")).toHaveValue("");
  });

  it("uploads a picked file and uses its URL", async () => {
    const user = userEvent.setup();
    renderWithClient(<Picker />);
    const fileInput = screen.getByLabelText("Upload cover image");
    const click = vi.spyOn(fileInput, "click");
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(click).toHaveBeenCalled();
    await user.upload(
      fileInput,
      new File(["png"], "a.png", { type: "image/png" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Cover image")).toHaveValue(
        "https://img.example/up.png",
      ),
    );
    expect(mocks.success).toHaveBeenCalledWith("Image uploaded");
  });

  it("rejects bad files before uploading and ignores an empty pick", () => {
    renderWithClient(<Picker error="Cover must be an https URL" />);
    const fileInput = screen.getByLabelText("Upload cover image");
    fireEvent.change(fileInput, {
      target: { files: [new File(["x"], "a.txt", { type: "text/plain" })] },
    });
    expect(mocks.error).toHaveBeenCalledWith(
      "Upload a PNG, JPEG, WebP, GIF or AVIF image.",
    );
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(mocks.uploadImageAction).not.toHaveBeenCalled();
    expect(screen.getByText("Cover must be an https URL")).toBeVisible();
    expect(screen.getByLabelText("Cover image")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows progress while uploading", async () => {
    mocks.uploadImageAction.mockReturnValue(new Promise(() => {}));
    renderWithClient(<Picker />);
    fireEvent.change(screen.getByLabelText("Upload cover image"), {
      target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
    });
    expect(
      await screen.findByRole("button", { name: "Uploading…" }),
    ).toBeDisabled();
  });

  it("resizes the image preview via drag handles, keyboard and double-click", () => {
    expect(resizedWidth(80, -100, 400)).toBe(55);
    expect(resizedWidth(80, -100, 0)).toBe(60);

    renderWithClient(<ResizablePicker />);
    const box = screen.getByTestId("image-preview-box");
    expect(box).toHaveStyle({ width: "100%" });

    const rightHandle = screen.getByLabelText("Resize image right");
    const leftHandle = screen.getByLabelText("Resize image left");

    // Drag right handle left by 100px (default 500px fallback in jsdom -> -20%).
    fireEvent.pointerDown(rightHandle, { clientX: 300 });
    fireEvent.pointerMove(window, { clientX: 200 });
    fireEvent.pointerUp(window);
    expect(box).toHaveStyle({ width: "80%" });

    // Drag left handle right by 50px (-10%).
    fireEvent.pointerDown(leftHandle, { clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 150 });
    fireEvent.pointerUp(window);
    expect(box).toHaveStyle({ width: "70%" });

    // Keyboard ArrowLeft / ArrowRight and ignored key.
    fireEvent.keyDown(rightHandle, { key: "ArrowLeft" });
    expect(box).toHaveStyle({ width: "65%" });
    fireEvent.keyDown(rightHandle, { key: "ArrowRight" });
    expect(box).toHaveStyle({ width: "70%" });
    fireEvent.keyDown(rightHandle, { key: "Enter" });
    expect(box).toHaveStyle({ width: "70%" });

    // Double-click resets to 100%.
    fireEvent.doubleClick(rightHandle);
    expect(box).toHaveStyle({ width: "100%" });
  });
});
