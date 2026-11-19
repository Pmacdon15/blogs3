// @vitest-environment node
import { describe, expect, test } from "vitest";
import {
  displayPath,
  findPageFiles,
  findRouteFiles,
  inspectSources,
  isLayout,
  type RouteReport,
  readSource,
  routeFor,
  routeProblems,
} from "../../helpers/route-files";

/*
 * Every page, layout, template, default and not-found file under src/app must
 * follow the Cache Components rules in AGENTS.md: a synchronous Server
 * Component that passes promises down instead of awaiting, no route segment
 * config, and (for layouts) no request-time reads. Files are discovered from
 * disk, so a new route is checked without editing this test.
 */

const routeFiles = findRouteFiles();
const reports = inspectSources(
  Object.fromEntries(routeFiles.map((file) => [file, readSource(file)])),
);

describe("route discovery", () => {
  test("finds the root layout", () => {
    expect(routeFiles.map((file) => displayPath(file))).toContain(
      "src/app/layout.tsx",
    );
  });

  test("maps page files to the URLs they serve", () => {
    expect(routeFor(`${process.cwd()}/src/app/page.tsx`)).toBe("/");
    expect(
      routeFor(`${process.cwd()}/src/app/(public)/posts/[slug]/page.tsx`),
    ).toBe("/posts/[slug]");
    expect(
      routeFor(`${process.cwd()}/src/app/(admin)/admin/@modal/page.tsx`),
    ).toBe("/admin");
  });

  test("leaves private folders out of the pages", () => {
    for (const file of findPageFiles()) {
      expect(displayPath(file)).not.toMatch(/\/_/);
    }
  });
});

