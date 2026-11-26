import { FIXTURES } from "../env";
import { expect, focusIsVisible, test } from "../fixtures";

// Pages stream under Partial Prerendering, so a 404 inside a Suspense hole
// still answers 200: check what the page says, not the status code.

/*
 * WCAG 2.2 AA on the reading site: an axe scan of every kind of page, plus
 * the things axe can't see (keyboard access, visible focus, reflow).
 */

const PAGES = [
  { name: "home", path: "/", heading: "Notes, guides and ideas" },
  { name: "about", path: "/about", heading: "Hi, I'm Patrick" },
  {
    name: "post",
    path: `/blog/${FIXTURES.post.slug}`,
    heading: FIXTURES.post.title,
  },
  {
    name: "missing post",
    path: "/blog/no-such-post",
    heading: "Post not found",
  },
  {
    name: "missing page",
    path: "/no-such-page",
    heading: "This page wandered off",
  },
  {
    name: "MCP guide",
    path: "/admin/mcp",
    heading: "Connect an AI assistant",
  },
] as const;

for (const { name, path, heading } of PAGES) {
  test(`${name} page has no axe violations`, async ({
    page,
    expectAccessible,
  }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(heading) }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expectAccessible();
  });
}

test("a skip link jumps past the header to the content", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Keyboard navigation is a desktop concern.");
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
  // The next Tab continues inside the content, not back in the header.
  await page.keyboard.press("Tab");
  await expect(page.locator("main :focus")).toHaveCount(1);
});

test("every stop in the tab order shows where focus is", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Keyboard navigation is a desktop concern.");
  for (const path of ["/", `/blog/${FIXTURES.post.slug}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const missing: string[] = [];
    let stops = 0;
    // Tab until focus runs off the end of the page (back to <body>).
    for (; stops < 60; stops++) {
      await page.keyboard.press("Tab");
      const atEnd = await page.evaluate(
        () => document.activeElement === document.body,
      );
      if (atEnd) break;
      if (!(await focusIsVisible(page))) {
        missing.push(
          await page.evaluate(
            () => document.activeElement?.outerHTML.slice(0, 120) ?? "",
          ),
        );
      }
    }
    expect(stops, `${path} has a tab order`).toBeGreaterThan(3);
    expect(missing, `${path}: focus with no visible indicator`).toEqual([]);
  }
});

test("search works from the keyboard and announces results", async ({
  page,
  expectAccessible,
}) => {
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search posts" });
  await search.fill("fixture");
  const results = page.getByRole("listbox", { name: "Search results" });
  await expect(results.getByRole("option")).toHaveCount(2);
  await expect(page.getByRole("status")).toHaveText("2 results");
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await expectAccessible();

  await search.press("ArrowDown");
  const first = results.getByRole("option").first();
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(search).toHaveAttribute(
    "aria-activedescendant",
    (await first.getAttribute("id")) as string,
  );
  await search.press("Escape");
  await expect(search).toHaveAttribute("aria-expanded", "false");

  await search.fill("zzzz-nothing");
  await expect(page.getByRole("status")).toHaveText(
    "No posts match “zzzz-nothing”.",
  );

  await search.fill(FIXTURES.post.title);
  await expect(results.getByRole("option")).toHaveCount(1);
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/blog/${FIXTURES.post.slug}$`));
});

test("pages reflow at 320px without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/", `/blog/${FIXTURES.post.slug}`, "/admin/mcp"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});

test("a post's structure is exposed to assistive tech", async ({ page }) => {
  await page.goto(`/blog/${FIXTURES.post.slug}`);
  const article = page.getByRole("article");
  await expect(
    article.getByRole("heading", { level: 2, name: "A section heading" }),
  ).toBeVisible();
  await expect(article.getByText("It has two paragraphs.")).toBeVisible();
  await expect(article.locator("pre")).toContainText("export const answer");
  // The theme switcher is a group of toggle buttons.
  const themes = page.getByRole("group", { name: "Code color theme" });
  const pressed = themes.locator('button[aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);
  await themes.getByRole("button", { name: "Dracula" }).click();
  await expect(themes.getByRole("button", { name: "Dracula" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("drafts never reach the public site", async ({ page }) => {
  await page.goto(`/blog/${FIXTURES.draft.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Post not found" }),
  ).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: FIXTURES.post.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: FIXTURES.draft.title }),
  ).toHaveCount(0);
});
