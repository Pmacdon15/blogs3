import type { Route } from "next";

/** The editor for one post. */
export const editPath = (id: string) => `/admin/posts/${id}` as Route;

/** A published post's public page. */
export const postPath = (slug: string) => `/blog/${slug}` as Route;
