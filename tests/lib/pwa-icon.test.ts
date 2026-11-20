import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  imageResponseCalls: [] as Array<{
    element: React.ReactElement<{ style: Record<string, unknown> }>;
    options: { width: number; height: number };
  }>,
}));

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse extends Response {
    element: React.ReactElement<{ style: Record<string, unknown> }>;
    options: { width: number; height: number };

    constructor(
      element: React.ReactElement<{ style: Record<string, unknown> }>,
      options: { width: number; height: number },
    ) {
      super("png-bytes", { headers: { "content-type": "image/png" } });
      this.element = element;
      this.options = options;
      mocks.imageResponseCalls.push({ element, options });
    }
  },
}));

import { renderBrandIcon } from "@/lib/pwa-icon";

describe("renderBrandIcon", () => {
  it("renders a rounded gradient B3 tile by default", () => {
    mocks.imageResponseCalls.length = 0;
    const response = renderBrandIcon({ width: 192, height: 192 });
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(mocks.imageResponseCalls).toHaveLength(1);
    const call = mocks.imageResponseCalls[0];
    expect(call?.options).toEqual({ width: 192, height: 192 });
    expect(call?.element.props.style).toMatchObject({
      borderRadius: Math.round(192 * 0.28),
      fontSize: Math.round(192 * 0.5),
    });
  });

  it("renders a full-bleed square tile with safe-zone font size when maskable", () => {
    mocks.imageResponseCalls.length = 0;
    renderBrandIcon({ width: 512, height: 512 }, { maskable: true });
    expect(mocks.imageResponseCalls).toHaveLength(1);
    const call = mocks.imageResponseCalls[0];
    expect(call?.options).toEqual({ width: 512, height: 512 });
    expect(call?.element.props.style).toMatchObject({
      borderRadius: 0,
      fontSize: Math.round(512 * 0.42),
    });
  });
});