describe.each(routeFiles.map((file) => [displayPath(file), file] as const))(
  "%s",
  (label, file) => {
    test("follows the Cache Components page rules", () => {
      const problems = routeProblems(reports[file], { layout: isLayout(file) });
      if (problems.length > 0) {
        throw new Error(
          `${label}:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
        );
      }
      expect(problems).toEqual([]);
    });
  },
);

// ------------------------------------------------- the inspector itself

const cases = {
  asyncDeclaration: "export default async function Page() { return null; }",
  asyncArrow: "export default async () => null;",
  asyncByName: "async function Page() { return null; }\nexport default Page;",
  asyncConst:
    "const Page = async (props: Props) => null;\nexport default Page;",
  asyncSpecifier:
    "async function Page() { return null; }\nexport { Page as default };",
  syncDeclaration: "export default function Page() { return <main />; }",
  syncArrow: "export default (() => null) satisfies unknown;",
  syncFunctionExpression:
    "const Page = function () { return null; };\nexport default Page;",
  wrapped: "function Page() { return null; }\nexport default memo(Page);",
  awaitInBody:
    "export default function Page() { const x = await load(); return x; }",
  forAwait:
    "export default function Page() { for await (const x of xs) {} return null; }",
  awaitInNested:
    "export default function Page() { const run = async () => { await load(); }; function inner() {} return run; }",
  missing: "export const x = 1;",
  notAFunction: "const Page = 1;\nexport default Page;",
  unknownName: "export default Missing;",
  otherSpecifier: "function Page() {}\nexport { Page };",
  useClient: '"use strict";\n"use client";\nexport default function Page() {}',
  laterString:
    'import x from "y";\n"use client";\nexport default function Page() {}',
  otherDirective: '"use strict";\nexport default function Page() {}',
  segmentConfig: [
    'export const dynamic = "force-dynamic";',
    "export let revalidate = 60;",
    "const fetchCache = 'x';\nexport { fetchCache };",
    "export function runtime() {}",
    "export class Other {}",
    "export const { a } = b;",
    "export const ensureStatic = false as const;",
    "export { thing } from './thing';",
    "export * from './all';",
    "export default function Page() {}",
  ].join("\n"),
  ensureStaticNavigation:
    'export const ensureStatic = "navigation";\nexport default function Page() {}',
  ensureStaticOther:
    "export const ensureStatic = level;\nexport default function Page() {}",
  ensureStaticUnset:
    "export const ensureStatic;\nexport default function Page() {}",
  requestReads: [
    'import { auth, currentUser as me } from "@clerk/nextjs/server";',
    'import { Show, SignInButton } from "@clerk/nextjs";',
    'import { cookies, headers } from "next/headers";',
    'import * as all from "next/headers";',
    'import def from "@clerk/nextjs";',
    'import "side-effect";',
    'import { other } from "elsewhere";',
    "export default function Layout() { auth(); cookies(); headers(); currentUser(); obj.auth(); return null; }",
  ].join("\n"),
} satisfies Record<string, string>;

const inspected = inspectSources(
  Object.fromEntries(
    Object.entries(cases).map(([name, source]) => [`${name}.tsx`, source]),
  ),
) as Record<string, RouteReport>;
const report = (name: keyof typeof cases) => inspected[`${name}.tsx`];

describe("inspectSources", () => {
  test.each([
    "asyncDeclaration",
    "asyncArrow",
    "asyncByName",
    "asyncConst",
    "asyncSpecifier",
  ] as const)("flags an async default export: %s", (name) => {
    expect(report(name).defaultExport).toMatchObject({
      found: true,
      isAsync: true,
    });
  });

  test.each([
    "syncDeclaration",
    "syncArrow",
    "syncFunctionExpression",
    "wrapped",
    "awaitInNested",
  ] as const)("allows a sync default export: %s", (name) => {
    expect(report(name).defaultExport).toMatchObject({
      found: true,
      isAsync: false,
      awaits: 0,
    });
  });

  test("names the component it followed", () => {
    expect(report("asyncByName").defaultExport).toMatchObject({
      name: "Page",
    });
  });

  test("counts awaits and for-await loops in the component body", () => {
    expect(report("awaitInBody").defaultExport).toMatchObject({ awaits: 1 });
    expect(report("forAwait").defaultExport).toMatchObject({ awaits: 1 });
  });

  test.each([
    "missing",
    "notAFunction",
    "unknownName",
    "otherSpecifier",
  ] as const)("reports a default export it can't follow: %s", (name) => {
    expect(report(name).defaultExport).toEqual({ found: false });
  });

  test("finds a use client directive only in the prologue", () => {
    expect(report("useClient").useClient).toBe(true);
    expect(report("laterString").useClient).toBe(false);
    expect(report("otherDirective").useClient).toBe(false);
  });

  test("finds route segment config however it is exported", () => {
    expect(report("segmentConfig")).toMatchObject({
      segmentConfig: ["dynamic", "fetchCache", "revalidate", "runtime"],
      ensureStatic: false,
    });
  });

  test("reads a literal ensureStatic", () => {
    expect(report("ensureStaticNavigation").ensureStatic).toBe("navigation");
    expect(report("ensureStaticOther").ensureStatic).toBeUndefined();
    expect(report("ensureStaticUnset").ensureStatic).toBeUndefined();
    expect(report("syncDeclaration").ensureStatic).toBeUndefined();
  });

  test("finds request-time imports and calls", () => {
    expect(report("requestReads")).toMatchObject({
      requestImports: [
        "auth from @clerk/nextjs/server",
        "currentUser from @clerk/nextjs/server",
        "Show from @clerk/nextjs",
        "cookies from next/headers",
        "headers from next/headers",
      ],
      requestCalls: ["auth()", "cookies()", "currentUser()", "headers()"],
    });
  });
});

describe("routeProblems", () => {
  const clean: RouteReport = {
    useClient: false,
    defaultExport: { found: true, isAsync: false, awaits: 0 },
    segmentConfig: [],
    requestImports: [],
    requestCalls: [],
  };

  test("is empty for a file that follows the rules", () => {
    expect(routeProblems(clean, { layout: true })).toEqual([]);
  });

  test("explains each problem and what to do", () => {
    const problems = routeProblems(
      {
        useClient: true,
        defaultExport: { found: true, name: "Page", isAsync: true, awaits: 2 },
        segmentConfig: ["dynamic"],
        ensureStatic: false,
        requestImports: ["auth from @clerk/nextjs/server"],
        requestCalls: ["auth()"],
      },
      { layout: true },
    );
    expect(problems).toHaveLength(7);
    expect(problems.join("\n")).toContain("use client");
    expect(problems.join("\n")).toContain("async component (Page)");
    expect(problems.join("\n")).toContain("inside <Suspense>");
    expect(problems.join("\n")).toContain("`dynamic`");
    expect(problems.join("\n")).toContain("ensureStatic = false");
    expect(problems.join("\n")).toContain("imports auth from");
    expect(problems.join("\n")).toContain("calls auth()");
  });

  test("only checks request reads in layouts", () => {
    expect(
      routeProblems(
        { ...clean, requestImports: ["x"], requestCalls: ["auth()"] },
        { layout: false },
      ),
    ).toEqual([]);
  });

  test("explains a missing default export, without a name when there is none", () => {
    expect(
      routeProblems(
        { ...clean, defaultExport: { found: false } },
        {
          layout: false,
        },
      )[0],
    ).toContain("no default export");
    expect(
      routeProblems(
        {
          ...clean,
          defaultExport: { found: true, isAsync: true, awaits: 0 },
        },
        { layout: false },
      ),
    ).toEqual([expect.stringContaining("exports an async component. ")]);
  });
});
