"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { editPath } from "@/components/admin/paths";
import {
  createPostAction,
  deletePostAction,
  publishPostAction,
  unpublishPostAction,
  updatePostAction,
  uploadImageAction,
} from "@/lib/actions/posts";
import type { PostInput } from "@/lib/schemas";
import type { Result } from "@/lib/types";

/*
 * Mutations for the editor. Each one calls a server action (never fetch),
 * turns a failed Result into an ActionError (so TanStack's error state and
 * the editor's inline field errors both see it), and toasts the outcome.
 */

export class ActionError extends Error {
  readonly fieldErrors?: Record<string, string[]>;

  constructor(error: string, fieldErrors?: Record<string, string[]>) {
    super(error);
    this.name = "ActionError";
    this.fieldErrors = fieldErrors;
  }
}

/** The data of a successful Result, or throws its error. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new ActionError(result.error, result.fieldErrors);
  return result.data;
}

/** The server's field errors, if the error carries any. */
export function fieldErrorsOf(error: unknown) {
  return error instanceof ActionError ? error.fieldErrors : undefined;
}

const toastError = (error: Error) => {
  toast.error(error.message);
};

/** Creates a post (and optionally publishes it), then opens its editor. */
export function useCreatePost() {
  const router = useRouter();
  return useMutation({
    mutationFn: async ({
      input,
      publish = false,
    }: {
      input: PostInput;
      publish?: boolean;
    }) => {
      const post = unwrap(await createPostAction(input));
      return publish ? unwrap(await publishPostAction(post.id)) : post;
    },
    onSuccess: (post) => {
      toast.success(
        post.status === "published" ? "Post published" : "Draft saved",
      );
      router.push(editPath(post.id));
    },
    onError: toastError,
  });
}

export function useUpdatePost() {
  const router = useRouter();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: PostInput }) =>
      unwrap(await updatePostAction(id, patch)),
    onSuccess: () => {
      toast.success("Changes saved");
      router.refresh();
    },
    onError: toastError,
  });
}

/** Publishes a post, saving any pending changes first. */
export function usePublishPost() {
  const router = useRouter();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch?: PostInput }) => {
      if (patch) unwrap(await updatePostAction(id, patch));
      return unwrap(await publishPostAction(id));
    },
    onSuccess: () => {
      toast.success("Post published");
      router.refresh();
    },
    onError: toastError,
  });
}

export function useUnpublishPost() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await unpublishPostAction(id)),
    onSuccess: () => {
      toast.success("Moved back to drafts");
      router.refresh();
    },
    onError: toastError,
  });
}

export function useDeletePost() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deletePostAction(id)),
    onSuccess: () => {
      toast.success("Post deleted");
      router.push("/admin");
    },
    onError: toastError,
  });
}

/** Uploads one image file and resolves to its public URL. */
export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.set("file", file);
      return unwrap(await uploadImageAction(formData)).url;
    },
    onSuccess: () => {
      toast.success("Image uploaded");
    },
    onError: toastError,
  });
}
