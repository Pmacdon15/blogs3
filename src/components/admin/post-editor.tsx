"use client";

import { Eye, EyeOff, Save, Send, Trash2, Undo2, Wand2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";
import { BlockEditor } from "@/components/admin/block-editor";
import { completeBlocks } from "@/components/admin/blocks";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  type Draft,
  draftFromPost,
  emptyDraft,
  snapshot,
  validateDraft,
} from "@/components/admin/draft";
import {
  errorFor,
  errorWithin,
  FieldError,
  type FieldErrors,
} from "@/components/admin/field-error";
import { ImageUpload, isHttpsUrl } from "@/components/admin/image-upload";
import { postPath } from "@/components/admin/paths";
import { StatusBadge } from "@/components/admin/status-badge";
import { TagsInput } from "@/components/admin/tags-input";
import { PostBlocks } from "@/components/blog/post-blocks";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  fieldErrorsOf,
  useCreatePost,
  useDeletePost,
  usePublishPost,
  useUnpublishPost,
  useUpdatePost,
} from "@/hooks/admin/use-post-mutations";
import { cn } from "@/lib/cn";
import { slugify } from "@/lib/schemas";
import type { Post, PostStatus } from "@/lib/types";

const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted/70 focus:border-brand-400 aria-invalid:border-red-400";

type Props = { mode: "create" } | { mode: "edit"; post: Post };

/*
 * The post editor. Title on top, the block body below, details (slug,
 * excerpt, tags, cover) in a side panel. Validates with the shared zod
 * schema before calling a server action, and shows the server's field
 * errors the same way.
 */
