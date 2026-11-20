import { describe, expect, it } from "vitest";
import {
  blockSchema,
  CODE_LANGUAGES,
  clampImageWidth,
  IMAGE_TYPES,
  MAX_BLOCKS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_WIDTH,
  MAX_TAGS,
  MIN_IMAGE_WIDTH,
  postIdSchema,
  postInputSchema,
  postPatchSchema,
  searchQuerySchema,
  slugify,
  slugSchema,
} from "@/lib/schemas";

const messages = (result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) => result.error?.issues.map((issue) => issue.message) ?? [];

describe("blockSchema", () => {
  it("accepts each block type and trims text", () => {
    expect(
      blockSchema.parse({ id: " h1 ", type: "heading", text: "  Hi  " }),
    ).toEqual({ id: "h1", type: "heading", text: "Hi" });
    expect(blockSchema.parse({ id: "t", type: "text", text: "Body" })).toEqual({
      id: "t",
      type: "text",
      text: "Body",
    });
    expect(
      blockSchema.parse({
        id: "i",
        type: "image",
        url: "https://example.com/a.png",
      }),
    ).toEqual({
      id: "i",
      type: "image",
      url: "https://example.com/a.png",
      alt: "",
    });
    expect(
      blockSchema.parse({
        id: "i2",
        type: "image",
        url: "https://example.com/a.png",
        width: 60,
      }),
    ).toEqual({
      id: "i2",
      type: "image",
      url: "https://example.com/a.png",
      alt: "",
      width: 60,
    });
    expect(clampImageWidth(5)).toBe(MIN_IMAGE_WIDTH);
    expect(clampImageWidth(150)).toBe(MAX_IMAGE_WIDTH);
    expect(clampImageWidth(64.6)).toBe(65);
    expect(blockSchema.parse({ id: "c", type: "code", code: "  x  " })).toEqual(
      { id: "c", type: "code", language: "plaintext", code: "  x  " },
    );
  });

  it("explains empty blocks", () => {
    expect(
      messages(blockSchema.safeParse({ id: "h", type: "heading", text: " " })),
    ).toEqual(["Heading can't be empty"]);
    expect(
      messages(blockSchema.safeParse({ id: "t", type: "text", text: "" })),
    ).toEqual(["Text can't be empty"]);
    expect(
      messages(blockSchema.safeParse({ id: "c", type: "code", code: "" })),
    ).toEqual(["Code can't be empty"]);
  });

  it("only takes https images and known languages", () => {
    expect(
      messages(
        blockSchema.safeParse({
          id: "i",
          type: "image",
          url: "http://example.com/a.png",
        }),
      ),
    ).toEqual(["Image must be an https URL"]);
    expect(
      blockSchema.safeParse({
        id: "c",
        type: "code",
        code: "x",
        language: "cobol",
      }).success,
    ).toBe(false);
    for (const language of CODE_LANGUAGES) {
      expect(
        blockSchema.safeParse({ id: "c", type: "code", code: "x", language })
          .success,
      ).toBe(true);
    }
  });

  it("rejects unknown block types and blank ids", () => {
    expect(blockSchema.safeParse({ id: "x", type: "video" }).success).toBe(
      false,
    );
    expect(
      blockSchema.safeParse({ id: " ", type: "text", text: "x" }).success,
    ).toBe(false);
  });
});

describe("slugSchema", () => {
  it.each(["hello", "hello-world", "a1-b2-3"])("accepts %s", (slug) => {
    expect(slugSchema.parse(slug)).toBe(slug);
  });

  it.each(["Hello", "hello--world", "-hello", "hello-", "hé"])(
    "rejects %s",
    (slug) => {
      expect(messages(slugSchema.safeParse(slug))).toEqual([
        "Use lowercase letters, numbers and single dashes",
      ]);
    },
  );

  it("requires a slug", () => {
    expect(messages(slugSchema.safeParse(""))).toContain("Slug is required");
  });
});

