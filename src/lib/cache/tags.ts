/*
 * Every cache tag in the app. No raw tag strings anywhere else: cached
 * functions call `cacheTag(CACHE_TAGS...)` and mutations go through
 * `src/lib/cache/revalidate.ts`.
 */
export const CACHE_TAGS = {
  /** Every published post list, page or search result. */
  publishedPosts: "posts:published",
  /** The admin's list of all posts, drafts included. */
  adminPosts: "posts:admin",
  /** One post by id (admin editor reads). */
  post: (id: string) => `post:${id}`,
  /** One public post page by slug. */
  postSlug: (slug: string) => `post-slug:${slug}`,
} as const;

/** What changed in one post mutation, so the right tags are invalidated. */
export type PostChange = {
  id: string;
  /** Every slug the post had before or after the change. */
  slugs: string[];
};

export function postChangeTags(change: PostChange): string[] {
  return [
    CACHE_TAGS.publishedPosts,
    CACHE_TAGS.adminPosts,
    CACHE_TAGS.post(change.id),
    ...[...new Set(change.slugs)].map((slug) => CACHE_TAGS.postSlug(slug)),
  ];
}
