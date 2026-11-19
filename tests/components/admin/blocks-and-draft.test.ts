import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPES,
  completeBlocks,
  duplicateBlock,
  insertBlock,
  moveBlock,
  newBlock,
  removeBlock,
  replaceBlock,
} from "@/components/admin/blocks";
import {
  draftFromPost,
  emptyDraft,
  snapshot,
  toInput,
  validateDraft,
} from "@/components/admin/draft";
import type { Block } from "@/lib/schemas";
import { makePost } from "./utils";

const a: Block = { id: "a", type: "heading", text: "A" };
const b: Block = { id: "b", type: "text", text: "B" };
const c: Block = { id: "c", type: "code", language: "bash", code: "ls" };

describe("block list helpers", () => {
  it("makes an empty block of each type with a fresh id", () => {
    const blocks = BLOCK_TYPES.map(newBlock);
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "text",
      "image",
      "code",
    ]);
    expect(blocks[2]).toMatchObject({ url: "", alt: "", caption: "" });
    expect(blocks[3]).toMatchObject({ language: "plaintext", code: "" });
    expect(new Set(blocks.map((block) => block.id)).size).toBe(4);
  });

  it("inserts, moves, duplicates, removes and replaces", () => {
    expect(insertBlock([a, c], 1, b)).toEqual([a, b, c]);
    expect(moveBlock([a, b, c], 0, 1)).toEqual([b, a, c]);
    expect(moveBlock([a, b, c], 2, -1)).toEqual([a, c, b]);
    const same = [a, b];
    expect(moveBlock(same, 0, -1)).toBe(same);
    expect(moveBlock(same, 1, 1)).toBe(same);
    const copied = duplicateBlock([a, b], 0);
    expect(copied).toHaveLength(3);
    expect(copied[1]).toMatchObject({ type: "heading", text: "A" });
    expect(copied[1]?.id).not.toBe("a");
    expect(removeBlock([a, b, c], 1)).toEqual([a, c]);
    expect(replaceBlock([a, b], 1, c)).toEqual([a, c]);
  });

  it("keeps only complete blocks for the preview", () => {
    expect(
      completeBlocks([a, { id: "e", type: "text", text: " " }, c]),
    ).toEqual([a, c]);
  });
});

describe("drafts", () => {
  it("builds a draft from a post", () => {
    const post = makePost({
      coverImageUrl: "https://img/c.png",
      blocks: [
        { id: "i1", type: "image", url: "https://img/a.png", alt: "" },
        {
          id: "i2",
          type: "image",
          url: "https://img/b.png",
          alt: "",
          caption: "Hi",
        },
        b,
      ],
    });
    const draft = draftFromPost(post);
    expect(draft.coverImageUrl).toBe("https://img/c.png");
    expect(draft.blocks[0]).toMatchObject({ caption: "" });
    expect(draft.blocks[1]).toMatchObject({ caption: "Hi" });
    expect(draftFromPost(makePost()).coverImageUrl).toBe("");
  });

  it("shapes input for the schema", () => {
    const input = toInput({
      ...emptyDraft,
      coverImageUrl: " ",
      blocks: [
        { id: "i1", type: "image", url: "u", alt: "", caption: " " },
        { id: "i2", type: "image", url: "u", alt: "", caption: "Cap" },
        b,
      ],
    });
    expect(input.coverImageUrl).toBeNull();
    expect(input.blocks[0]).not.toHaveProperty("caption");
    expect(input.blocks[1]).toMatchObject({ caption: "Cap" });
    expect(snapshot(emptyDraft)).toBe(snapshot({ ...emptyDraft }));
  });

  it("validates with the shared schema", () => {
    const ok = validateDraft({
      ...emptyDraft,
      title: "T",
      slug: "t",
      tags: ["X"],
    });
    expect(ok).toEqual({
      ok: true,
      input: expect.objectContaining({ title: "T", tags: ["x"] }),
    });
    const bad = validateDraft({
      ...emptyDraft,
      blocks: [{ id: "h", type: "heading", text: "" }],
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.title).toEqual(["Title is required"]);
    expect(bad.errors.slug?.length).toBe(2);
    expect(bad.errors["blocks.0.text"]).toEqual(["Heading can't be empty"]);
  });
});
