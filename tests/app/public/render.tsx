import type { ReactElement } from "react";
import { prerender } from "react-dom/static";

/** Renders a server tree (async components included) to HTML. */
export async function renderToHtml(
  element: ReactElement,
  onError: (error: unknown) => void = () => {},
) {
  const { prelude } = await prerender(<main>{element}</main>, { onError });
  return new Response(prelude).text();
}

/** Renders only the static shell: anything still pending is cut off. */
export async function renderShell(element: ReactElement) {
  const controller = new AbortController();
  const result = prerender(<main>{element}</main>, {
    signal: controller.signal,
    onError: () => {},
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  controller.abort();
  const { prelude } = await result;
  return new Response(prelude).text();
}

/** A promise that never settles, like the URL during prerender. */
export function pending<T>() {
  return new Promise<T>(() => {});
}
