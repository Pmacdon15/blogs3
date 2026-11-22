import { AxeBuilder } from "@axe-core/playwright";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  type BrowserContext,
  test as base,
  expect,
  type Page,
} from "@playwright/test";

export { expect };

/** axe-core rule tags for WCAG 2.0, 2.1 and 2.2, levels A and AA. */
export const WCAG_AA_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
];

/*
 * Without a real Clerk instance (CI with placeholder keys), Clerk's
 * middleware sends every page load on a dev instance to the Frontend API for
 * a "handshake" unless the browser already has a dev-browser token, and the
 * placeholder Frontend API doesn't exist. A dev-browser cookie plus
 * `__client_uat=0` ("signed out since 0") lets the middleware decide
 * signed-out on its own; clerk-js can't load either, so those requests are
 * dropped instead of left to time out.
 */
async function signedOutWithoutClerk(context: BrowserContext, url: string) {
  await context.route(/^https:\/\/[^/]+\.clerk\.accounts\.dev\//, (route) =>
    route.abort(),
  );
  await context.addCookies([
    { name: "__clerk_db_jwt", value: "e2e", url },
    { name: "__client_uat", value: "0", url },
  ]);
}

function describeViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
  return violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n${violation.nodes
        .map((node) => `  - ${node.target.join(" ")}`)
        .join("\n")}`,
  );
}

type A11yOptions = {
  /** Only scan inside this selector. */
  include?: string;
};

export const test = base.extend<{
  /** Fails the test on any WCAG 2.2 A/AA violation axe finds on the page as it is now. */
  expectAccessible: (options?: A11yOptions) => Promise<void>;
}>({
  context: async ({ context, baseURL }, use) => {
    if (process.env.CLERK_FAPI) await setupClerkTestingToken({ context });
    else await signedOutWithoutClerk(context, baseURL as string);
    await use(context);
  },
  expectAccessible: async ({ page }, use, testInfo) => {
    let scans = 0;
    await use(async (options = {}) => {
      let builder = new AxeBuilder({ page })
        .withTags(WCAG_AA_TAGS)
        // Next.js's dev overlay, never in a production build.
        .exclude("nextjs-portal");
      if (options.include) builder = builder.include(options.include);
      const results = await builder.analyze();
      scans += 1;
      await testInfo.attach(`axe-${scans}.json`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });
      expect(
        describeViolations(results.violations),
        `axe found WCAG AA problems on ${page.url()}`,
      ).toEqual([]);
    });
  },
});

/**
 * Whether the focused element (or the card it covers) shows a focus
 * indicator: an outline or a ring (box-shadow).
 */
export async function focusIsVisible(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) {
      return false;
    }
    const candidates = [active, active.closest("article")].filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    return candidates.some((element) => {
      const style = getComputedStyle(element);
      const outline =
        style.outlineStyle !== "none" &&
        Number.parseFloat(style.outlineWidth) > 0;
      return outline || style.boxShadow !== "none";
    });
  });
}
