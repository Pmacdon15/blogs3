import { ImageResponse } from "next/og";

export type BrandMarkSize = {
  width: number;
  height: number;
};

/**
 * Generates a PNG brand icon ("B" on the blue gradient tile, matching Logo)
 * for favicons, Apple touch icons, and PWA home-screen icons.
 */
export function renderBrandIcon(
  size: BrandMarkSize,
  options: { maskable?: boolean } = {},
): ImageResponse {
  const { width, height } = size;
  const radius = options.maskable ? 0 : Math.round(width * 0.28);
  const fontSize = Math.round(width * (options.maskable ? 0.42 : 0.5));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius,
        backgroundImage:
          "linear-gradient(135deg, #60a5fa 0%, #2563eb 52%, #1e3a8a 100%)",
        color: "#ffffff",
        fontSize,
        fontWeight: 700,
        letterSpacing: "-0.04em",
      }}
    >
      B
    </div>,
    { width, height },
  );
}
