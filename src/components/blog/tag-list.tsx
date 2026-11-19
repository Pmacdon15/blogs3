import { cn } from "@/lib/cn";

/** Tags as small chips. Renders nothing for a post without tags. */
export function TagList({
  tags,
  className,
}: {
  tags: string[];
  className?: string;
}) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="Tags" className={cn("flex flex-wrap gap-2", className)}>
      {tags.map((tag) => (
        <li
          className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 font-medium text-brand-700 text-xs"
          key={tag}
        >
          {`#${tag}`}
        </li>
      ))}
    </ul>
  );
}
