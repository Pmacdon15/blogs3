import type { Page } from "@playwright/test";
import { editorEnabled, editorSkipReason } from "../env";
import { expect, test } from "../fixtures";

/*
 * The whole life of a post in the studio, as the signed-in admin: write a
 * draft, keep it off the public site, publish, edit, unpublish and delete,
 * checking the editor stays accessible (axe + keyboard) on the way. The
 * steps share one post, so they run in order.
 */

test.describe.configure({ mode: "serial" });
test.skip(!editorEnabled, editorSkipReason);

const stamp = Date.now().toString(36);
const title = `E2E post ${stamp}`;
const slug = `e2e-post-${stamp}`;
const editedTitle = `${title} (edited)`;
let editUrl = "";

const actions = (page: Page) =>
  page.getByRole("toolbar", { name: "Editor actions" });
const addBlock = (page: Page) =>
  page.getByRole("toolbar", { name: "Add a block" });

async function expectPublicPost(page: Page, heading: string) {
  await page.goto(`/blog/${slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: heading }),
  ).toBeVisible();
}

/* Pages stream, so a 404 in a Suspense hole still answers 200: check the page. */
async function expectNotPublic(page: Page) {
  await page.goto(`/blog/${slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Post not found" }),
  ).toBeVisible();
}

test("the dashboard is accessible", async ({ page, expectAccessible }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Posts" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expectAccessible();
});

test("writes a draft with every kind of block", async ({
  page,
  expectAccessible,
}) => {
  await page.goto("/admin/posts/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "New post" }),
  ).toBeVisible();
  await expectAccessible();

  await page.getByLabel("Title", { exact: true }).fill(title);
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(slug);

  // A new block takes focus, so the body can be typed straight in.
  await addBlock(page).getByRole("button", { name: "Heading" }).click();
  await expect(
    page.getByLabel("Heading block 1", { exact: true }),
  ).toBeFocused();
  await page.keyboard.type("Getting started");
  await addBlock(page).getByRole("button", { name: "Text" }).click();
  await expect(page.getByLabel("Text block 2", { exact: true })).toBeFocused();
  await page.keyboard.type("First paragraph.\n\nSecond paragraph.");
  await addBlock(page).getByRole("button", { name: "Code" }).click();
  await expect(page.getByLabel("Code block 3", { exact: true })).toBeFocused();
  await page.keyboard.type("const answer = 42;");
  await page.getByLabel("Language for Code block 3").selectOption("typescript");

  await page.getByLabel("Excerpt").fill("Written by the end-to-end suite.");
  const tags = page.getByLabel("Tags");
  await tags.fill("e2e");
  await tags.press("Enter");
  await expect(actions(page).getByText("Unsaved changes")).toBeVisible();
  await expectAccessible();

  await page.keyboard.press("ControlOrMeta+s");
  await page.waitForURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
  editUrl = page.url();
  await expect(actions(page).getByText("All changes saved")).toBeVisible();
  await expect(actions(page).getByText("Draft", { exact: true })).toBeVisible();
  // Role queries skip the hidden copy of the previous page Next.js keeps.
  await expect(
    page.getByRole("textbox", { name: "Heading block 1", exact: true }),
  ).toHaveValue("Getting started");
});

test("keeps the draft off the public site", async ({
  page,
  expectAccessible,
}) => {
  await expectNotPublic(page);
  await page.goto("/admin?status=draft");
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  await expectAccessible();
});

test("shows validation errors on the field, and announces them", async ({
  page,
  expectAccessible,
}) => {
  await page.goto(editUrl);
  const titleField = page.getByLabel("Title", { exact: true });
  await titleField.fill("");
  await actions(page).getByRole("button", { name: "Save draft" }).click();
  await expect(titleField).toHaveAttribute("aria-invalid", "true");
  await expect(titleField).toHaveAccessibleDescription("Title is required");
  await expect(
    page.getByRole("alert").filter({ hasText: "Title is required" }),
  ).toBeVisible();
  await expect(
    page.getByText("Fix the highlighted fields first."),
  ).toBeVisible();
  await expectAccessible();

  await titleField.fill(title);
  await expect(actions(page).getByText("All changes saved")).toBeVisible();
});

test("previews the post before publishing", async ({
  page,
  expectAccessible,
}) => {
  await page.goto(editUrl);
  const preview = actions(page).getByRole("button", { name: "Preview" });
  await preview.click();
  await expect(
    actions(page).getByRole("button", { name: "Edit" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { level: 2, name: title }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Getting started" }),
  ).toBeVisible();
  await expectAccessible();
});

test("publishes, and the public site shows it", async ({
  page,
  expectAccessible,
}) => {
  await page.goto(editUrl);
  await actions(page).getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Post published")).toBeVisible();
  await expect(
    actions(page).getByText("Published", { exact: true }),
  ).toBeVisible();
  await expect(
    actions(page).getByRole("button", { name: "Unpublish" }),
  ).toBeVisible();

  await expectPublicPost(page, title);
  const article = page.getByRole("article");
  await expect(
    article.getByRole("heading", { level: 2, name: "Getting started" }),
  ).toBeVisible();
  await expect(article.getByText("Second paragraph.")).toBeVisible();
  await expect(article.locator("pre")).toContainText("const answer = 42;");
  await expectAccessible();

  // Listed on the home page and found by search.
  await page.goto("/");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await page.getByRole("combobox", { name: "Search posts" }).fill(stamp);
  await expect(
    page.getByRole("listbox", { name: "Search results" }).getByRole("option"),
  ).toHaveText([new RegExp(title)]);
});

test("saves changes to a published post", async ({ page }) => {
  await page.goto(editUrl);
  await page.getByLabel("Title", { exact: true }).fill(editedTitle);
  // Editing a post keeps its slug, so links don't break.
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(slug);
  await actions(page).getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved", { exact: true })).toBeVisible();
  await expect(actions(page).getByText("All changes saved")).toBeVisible();
  await expectPublicPost(page, editedTitle);
});

test("unpublishes back to a draft", async ({ page }) => {
  await page.goto(editUrl);
  await actions(page).getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByText("Moved back to drafts")).toBeVisible();
  await expect(actions(page).getByText("Draft", { exact: true })).toBeVisible();
  await expectNotPublic(page);
});

test("deletes through an accessible confirmation dialog", async ({
  page,
  expectAccessible,
}) => {
  await page.goto(editUrl);
  const deleteButton = actions(page).getByRole("button", { name: "Delete" });
  await deleteButton.click();

  const dialog = page.getByRole("alertdialog", { name: "Delete this post?" });
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const confirm = dialog.getByRole("button", { name: "Delete post" });
  // Focus starts on the safe choice and stays inside the dialog.
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
  await expectAccessible();

  // Escape cancels and puts focus back on the button that opened it.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(deleteButton).toBeFocused();

  await deleteButton.click();
  await confirm.click();
  await page.waitForURL(/\/admin$/);
  await expect(page.getByText("Post deleted")).toBeVisible();
  await expect(page.getByRole("link", { name: editedTitle })).toHaveCount(0);
  await expectNotPublic(page);
});