export function PostEditor(props: Props) {
  const post = props.mode === "edit" ? props.post : null;
  const initial = post ? draftFromPost(post) : emptyDraft;

  const [draft, setDraft] = useState<Draft>(initial);
  const [saved, setSaved] = useState(() => snapshot(initial));
  const [status, setStatus] = useState<PostStatus>(post?.status ?? "draft");
  const [slugEdited, setSlugEdited] = useState(post !== null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = useCreatePost();
  const update = useUpdatePost();
  const publish = usePublishPost();
  const unpublish = useUnpublishPost();
  const remove = useDeletePost();
  const pending =
    create.isPending ||
    update.isPending ||
    publish.isPending ||
    unpublish.isPending ||
    remove.isPending;

  const dirty = snapshot(draft) !== saved;

  function edit(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  /** After a successful write: the server's copy is the new clean state. */
  function accept(next: Post) {
    const fresh = draftFromPost(next);
    setDraft(fresh);
    setSaved(snapshot(fresh));
    setStatus(next.status);
    setErrors({});
  }

  const onServerError = (error: Error) => {
    setErrors(fieldErrorsOf(error) ?? {});
  };

  /** Client-side check with the same schema the server uses. */
  function validate() {
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      toast.error("Fix the highlighted fields first.");
      return null;
    }
    setErrors({});
    return result.input;
  }

  function save() {
    if (pending) return;
    const input = validate();
    if (!input) return;
    if (!post) {
      create.mutate({ input }, { onError: onServerError });
      return;
    }
    update.mutate(
      { id: post.id, patch: input },
      { onSuccess: accept, onError: onServerError },
    );
  }

  function publishNow() {
    const input = validate();
    if (!input) return;
    if (!post) {
      create.mutate({ input, publish: true }, { onError: onServerError });
      return;
    }
    publish.mutate(
      { id: post.id, patch: dirty ? input : undefined },
      { onSuccess: accept, onError: onServerError },
    );
  }

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onShortcut(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const listener = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);

  const previewBlocks = completeBlocks(draft.blocks);
  const hidden = draft.blocks.length - previewBlocks.length;
  const titleError = errorFor(errors, "title");

  return (
    <div className="flex flex-col gap-4">
      <div
        aria-label="Editor actions"
        className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-line border-b bg-canvas/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0"
        role="toolbar"
      >
        <StatusBadge status={status} />
        <span
          aria-live="polite"
          className={cn("text-xs", dirty ? "text-amber-700" : "text-muted")}
        >
          {pending
            ? "Saving…"
            : dirty
              ? "Unsaved changes"
              : "All changes saved"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            aria-pressed={preview}
            onClick={() => setPreview((value) => !value)}
            size="sm"
            variant="ghost"
          >
            {preview ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
            {preview ? "Edit" : "Preview"}
          </Button>
          {post && status === "published" ? (
            <Link
              className={buttonClasses("ghost", "sm")}
              href={postPath(post.slug)}
              target="_blank"
            >
              View
            </Link>
          ) : null}
          {post ? (
            <Button
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Delete
            </Button>
          ) : null}
          <Button
            aria-keyshortcuts="Control+S Meta+S"
            disabled={pending}
            onClick={save}
            size="sm"
            variant="secondary"
            title="Save (Ctrl/⌘ + S)"
          >
            <Save aria-hidden="true" className="size-4" />
            {status === "published" ? "Save changes" : "Save draft"}
          </Button>
          {post && status === "published" ? (
            <Button
              disabled={pending}
              onClick={() => unpublish.mutate(post.id, { onSuccess: accept })}
              size="sm"
              variant="secondary"
            >
              <Undo2 aria-hidden="true" className="size-4" />
              Unpublish
            </Button>
          ) : (
            <Button disabled={pending} onClick={publishNow} size="sm">
              <Send aria-hidden="true" className="size-4" />
              Publish
            </Button>
          )}
        </div>
      </div>

      <FieldError id="form-error" message={errorFor(errors, "_")} />

      {preview ? (
        <article className="card mx-auto w-full max-w-3xl p-6 sm:p-10">
          {isHttpsUrl(draft.coverImageUrl) ? (
            <Image
              alt=""
              className="mb-8 aspect-[2/1] w-full rounded-2xl object-cover"
              height={600}
              src={draft.coverImageUrl}
              unoptimized
              width={1200}
            />
          ) : null}
          <h2 className="font-semibold text-4xl text-ink tracking-tight">
            {draft.title || "Untitled"}
          </h2>
          {draft.excerpt ? (
            <p className="mt-3 text-lg text-muted">{draft.excerpt}</p>
          ) : null}
          <div className="mt-8">
            <PostBlocks blocks={previewBlocks} />
          </div>
          {hidden > 0 ? (
            <p className="mt-6 text-amber-700 text-sm">
              {hidden === 1
                ? "1 incomplete block is hidden."
                : `${hidden} incomplete blocks are hidden.`}
            </p>
          ) : null}
        </article>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <label className="sr-only" htmlFor="post-title">
                Title
              </label>
              <input
                aria-describedby="post-title-error"
                aria-invalid={titleError ? true : undefined}
                className="w-full bg-transparent font-semibold text-3xl text-ink tracking-tight outline-none placeholder:text-muted/50 sm:text-4xl"
                id="post-title"
                onChange={(event) => {
                  const title = event.target.value;
                  edit(
                    slugEdited ? { title } : { title, slug: slugify(title) },
                  );
                }}
                placeholder="Post title"
                value={draft.title}
              />
              <FieldError id="post-title-error" message={titleError} />
            </div>
            <BlockEditor
              blocks={draft.blocks}
              errors={errors}
              onChange={(blocks) => edit({ blocks })}
            />
          </div>

          <aside
            aria-label="Post details"
            className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 lg:sticky lg:top-16 lg:self-start"
          >
            <div>
              <div className="flex items-center justify-between">
                <label
                  className="font-medium text-ink text-xs"
                  htmlFor="post-slug"
                >
                  Slug
                </label>
                {slugEdited ? (
                  <button
                    className="inline-flex items-center gap-1 text-brand-700 text-xs hover:underline"
                    onClick={() => {
                      setSlugEdited(false);
                      edit({ slug: slugify(draft.title) });
                    }}
                    type="button"
                  >
                    <Wand2 aria-hidden="true" className="size-3" />
                    From title
                  </button>
                ) : null}
              </div>
              <input
                aria-describedby="post-slug-error"
                aria-invalid={errorFor(errors, "slug") ? true : undefined}
                className={cn(inputClass, "font-mono")}
                id="post-slug"
                onChange={(event) => {
                  setSlugEdited(true);
                  edit({ slug: event.target.value });
                }}
                placeholder="my-post"
                value={draft.slug}
              />
              <FieldError
                id="post-slug-error"
                message={errorFor(errors, "slug")}
              />
            </div>
            <div>
              <label
                className="font-medium text-ink text-xs"
                htmlFor="post-excerpt"
              >
                Excerpt
              </label>
              <textarea
                aria-describedby="post-excerpt-error"
                aria-invalid={errorFor(errors, "excerpt") ? true : undefined}
                className={cn(inputClass, "min-h-20 resize-y")}
                id="post-excerpt"
                onChange={(event) => edit({ excerpt: event.target.value })}
                placeholder="A sentence or two for lists and search"
                value={draft.excerpt}
              />
              <FieldError
                id="post-excerpt-error"
                message={errorFor(errors, "excerpt")}
              />
            </div>
            <TagsInput
              error={errorWithin(errors, "tags")}
              onChange={(tags) => edit({ tags })}
              value={draft.tags}
            />
            <ImageUpload
              error={errorFor(errors, "coverImageUrl")}
              label="Cover image"
              onChange={(coverImageUrl) => edit({ coverImageUrl })}
              value={draft.coverImageUrl}
            />
          </aside>
        </div>
      )}

      {post ? (
        <ConfirmDialog
          confirmLabel="Delete post"
          description={`"${draft.title || "Untitled"}" will be removed for good. This can't be undone.`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate(post.id)}
          open={confirmDelete}
          pending={remove.isPending}
          title="Delete this post?"
        />
      ) : null}
    </div>
  );
}
