import { createElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  callPage,
  pendingParams,
  pendingSearchParams,
  renderShell,
} from "../helpers/render-page";
import { displayPath, findPageFiles, routeFor } from "../helpers/route-files";

/*
 * Every page under src/app, rendered the way `next build` prerenders it:
 * params and searchParams never resolve, cached reads resolve at once, and
 * the session is out of reach. What comes out is the page's static shell,
 * which must already say what the page is (an <h1>, or visible text for the
 * Clerk sign-in/up pages) and must never have asked Clerk who is signed in.
 * Pages are discovered from disk, so new ones are covered automatically.
 * (tests/build/static-shell.test.ts checks the real build output.)
 */

const mocks = vi.hoisted(() => {
  const never = () => new Promise<never>(() => {});
  return {
    auth: vi.fn(never),
    currentUser: vi.fn(never),
    cookies: vi.fn(never),
    headers: vi.fn(never),
    clerkClient: vi.fn(never),
  };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: Object.assign(mocks.auth, { protect: mocks.auth }),
  currentUser: mocks.currentUser,
  clerkClient: mocks.clerkClient,
  clerkMiddleware: vi.fn(),
  createRouteMatcher: vi.fn(() => () => false),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
  headers: mocks.headers,
  draftMode: vi.fn(() => ({ isEnabled: false })),
}));

// Clerk's client components render nothing on the server; neither do these.
// Any hook reports "still loading", like Clerk before it has a session.
vi.mock("@clerk/nextjs", () => {
  const stub = (name: string) =>
    function ClerkStub({ children }: { children?: ReactNode }) {
      return createElement("div", { "data-clerk": name }, children);
    };
  const hook = () => ({
    isLoaded: false,
    isSignedIn: undefined,
    userId: null,
    user: null,
  });
  return new Proxy(
    {},
    {
      has: (_target, key) => typeof key === "string",
      get: (_target, key) => {
        if (typeof key !== "string" || key === "then") return undefined;
        return key.startsWith("use") ? hook : stub(key);
      },
    },
  );
});

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound() in the static shell");
  }),
  redirect: vi.fn(() => {
    throw new Error("redirect() in the static shell");
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}));

// An empty blog: cached reads resolve right away with nothing in them.
vi.mock("@/db/posts", () => ({
  dbListPublishedPosts: vi.fn(async () => []),
  dbGetPublishedPostBySlug: vi.fn(async () => null),
  dbSearchPublishedPosts: vi.fn(async () => []),
  dbListAllPosts: vi.fn(async () => []),
  dbGetPostById: vi.fn(async () => null),
  dbFindPostIdBySlug: vi.fn(async () => null),
  dbCreatePost: vi.fn(),
  dbUpdatePost: vi.fn(),
  dbSetPostStatus: vi.fn(),
  dbDeletePost: vi.fn(),
  toPost: vi.fn(),
  toSummary: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ put: vi.fn() }));

const { Providers } = await import("@/components/providers");

/** Clerk's catch-all pages render Clerk's widget, which has no server HTML. */
const CLERK_PAGES = /^\/sign-(in|up)(\/|$)/;

const pages = findPageFiles().map((file) => ({
  file,
  label: displayPath(file),
  route: routeFor(file),
}));

/** The text a visitor would see: no scripts, styles or aria-hidden decoration. */
function visibleText(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const node of doc.querySelectorAll(
    'script, style, template, [aria-hidden="true"], [hidden]',
  )) {
    node.remove();
  }
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("page discovery", () => {
  test("finds the pages under src/app (skipping _private folders)", () => {
    for (const page of pages) {
      expect(page.route.startsWith("/")).toBe(true);
      expect(page.label).not.toMatch(/\/_/);
    }
  });
});

describe.each(pages)("$route ($label)", ({ file, label, route }) => {
  test("renders a static shell without the session", async () => {
    const { default: Page } = (await import(/* @vite-ignore */ file)) as {
      default: (props: never) => ReactNode;
    };

    const html = await renderShell(
      <Providers>
        {callPage(Page, {
          params: pendingParams(),
          searchParams: pendingSearchParams(),
        })}
      </Providers>,
    );

    for (const [name, fn] of Object.entries(mocks)) {
      expect(
        fn,
        `${label} called ${name}() while prerendering its shell. Read the session only inside a <Suspense> hole, after awaiting params/searchParams.`,
      ).not.toHaveBeenCalled();
    }

    const text = visibleText(html);
    expect(
      text,
      `${label}'s static shell has no visible text. Keep headings and labels outside <Suspense>.`,
    ).not.toBe("");
    // A dynamic route's heading is its data (the post title), so it streams
    // in; its shell must still have visible text (checked above).
    if (!CLERK_PAGES.test(route) && !route.includes("[")) {
      expect(
        html,
        `${label}'s static shell has no <h1>. Render the page heading outside <Suspense> so the shell says what the page is.`,
      ).toMatch(/<h1[\s>]/);
    }
  });
});
