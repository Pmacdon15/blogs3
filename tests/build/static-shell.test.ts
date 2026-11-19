import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectSources } from "../helpers/route-files";

/*
 * Checks the output of `next build` (run `bun run test:build`). Every page the
 * build produced is read from its manifests, so new pages are covered without
 * touching this file.
 *
 * With Cache Components, `next build` sorts pages into:
 *   ○ Static   the whole page is prerendered
 *   ◐ Partial  a static HTML shell is prerendered; small holes stream in
 *   ƒ Dynamic  the prerender came out empty, so the server renders it all
 *
 * No page may be ƒ. Pages that read nothing from the URL must be ○, and so
 * must every page under `ensureStatic = "navigation"` (the build itself
 * enforces that too; this makes the expectation explicit).
 */

const ROOT = path.resolve(__dirname, "../..");
const NEXT = path.join(ROOT, ".next");
const MANIFEST = path.join(NEXT, "prerender-manifest.json");
const APP = path.join(ROOT, "src/app");

/** Pages that read no params/searchParams, so nothing stops them being ○. */
const FULLY_STATIC = ["/", "/sign-in", "/sign-up", "/shell-check"];

type Prerender = {
  routeType?: "page" | "route" | "shell" | "fallback";
  response?: "empty" | "initial" | "complete";
  compute?: "static" | "resuming" | "blocking";
  /** For a concrete path of a dynamic route, e.g. "/sign-in" → "/sign-in/[[...sign-in]]". */
  srcRoute?: string;
};

const built = existsSync(MANIFEST);
const read = <T>(file: string): T =>
  JSON.parse(readFileSync(path.join(NEXT, file), "utf8"));

/** The page's ○/◐/ƒ symbol, the way `next build` prints it. */
function symbolFor(entry: Prerender | undefined) {
  if (!entry) return "ƒ";
  if (entry.response === "empty" || entry.compute === "blocking") return "ƒ";
  return entry.compute === "static" ? "○" : "◐";
}

/** The prerendered HTML for a route, e.g. "/" → index.html, "/blog/[slug]" → blog/[slug].html. */
function htmlFor(route: string) {
  const file = path.join(
    NEXT,
    "server/app",
    `${route === "/" ? "index" : route.slice(1)}.html`,
  );
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

/** The source file for an app path such as "/(public)/blog/[slug]/page" (or a layout above it). */
function sourceFor(appPath: string) {
  for (const ext of ["tsx", "ts", "jsx", "js"]) {
    const file = path.join(APP, `${appPath}.${ext}`);
    if (existsSync(file)) return file;
  }
  return null;
}

/** The page file and every layout above it: `ensureStatic` on any of them covers the page. */
function segmentFiles(appPath: string) {
  const dirs = appPath.split("/").slice(1, -1);
  const files = [sourceFor(appPath)];
  for (let depth = 0; depth <= dirs.length; depth += 1) {
    files.push(sourceFor(["", ...dirs.slice(0, depth), "layout"].join("/")));
  }
  return files.filter((file): file is string => file !== null);
}

describe.skipIf(!built && !process.env.REQUIRE_BUILD)(
  "next build output",
  () => {
    it("has a build to check", () => {
      expect(built, "run `next build` before `bun run test:build`").toBe(true);
    });

    if (!built) return;

    const manifest = read<{
      routes: Record<string, Prerender>;
      dynamicRoutes: Record<string, Prerender>;
    }>("prerender-manifest.json");
    const appPaths = read<Record<string, string>>(
      "app-path-routes-manifest.json",
    );

    // Every App Router page the build knows about, e.g. "/(public)/page" → "/".
    const pages = Object.entries(appPaths)
      .filter(([entry]) => entry.endsWith("/page"))
      .filter(([, route]) => !route.startsWith("/_"))
      .map(([appPath, route]) => ({ appPath, route }));

    const entryFor = (route: string) =>
      manifest.routes[route] ?? manifest.dynamicRoutes[route];

    it("built the app's pages", () => {
      const routes = pages.map((page) => page.route);
      for (const route of [
        "/",
        "/blog/[slug]",
        "/sign-in/[[...sign-in]]",
        "/sign-up/[[...sign-up]]",
        "/shell-check",
      ]) {
        expect(routes).toContain(route);
      }
    });

    it.each(pages.map((page) => page.route))(
      "%s has a static shell (not ƒ)",
      (route) => {
        const entry = entryFor(route);
        expect(
          entry,
          `${route} wasn't prerendered at all. Make the page synchronous and move request reads into <Suspense>.`,
        ).toBeDefined();
        expect(
          symbolFor(entry),
          `${route} came out fully dynamic: something outside <Suspense> reads request data or uncached data.`,
        ).not.toBe("ƒ");
      },
    );

    it.each(FULLY_STATIC)("%s is fully static (○)", (route) => {
      expect(
        symbolFor(manifest.routes[route]),
        `${route} reads nothing from the URL, so it must be ○. Something in it (or a layout above it) reads the request or uncached data.`,
      ).toBe("○");
    });

    const partialPages = pages
      .map((page) => page.route)
      .filter((route) => symbolFor(entryFor(route)) === "◐");

    it.each(partialPages)(
      "%s puts its heading in the static shell, not just a loading state",
      (route) => {
        const html = htmlFor(route);
        // Dynamic routes may only have a fallback shell at runtime; the
        // app-level test (tests/app/static-shell.test.tsx) checks those.
        if (html === null && route.includes("[")) return;
        expect(html, `${route} has no prerendered HTML`).not.toBeNull();
        if (route.includes("[")) {
          // A dynamic route's heading is its data (e.g. the post title), so
          // it streams in; the shell must still have its <main> frame.
          expect(
            html,
            `${route}'s shell has no <main> frame. Keep the page frame outside <Suspense>.`,
          ).toMatch(/<main[\s>]/);
          return;
        }
        expect(
          html,
          `${route}'s shell has no <h1>. Render the heading outside <Suspense>.`,
        ).toMatch(/<h1[\s>]/);
      },
    );

    const files = new Map(
      pages.map((page) => [page.route, segmentFiles(page.appPath)]),
    );
    const allFiles = [...new Set([...files.values()].flat())];
    const reports = inspectSources(
      Object.fromEntries(
        allFiles.map((file) => [file, readFileSync(file, "utf8")]),
      ),
    );
    const navigationPages = pages
      .map((page) => page.route)
      .filter((route) =>
        files
          .get(route)
          ?.some((file) => reports[file].ensureStatic === "navigation"),
      );

    it("finds the shell-check canary under ensureStatic", () => {
      expect(navigationPages).toContain("/shell-check");
    });

    it.each(navigationPages)(
      "%s (ensureStatic = navigation) is fully static (○)",
      (route) => {
        const entry =
          manifest.routes[route] ??
          Object.values(manifest.routes).find(
            (value) => value.srcRoute === route,
          );
        expect(symbolFor(entry), route).toBe("○");
      },
    );
  },
);
