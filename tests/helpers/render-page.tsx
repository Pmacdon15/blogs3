import type { ReactNode } from "react";
import { prerender } from "react-dom/static";

/*
 * Renders pages the way `next build` prerenders their static shell: the
 * page's promises for request data (params, searchParams) never resolve, so
 * anything that awaits them stays behind its <Suspense> fallback, while
 * cached work that resolves right away (mocked "use cache" reads) still
 * renders. Whatever is left when the render is aborted is the shell.
 */

type SearchParams = Record<string, string | string[] | undefined>;

/** A promise that never settles: request data that isn't there at build time. */
export function pendingParams<T = Record<string, string | string[]>>() {
  return new Promise<T>(() => {});
}

export function pendingSearchParams() {
  return pendingParams<SearchParams>();
}

/** How many macrotask turns resolved (cached) work gets before the abort. */
const SETTLE_TURNS = 10;

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

async function render(element: ReactNode, abort: boolean) {
  const controller = new AbortController();
  const errors: unknown[] = [];
  const result = prerender(<main>{element}</main>, {
    signal: controller.signal,
    onError(error) {
      if (error !== controller.signal.reason) errors.push(error);
    },
  });
  if (abort) {
    for (let turn = 0; turn < SETTLE_TURNS; turn += 1) await nextTurn();
    controller.abort();
  }
  const { prelude } = await result;
  const html = await new Response(prelude).text();
  if (errors.length > 0) throw errors[0];
  return html;
}

/**
 * The static shell: the HTML React has after the synchronous work and any
 * already-resolved promises, with every pending hole showing its fallback.
 * Render errors other than the abort itself are rethrown.
 */
export function renderShell(element: ReactNode): Promise<string> {
  return render(element, true);
}

type PageProps = {
  params?: Record<string, string | string[]>;
  searchParams?: SearchParams;
};

/** Renders a page to completion with resolved params and searchParams. */
export function renderPage(
  Page: (props: never) => ReactNode,
  { params = {}, searchParams = {} }: PageProps = {},
): Promise<string> {
  return render(
    callPage(Page, {
      params: Promise.resolve(params),
      searchParams: Promise.resolve(searchParams),
    }),
    false,
  );
}

/** Calls a page component like Next does: once, with promise props. */
export function callPage(
  Page: (props: never) => ReactNode,
  props: { params: Promise<unknown>; searchParams: Promise<unknown> },
): ReactNode {
  return (Page as (props: unknown) => ReactNode)(props);
}
