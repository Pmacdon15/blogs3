import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import {
  type Block,
  type ConciseBody,
  type Expression,
  isArrowFunction,
  isAsExpression,
  isCallExpression,
  isExportAssignment,
  isExportDeclaration,
  isExpressionStatement,
  isForOfStatement,
  isFunctionDeclaration,
  isFunctionExpression,
  isFunctionLikeDeclaration,
  isIdentifier,
  isImportDeclaration,
  isNamedExports,
  isNamedImports,
  isParenthesizedExpression,
  isSatisfiesExpression,
  isStringLiteral,
  isVariableStatement,
  type Node,
  type SourceFile,
  type Statement,
  SyntaxKind,
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

/*
 * Finds the App Router's route component files and inspects them with the
 * TypeScript compiler's own parser (TypeScript 7's API), so comments,
 * strings and nested helpers can't fool the checks the way a regex could.
 */

// Vitest runs from the project root. (jsdom swaps out the global URL, so
// fileURLToPath(import.meta.url) can't be used here.)
export const ROOT = process.cwd();
export const APP_DIR = resolve(ROOT, "src", "app");

/**
 * Route-segment files that render a server component. Any file with one of
 * these names anywhere under src/app is checked, so new routes are covered
 * without editing a test. (loading/error files are left out: error files must
 * be client components.)
 */
export const ROUTE_COMPONENT_FILES = [
  "page",
  "layout",
  "template",
  "default",
  "not-found",
] as const;

const EXTENSIONS = ["tsx", "ts", "jsx", "js"];

/** Every route component file under `appDir`, sorted. */
export function findRouteFiles(appDir = APP_DIR): string[] {
  const pattern = new RegExp(
    `(^|[/\\\\])(${ROUTE_COMPONENT_FILES.join("|")})\\.(${EXTENSIONS.join("|")})$`,
  );
  return readdirSync(appDir, { recursive: true, encoding: "utf8" })
    .filter((file) => pattern.test(file))
    .map((file) => join(appDir, file))
    .sort();
}

/** Only the page files, skipping private `_folders` (they aren't routes). */
export function findPageFiles(appDir = APP_DIR): string[] {
  return findRouteFiles(appDir).filter(
    (file) =>
      /(^|[/\\])page\.[jt]sx?$/.test(file) &&
      !relative(appDir, file)
        .split(/[/\\]/)
        .some((segment) => segment.startsWith("_")),
  );
}

export function displayPath(file: string, appDir = APP_DIR): string {
  return `src/app/${relative(appDir, file).replaceAll("\\", "/")}`;
}

/** The URL a page file serves: route groups collapse, `page.tsx` drops. */
export function routeFor(file: string, appDir = APP_DIR): string {
  const segments = relative(appDir, file)
    .split(/[/\\]/)
    .slice(0, -1)
    .filter((segment) => !/^\(.+\)$/.test(segment) && !segment.startsWith("@"));
  return `/${segments.join("/")}`;
}

export function isLayout(file: string) {
  return /(^|[/\\])layout\.[jt]sx?$/.test(file);
}

// ------------------------------------------------------------------ parsing

/**
 * Parses each source with the TypeScript compiler. One compiler process
 * parses the whole batch through an in-memory file system.
 */
export function parseSources(
  sources: Record<string, string>,
): Record<string, SourceFile> {
  const names = Object.keys(sources);
  const files: Record<string, string> = {};
  const paths = names.map((name, index) => {
    const ext = extname(name) || ".tsx";
    const path = `/virtual/file${index}${ext}`;
    files[path] = sources[name];
    return path;
  });
  files["/virtual/tsconfig.json"] = JSON.stringify({
    compilerOptions: {
      allowJs: true,
      jsx: "preserve",
      noLib: true,
      noResolve: true,
      types: [],
    },
    files: paths,
  });

  const api = new API({ cwd: "/virtual", fs: createVirtualFileSystem(files) });
  try {
    const project = api
      .updateSnapshot({ openProjects: ["/virtual/tsconfig.json"] })
      .getProjects()[0];
    const parsed: Record<string, SourceFile> = {};
    names.forEach((name, index) => {
      const sourceFile = project.program.getSourceFile(paths[index]);
      if (!sourceFile) throw new Error(`TypeScript didn't parse ${name}`);
      parsed[name] = sourceFile;
    });
    return parsed;
  } finally {
    api.close();
  }
}

// --------------------------------------------------------------- inspection

/** Route segment config that opts a route out of Cache Components. */
export const FORBIDDEN_SEGMENT_CONFIG = [
  "dynamic",
  "revalidate",
  "fetchCache",
  "runtime",
] as const;

/** Request-time APIs a shared layout must never touch on the server. */
export const LAYOUT_FORBIDDEN_IMPORTS: Record<string, readonly string[]> = {
  "@clerk/nextjs/server": ["auth", "currentUser"],
  "@clerk/nextjs": ["Show"],
  "next/headers": ["cookies", "headers"],
};

const LAYOUT_FORBIDDEN_CALLS = ["auth", "currentUser", "cookies", "headers"];

export type RouteReport = {
  useClient: boolean;
  defaultExport:
    | { found: false }
    | { found: true; name?: string; isAsync: boolean; awaits: number };
  /** Exported names from FORBIDDEN_SEGMENT_CONFIG. */
  segmentConfig: string[];
  /** The exported `ensureStatic` value, when it is a literal. */
  ensureStatic?: string | false;
  /** Request-time APIs imported from LAYOUT_FORBIDDEN_IMPORTS, e.g. "auth from @clerk/nextjs/server". */
  requestImports: string[];
  /** Calls to auth()/currentUser()/cookies()/headers() anywhere in the file. */
  requestCalls: string[];
};

type FunctionLike = Node & {
  body?: Block | ConciseBody;
  modifiers?: readonly Node[];
};

const unwrap = (node: Expression): Expression => {
  let current = node;
  while (
    isParenthesizedExpression(current) ||
    isAsExpression(current) ||
    isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};

const hasModifier = (node: { modifiers?: readonly Node[] }, kind: SyntaxKind) =>
  node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;

const isExported = (statement: Statement) =>
  hasModifier(
    statement as { modifiers?: readonly Node[] },
    SyntaxKind.ExportKeyword,
  );

/** Awaits (and `for await` loops) in a function's own body; nested functions are skipped. */
export function countOwnAwaits(fn: FunctionLike): number {
  let count = 0;
  const visit = (node: Node): undefined => {
    if (isFunctionLikeDeclaration(node)) return;
    if (node.kind === SyntaxKind.AwaitExpression) count += 1;
    if (isForOfStatement(node) && node.awaitModifier) count += 1;
    node.forEachChild(visit);
  };
  if (fn.body) visit(fn.body);
  return count;
}

function describeFunction(fn: FunctionLike, name?: string) {
  return {
    found: true as const,
    name,
    isAsync: hasModifier(fn, SyntaxKind.AsyncKeyword),
    awaits: countOwnAwaits(fn),
  };
}

/** The function a top-level name refers to, if it is a function declaration or a const function. */
function findLocalFunction(
  sourceFile: SourceFile,
  name: string,
): FunctionLike | null | undefined {
  for (const statement of sourceFile.statements) {
    if (isFunctionDeclaration(statement) && statement.name?.text === name) {
      return statement;
    }
    if (isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!isIdentifier(declaration.name) || declaration.name.text !== name)
          continue;
        const init = declaration.initializer && unwrap(declaration.initializer);
        return init && (isArrowFunction(init) || isFunctionExpression(init))
          ? init
          : null;
      }
    }
  }
  return undefined;
}

