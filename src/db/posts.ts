import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "@/db/client";
import { CACHE_TAGS } from "@/lib/cache/tags";
import type { Block, PostInput, PostPatch } from "@/lib/schemas";
import type { Post, PostStatus, PostSummary } from "@/lib/types";

/*
 * Raw SQL for posts. No auth here: callers are the public pages (published
 * rows only) and the DAL (`src/lib/dal/posts.ts`), which checks the admin.
 *
 * Caching:
 * - Public reads are NOT cached here. The public pages cache them in their
 *   own `"use cache"` components, tagged with CACHE_TAGS.publishedPosts /
 *   postSlug.
 * - Private (admin) reads ARE cached here, keyed by their arguments and
 *   tagged so mutations can invalidate them.
 */

type PostRow = {
  id: string;
  author_id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  blocks: Block[];
  tags: string[];
  status: PostStatus;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const iso = (value: Date | string) => new Date(value).toISOString();

export function toPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url,
    blocks: row.blocks,
    tags: row.tags,
    status: row.status,
    publishedAt: row.published_at === null ? null : iso(row.published_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toSummary(row: PostRow): PostSummary {
  const { blocks: _blocks, authorId: _authorId, ...summary } = toPost(row);
  return summary;
}

// ---------------------------------------------------------------- public reads

export async function dbListPublishedPosts(limit = 50): Promise<PostSummary[]> {
  const rows = (await sql()`
    select * from posts
    where status = 'published'
    order by published_at desc
    limit ${limit}
  `) as PostRow[];
  return rows.map(toSummary);
}

export async function dbGetPublishedPostBySlug(
  slug: string,
): Promise<Post | null> {
  const rows = (await sql()`
    select * from posts where slug = ${slug} and status = 'published' limit 1
  `) as PostRow[];
  return rows[0] ? toPost(rows[0]) : null;
}

/** Published posts whose title, excerpt or tags match `query` (case-insensitive). */
export async function dbSearchPublishedPosts(
  query: string,
  limit = 10,
): Promise<PostSummary[]> {
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = (await sql()`
    select * from posts
    where status = 'published'
      and (
        title ilike ${pattern}
        or excerpt ilike ${pattern}
        or exists (select 1 from unnest(tags) t where t ilike ${pattern})
      )
    order by published_at desc
    limit ${limit}
  `) as PostRow[];
  return rows.map(toSummary);
}

// ------------------------------------------------- private reads (cached here)

/** Every post, drafts included, newest edit first. Only the DAL calls this. */
export async function dbListAllPosts(): Promise<PostSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.adminPosts);
  const rows = (await sql()`
    select * from posts order by updated_at desc
  `) as PostRow[];
  return rows.map(toSummary);
}

/** One post by id, any status. Only the DAL calls this. */
export async function dbGetPostById(id: string): Promise<Post | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.post(id));
  const rows = (await sql()`
    select * from posts where id = ${id} limit 1
  `) as PostRow[];
  return rows[0] ? toPost(rows[0]) : null;
}

/** Uncached: used before writes to check slug conflicts. */
export async function dbFindPostIdBySlug(slug: string): Promise<string | null> {
  const rows = (await sql()`
    select id from posts where slug = ${slug} limit 1
  `) as { id: string }[];
  return rows[0]?.id ?? null;
}

// ------------------------------------------------------------------- mutations

export async function dbCreatePost(
  authorId: string,
  input: PostInput,
): Promise<Post> {
  const rows = (await sql()`
    insert into posts (author_id, slug, title, excerpt, cover_image_url, blocks, tags)
    values (
      ${authorId}, ${input.slug}, ${input.title}, ${input.excerpt},
      ${input.coverImageUrl}, ${JSON.stringify(input.blocks)}::jsonb, ${input.tags}
    )
    returning *
  `) as PostRow[];
  return toPost(rows[0]);
}

/** Applies a patch on top of `current` and returns the saved post. */
export async function dbUpdatePost(
  current: Post,
  patch: PostPatch,
): Promise<Post> {
  // Field by field, so a key that is present but undefined keeps its value.
  const next = {
    slug: patch.slug ?? current.slug,
    title: patch.title ?? current.title,
    excerpt: patch.excerpt ?? current.excerpt,
    coverImageUrl:
      patch.coverImageUrl === undefined
        ? current.coverImageUrl
        : patch.coverImageUrl,
    blocks: patch.blocks ?? current.blocks,
    tags: patch.tags ?? current.tags,
  };
  const rows = (await sql()`
    update posts set
      slug = ${next.slug},
      title = ${next.title},
      excerpt = ${next.excerpt},
      cover_image_url = ${next.coverImageUrl},
      blocks = ${JSON.stringify(next.blocks)}::jsonb,
      tags = ${next.tags},
      updated_at = now()
    where id = ${current.id}
    returning *
  `) as PostRow[];
  return toPost(rows[0]);
}

export async function dbSetPostStatus(
  id: string,
  status: PostStatus,
): Promise<Post | null> {
  const rows = (await sql()`
    update posts set
      status = ${status},
      published_at = case
        when ${status} = 'published' then coalesce(published_at, now())
        else null
      end,
      updated_at = now()
    where id = ${id}
    returning *
  `) as PostRow[];
  return rows[0] ? toPost(rows[0]) : null;
}

export async function dbDeletePost(id: string): Promise<Post | null> {
  const rows = (await sql()`
    delete from posts where id = ${id} returning *
  `) as PostRow[];
  return rows[0] ? toPost(rows[0]) : null;
}
