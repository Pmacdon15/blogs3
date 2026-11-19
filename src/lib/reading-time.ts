import type { Block } from "@/lib/schemas";

/** Average adult reading speed for prose, in words per minute. */
export const WORDS_PER_MINUTE = 230;

export function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function blockText(block: Block) {
  switch (block.type) {
    case "heading":
    case "text":
      return block.text;
    case "code":
      return block.code;
    case "image":
      return block.caption ?? "";
  }
}

/** Minutes to read a post's blocks, rounded up, at least 1. */
export function readingMinutes(blocks: Block[]) {
  const words = blocks.reduce(
    (total, block) => total + countWords(blockText(block)),
    0,
  );
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function formatReadingTime(minutes: number) {
  return `${minutes} min read`;
}
