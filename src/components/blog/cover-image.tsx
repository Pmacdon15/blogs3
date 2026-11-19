import Image from "next/image";
import { isBlobUrl } from "@/components/blog/post-blocks";
import { cn } from "@/lib/cn";

/** A post's cover, or a soft blue gradient when it has none. */
export function CoverImage({
  url,
  alt,
  sizes,
  preload = false,
  className,
}: {
  url: string | null;
  alt: string;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-linear-to-br from-brand-100 via-brand-50 to-white",
        className,
      )}
    >
      {url ? (
        <Image
          alt={alt}
          className="object-cover"
          fill
          preload={preload}
          sizes={sizes}
          src={url}
          unoptimized={!isBlobUrl(url)}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0">
          <div className="absolute -top-10 -right-6 size-40 rounded-full bg-brand-300/40 blur-2xl" />
          <div className="absolute -bottom-12 left-6 size-36 rounded-full bg-brand-500/20 blur-2xl" />
        </div>
      )}
    </div>
  );
}
