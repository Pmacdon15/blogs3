"use server";

import { updatePostCaches } from "@/lib/cache/revalidate";
import { NotAuthorizedError, requireAdminAction } from "@/lib/dal/auth";
import {
  createPost,
  deletePost,
  type Mutation,
  setPostStatus,
  type UploadedImage,
  updatePost,
  uploadImage,
} from "@/lib/dal/posts";
import type { Post, PostStatus, Result } from "@/lib/types";

/*
 * Server actions for the editor. Every argument comes from the browser, so
 * nothing here is trusted: the DAL checks the admin and re-validates with
 * the shared zod schemas. Successful writes refresh the post caches with
 * `updatePostCaches` (updateTag) so the editor reads its own writes.
 */

type Failure = { ok: false; error: string };

/** The signed-in admin's id, or a Result error for anyone else. */
async function adminId(): Promise<{ ok: true; userId: string } | Failure> {
  try {
    return { ok: true, userId: await requireAdminAction() };
  } catch (error) {
    if (error instanceof NotAuthorizedError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

/** Runs a DAL mutation as the admin and refreshes the caches it touched. */
async function mutate<T>(
  run: (userId: string) => Promise<Mutation>,
  pick: (post: Post) => T,
): Promise<Result<T>> {
  const admin = await adminId();
  if (!admin.ok) return admin;
  const result = await run(admin.userId);
  if (!result.ok) return result;
  updatePostCaches(result.data.change);
  return { ok: true, data: pick(result.data.post) };
}

const wholePost = (post: Post) => post;

export async function createPostAction(input: unknown): Promise<Result<Post>> {
  return mutate((userId) => createPost(userId, input), wholePost);
}

export async function updatePostAction(
  id: unknown,
  patch: unknown,
): Promise<Result<Post>> {
  return mutate((userId) => updatePost(userId, id, patch), wholePost);
}

async function setStatus(id: unknown, status: PostStatus) {
  return mutate((userId) => setPostStatus(userId, id, status), wholePost);
}

export async function publishPostAction(id: unknown): Promise<Result<Post>> {
  return setStatus(id, "published");
}

export async function unpublishPostAction(id: unknown): Promise<Result<Post>> {
  return setStatus(id, "draft");
}

export async function deletePostAction(
  id: unknown,
): Promise<Result<{ id: string }>> {
  return mutate(
    (userId) => deletePost(userId, id),
    (post) => ({ id: post.id }),
  );
}

export async function uploadImageAction(
  formData: FormData,
): Promise<Result<UploadedImage>> {
  const admin = await adminId();
  if (!admin.ok) return admin;
  const file = formData instanceof FormData ? formData.get("file") : null;
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose an image to upload." };
  }
  return uploadImage(admin.userId, {
    name: file.name,
    type: file.type,
    size: file.size,
    body: file,
  });
}
