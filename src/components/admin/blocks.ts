import { type Block, type BlockType, blockSchema } from "@/lib/schemas";

/*
 * Pure helpers for the block editor's list. Every change returns a new
 * array, so React state updates stay simple and easy to test.
 */

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  code: "Code",
};

export const BLOCK_TYPES = Object.keys(BLOCK_LABELS) as BlockType[];

export function newBlock(type: BlockType): Block {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading":
      return { id, type, text: "" };
    case "text":
      return { id, type, text: "" };
    case "image":
      return { id, type, url: "", alt: "", caption: "" };
    case "code":
      return { id, type, language: "plaintext", code: "" };
  }
}

export function insertBlock(blocks: Block[], index: number, block: Block) {
  return [...blocks.slice(0, index), block, ...blocks.slice(index)];
}

export function moveBlock(blocks: Block[], index: number, by: -1 | 1) {
  return reorderBlock(blocks, index, index + by);
}

export function reorderBlock(blocks: Block[], from: number, to: number) {
  if (
    from === to ||
    from < 0 ||
    from >= blocks.length ||
    to < 0 ||
    to >= blocks.length
  ) {
    return blocks;
  }
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function duplicateBlock(blocks: Block[], index: number) {
  return insertBlock(blocks, index + 1, {
    ...blocks[index],
    id: crypto.randomUUID(),
  });
}

export function removeBlock(blocks: Block[], index: number) {
  return blocks.filter((_, i) => i !== index);
}

export function replaceBlock(blocks: Block[], index: number, block: Block) {
  return blocks.map((current, i) => (i === index ? block : current));
}

/** The blocks that would pass validation, for the preview. */
export function completeBlocks(blocks: Block[]) {
  return blocks.flatMap((block) => {
    const parsed = blockSchema.safeParse(block);
    return parsed.success ? [parsed.data] : [];
  });
}
