import { renderBrandIcon } from "@/lib/pwa-icon";

const ICON_VARIANTS = [
  {
    id: "32",
    size: { width: 32, height: 32 },
    contentType: "image/png",
    maskable: false,
  },
  {
    id: "192",
    size: { width: 192, height: 192 },
    contentType: "image/png",
    maskable: false,
  },
  {
    id: "512",
    size: { width: 512, height: 512 },
    contentType: "image/png",
    maskable: false,
  },
  {
    id: "maskable-512",
    size: { width: 512, height: 512 },
    contentType: "image/png",
    maskable: true,
  },
] as const;

export function generateImageMetadata() {
  return ICON_VARIANTS.map(({ id, size, contentType }) => ({
    id,
    size,
    contentType,
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const resolvedId = await id;
  const variant =
    ICON_VARIANTS.find((item) => item.id === resolvedId) ?? ICON_VARIANTS[0];
  return renderBrandIcon(variant.size, { maskable: variant.maskable });
}
