import { FileText } from "lucide-react";
import { PostCard } from "@/components/blog/post-card";
import type { PostSummary } from "@/lib/types";

/** The newest post as a large featured card, then a grid of the rest. */
export function PostList({ posts }: { posts: PostSummary[] }) {
  const [featured, ...rest] = posts;
  if (!featured) return <EmptyPosts />;
  return (
    <div className="flex flex-col gap-6">
      <PostCard featured post={featured} />
      {rest.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyPosts() {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <FileText aria-hidden="true" className="size-6" />
      </span>
      <h3 className="font-semibold text-ink text-lg">No posts yet</h3>
      <p className="max-w-sm text-muted text-sm">
        The first post is being written. Check back soon.
      </p>
    </div>
  );
}