function inspectDefault(sourceFile: SourceFile): RouteReport["defaultExport"] {
  for (const statement of sourceFile.statements) {
    if (
      isFunctionDeclaration(statement) &&
      hasModifier(statement, SyntaxKind.DefaultKeyword)
    ) {
      return describeFunction(statement, statement.name?.text);
    }
    if (isExportAssignment(statement) && !statement.isExportEquals) {
      const expression = unwrap(statement.expression);
      if (isArrowFunction(expression) || isFunctionExpression(expression)) {
        return describeFunction(expression);
      }
      if (isIdentifier(expression)) {
        return resolveName(sourceFile, expression.text);
      }
      // e.g. `export default memo(Page)`: nothing to inspect.
      return { found: true, isAsync: false, awaits: 0 };
    }
    if (
      isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (element.name.text === "default" && element.propertyName) {
          return resolveName(sourceFile, element.propertyName.text);
        }
      }
    }
  }
  return { found: false };
}

function resolveName(
  sourceFile: SourceFile,
  name: string,
): RouteReport["defaultExport"] {
  const fn = findLocalFunction(sourceFile, name);
  return fn ? describeFunction(fn, name) : { found: false };
}

function literalValue(expression: Expression | undefined) {
  if (!expression) return undefined;
  const value = unwrap(expression);
  if (value.kind === SyntaxKind.FalseKeyword) return false;
  if (isStringLiteral(value)) return value.text;
  return undefined;
}