describe("postInputSchema", () => {
  it("fills in defaults and normalises tags", () => {
    expect(
      postInputSchema.parse({
        title: " Hello ",
        slug: "hello",
        tags: [" JS "],
      }),
    ).toEqual({
      title: "Hello",
      slug: "hello",
      excerpt: "",
      coverImageUrl: null,
      tags: ["js"],
      blocks: [],
    });
  });

  it("requires a title and an https cover", () => {
    expect(
      messages(postInputSchema.safeParse({ title: "", slug: "a" })),
    ).toEqual(["Title is required"]);
    expect(
      messages(
        postInputSchema.safeParse({
          title: "A",
          slug: "a",
          coverImageUrl: "ftp://x.test/a.png",
        }),
      ),
    ).toEqual(["Cover must be an https URL"]);
  });

  it("caps tags and blocks", () => {
    const tags = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`);
    expect(
      postInputSchema.safeParse({ title: "A", slug: "a", tags }).success,
    ).toBe(false);
    const blocks = Array.from({ length: MAX_BLOCKS + 1 }, (_, i) => ({
      id: `b${i}`,
      type: "text",
      text: "x",
    }));
    expect(
      postInputSchema.safeParse({ title: "A", slug: "a", blocks }).success,
    ).toBe(false);
  });
});

describe("postPatchSchema", () => {
  it("validates the fields it is given", () => {
    expect(postPatchSchema.parse({ title: "New" })).toMatchObject({
      title: "New",
    });
    expect(postPatchSchema.safeParse({ slug: "Bad Slug" }).success).toBe(false);
  });

  it("leaves out the fields a patch doesn't mention", () => {
    expect(postPatchSchema.parse({})).toEqual({});
    expect(postPatchSchema.parse({ title: "x" })).toEqual({ title: "x" });
  });

  it("keeps an explicit null cover (removing the cover)", () => {
    expect(postPatchSchema.parse({ coverImageUrl: null })).toEqual({
      coverImageUrl: null,
    });
  });

  it("validates every field it is given", () => {
    expect(
      postPatchSchema.parse({
        title: " T ",
        slug: "s",
        excerpt: " e ",
        coverImageUrl: "https://x.test/a.png",
        tags: [" A "],
        blocks: [{ id: "b", type: "text", text: "t" }],
      }),
    ).toEqual({
      title: "T",
      slug: "s",
      excerpt: "e",
      coverImageUrl: "https://x.test/a.png",
      tags: ["a"],
      blocks: [{ id: "b", type: "text", text: "t" }],
    });
    expect(
      postPatchSchema.safeParse({ coverImageUrl: "http://x.test/a.png" })
        .success,
    ).toBe(false);
  });
});

describe("postIdSchema", () => {
  it("only accepts uuids", () => {
    expect(
      postIdSchema.safeParse("6f1c2c1e-8d1b-4a59-9c3e-1d2b3c4d5e6f").success,
    ).toBe(true);
    expect(messages(postIdSchema.safeParse("nope"))).toEqual([
      "Not a valid post id",
    ]);
  });
});

describe("searchQuerySchema", () => {
  it("trims the query and defaults to empty", () => {
    expect(searchQuerySchema.parse({ q: "  next  " })).toEqual({ q: "next" });
    expect(searchQuerySchema.parse({})).toEqual({ q: "" });
    expect(searchQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(
      false,
    );
  });
});

describe("image limits", () => {
  it("allows common web image types up to 4 MB", () => {
    expect(IMAGE_TYPES).toContain("image/webp");
    expect(MAX_IMAGE_BYTES).toBe(4 * 1024 * 1024);
  });
});

describe("slugify", () => {
  it.each([
    ["Hello, World!", "hello-world"],
    ["  Crème brûlée  ", "creme-brulee"],
    ["---", ""],
    ["Next.js 16 & React 19", "next-js-16-react-19"],
  ])("%s → %s", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("stays within 120 characters without a trailing dash", () => {
    const slug = slugify(`${"a".repeat(119)} b`);
    expect(slug).toBe("a".repeat(119));
    expect(slugify("word ".repeat(40)).length).toBeLessThanOrEqual(120);
  });
});
