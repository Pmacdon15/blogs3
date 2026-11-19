import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function PostNotFound() {
  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <FileQuestion aria-hidden="true" className="size-6" />
      </span>
      <h1 className="font-semibold text-2xl text-ink tracking-tight">
        Post not found
      </h1>
      <p className="text-muted">
        This post doesn&apos;t exist, or it isn&apos;t published anymore.
      </p>
      <Link className={buttonClasses("primary", "md", "mt-2")} href="/">
        Browse all posts
      </Link>
    </div>
  );
}