function inspectExports(sourceFile: SourceFile) {
  const segmentConfig = new Set<string>();
  let ensureStatic: string | false | undefined;
  const forbidden: readonly string[] = FORBIDDEN_SEGMENT_CONFIG;

  for (const statement of sourceFile.statements) {
    if (isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        if (forbidden.includes(name)) segmentConfig.add(name);
        if (name === "ensureStatic") {
          ensureStatic = literalValue(declaration.initializer);
        }
      }
    }
    if (
      (isFunctionDeclaration(statement) && isExported(statement)) ||
      (statement.kind === SyntaxKind.ClassDeclaration && isExported(statement))
    ) {
      const name = (statement as { name?: { text: string } }).name?.text;
      if (name && forbidden.includes(name)) segmentConfig.add(name);
    }
    if (
      isExportDeclaration(statement) &&
      statement.exportClause &&
      isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (forbidden.includes(element.name.text)) {
          segmentConfig.add(element.name.text);
        }
      }
    }
  }
  return { segmentConfig: [...segmentConfig].sort(), ensureStatic };
}

function inspectRequestApis(sourceFile: SourceFile) {
  const requestImports: string[] = [];
  for (const statement of sourceFile.statements) {
    if (!isImportDeclaration(statement)) continue;
    if (!isStringLiteral(statement.moduleSpecifier)) continue;
    const from = statement.moduleSpecifier.text;
    const banned = LAYOUT_FORBIDDEN_IMPORTS[from];
    const bindings = statement.importClause?.namedBindings;
    if (!banned || !bindings || !isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      if (banned.includes(imported)) {
        requestImports.push(`${imported} from ${from}`);
      }
    }
  }

  const requestCalls = new Set<string>();
  const visit = (node: Node): undefined => {
    if (isCallExpression(node)) {
      const callee = node.expression;
      if (
        isIdentifier(callee) &&
        LAYOUT_FORBIDDEN_CALLS.includes(callee.text)
      ) {
        requestCalls.add(`${callee.text}()`);
      }
    }
    node.forEachChild(visit);
  };
  sourceFile.forEachChild(visit);

  return { requestImports, requestCalls: [...requestCalls].sort() };
}

/** Whether the module starts with a "use client" directive. */
function hasUseClient(sourceFile: SourceFile) {
  for (const statement of sourceFile.statements) {
    if (!isExpressionStatement(statement)) return false;
    if (!isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === "use client") return true;
  }
  return false;
}

export function inspectSourceFile(sourceFile: SourceFile): RouteReport {
  return {
    useClient: hasUseClient(sourceFile),
    defaultExport: inspectDefault(sourceFile),
    ...inspectExports(sourceFile),
    ...inspectRequestApis(sourceFile),
  };
}

/** Inspects a batch of sources, keyed like the input. */
export function inspectSources(
  sources: Record<string, string>,
): Record<string, RouteReport> {
  const parsed = parseSources(sources);
  return Object.fromEntries(
    Object.entries(parsed).map(([name, file]) => [
      name,
      inspectSourceFile(file),
    ]),
  );
}

/**
 * What is wrong with a route file, each with what to do about it. Empty when
 * the file follows the Cache Components page rules (see AGENTS.md).
 */
export function routeProblems(
  report: RouteReport,
  options: { layout: boolean },
): string[] {
  const problems: string[] = [];
  if (report.useClient) {
    problems.push(
      'starts with "use client". Route files must be Server Components: move the interactive part into a client component under src/components and render it from here.',
    );
  }
  const exported = report.defaultExport;
  if (!exported.found) {
    problems.push(
      "has no default export the checker can follow. Export the component with `export default function Name()` (or a `const Name = () => …` exported by name).",
    );
  } else {
    const label = exported.name ? ` (${exported.name})` : "";
    if (exported.isAsync) {
      problems.push(
        `exports an async component${label}. Keep it synchronous: pass params/searchParams/data promises to a child and await them inside <Suspense>.`,
      );
    }
    if (exported.awaits > 0) {
      problems.push(
        `awaits in the component's own body${label}. Move the await into a child component rendered inside <Suspense>, so the static shell can render without it.`,
      );
    }
  }
  for (const name of report.segmentConfig) {
    problems.push(
      `exports \`${name}\`. Cache Components replaces route segment config: delete it and use "use cache" + cacheLife/cacheTag, or <Suspense> for request-time data.`,
    );
  }
  if (report.ensureStatic === false) {
    problems.push(
      "exports `ensureStatic = false`, which opts the route out of static output. Remove it and fix whatever reads request data outside <Suspense>.",
    );
  }
  if (options.layout) {
    for (const item of report.requestImports) {
      problems.push(
        `imports ${item}. Layouts never read the request on the server: read the session in the page's <Suspense> hole, or on the client with useAuth().`,
      );
    }
    for (const call of report.requestCalls) {
      problems.push(
        `calls ${call}. Layouts never read the request on the server: read it in the page's <Suspense> hole, or on the client with useAuth().`,
      );
    }
  }
  return problems;
}

export function readSource(file: string): string {
  return readFileSync(file, "utf8");
}
