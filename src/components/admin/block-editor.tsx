"use client";

import {
  ArrowDown,
  ArrowUp,
  Bold,
  Code2,
  Code as CodeIcon,
  Copy,
  GripVertical,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import {
  type DragEvent,
  type KeyboardEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AutoTextarea } from "@/components/admin/auto-textarea";
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  duplicateBlock,
  insertBlock,
  moveBlock,
  newBlock,
  removeBlock,
  reorderBlock,
  replaceBlock,
} from "@/components/admin/blocks";
import {
  errorFor,
  FieldError,
  type FieldErrors,
} from "@/components/admin/field-error";
import { ImageUpload } from "@/components/admin/image-upload";
import { HighlightedCode } from "@/components/blog/code-snippet";
import { cn } from "@/lib/cn";
import {
  CODE_SNIPPET_PRESETS,
  CODE_THEME_STYLES,
  CODE_THEMES,
  type CodeTheme,
  DEFAULT_CODE_THEME,
} from "@/lib/code-highlight";
import {
  applyFormat,
  FORMAT_SHORTCUTS,
  type InlineFormat,
} from "@/lib/inline-format";
import {
  type Block,
  type BlockType,
  CODE_LANGUAGES,
  MAX_BLOCKS,
} from "@/lib/schemas";

const ICONS: Record<BlockType, typeof Type> = {
  heading: Heading2,
  text: Type,
  image: ImageIcon,
  code: Code2,
};

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted/70 focus:border-brand-400 aria-invalid:border-red-400";

const iconButton =
  "inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-40";

/*
 * The post body: an ordered list of blocks. Add from the toolbar or the "+"
 * between blocks; each block can be moved, duplicated or deleted.
 */
export function BlockEditor({
  blocks,
  onChange,
  errors,
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  errors: FieldErrors;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const full = blocks.length >= MAX_BLOCKS;
  const add = (index: number, type: BlockType) =>
    onChange(insertBlock(blocks, index, newBlock(type)));

  function handleDragEnd() {
    setDragIndex(null);
    setDropTargetIndex(null);
  }

  return (
    <section aria-label="Content" className="flex flex-col gap-3">
      <div
        aria-label="Add a block"
        className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1.5"
        role="toolbar"
      >
        <span className="px-2 font-medium text-muted text-xs">Add</span>
        {BLOCK_TYPES.map((type) => {
          const Icon = ICONS[type];
          return (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-medium text-ink text-sm hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
              disabled={full}
              key={type}
              onClick={() => add(blocks.length, type)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-4" />
              {BLOCK_LABELS[type]}
            </button>
          );
        })}
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-xl border border-line border-dashed px-4 py-10 text-center text-muted text-sm">
          No content yet. Add a heading, text, image or code block.
        </p>
      ) : null}

      <ol className="flex flex-col">
        {blocks.map((block, index) => (
          <li
            key={block.id}
            onDragOver={(event) => {
              if (dragIndex === null) return;
              event.preventDefault();
              if (dropTargetIndex !== index) {
                setDropTargetIndex(index);
              }
            }}
            onDrop={(event) => {
              if (dragIndex === null) return;
              event.preventDefault();
              if (dragIndex !== index) {
                onChange(reorderBlock(blocks, dragIndex, index));
              }
              handleDragEnd();
            }}
          >
            {index > 0 ? (
              <InsertMenu
                disabled={full}
                index={index}
                onPick={(type) => add(index, type)}
              />
            ) : null}
            <BlockCard
              block={block}
              canDuplicate={!full}
              count={blocks.length}
              errors={errors}
              index={index}
              isDragging={dragIndex === index}
              isDropTarget={
                dropTargetIndex === index &&
                dragIndex !== null &&
                dragIndex !== index
              }
              onChange={(next) => onChange(replaceBlock(blocks, index, next))}
              onDelete={() => onChange(removeBlock(blocks, index))}
              onDragEnd={handleDragEnd}
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer?.setData("text/plain", String(index));
              }}
              onDuplicate={() => onChange(duplicateBlock(blocks, index))}
              onMove={(by) => onChange(moveBlock(blocks, index, by))}
            />
          </li>
        ))}
      </ol>
      <FieldError id="blocks-error" message={errorFor(errors, "blocks")} />
    </section>
  );
}

/** The "+" between two blocks; opens a small menu of block types. */
export function InsertMenu({
  index,
  disabled,
  onPick,
}: {
  index: number;
  disabled: boolean;
  onPick: (type: BlockType) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group relative flex h-6 items-center justify-center">
      <span
        aria-hidden="true"
        className="absolute inset-x-4 top-1/2 h-px bg-line opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      />
      {open ? (
        <fieldset
          aria-label={`Block type for position ${index + 1}`}
          className="relative z-10 m-0 flex min-w-0 gap-1 rounded-lg border border-line bg-surface p-1 shadow-(--shadow-card)"
        >
          {BLOCK_TYPES.map((type) => (
            <button
              className="rounded-md px-2 py-0.5 font-medium text-ink text-xs hover:bg-brand-50 hover:text-brand-700"
              key={type}
              onClick={() => {
                setOpen(false);
                onPick(type);
              }}
              type="button"
            >
              {BLOCK_LABELS[type]}
            </button>
          ))}
          <button
            aria-label="Cancel"
            className="rounded-md px-1.5 text-muted text-xs hover:bg-brand-50"
            onClick={() => setOpen(false)}
            type="button"
          >
            ✕
          </button>
        </fieldset>
      ) : (
        <button
          aria-label={`Insert a block at position ${index + 1}`}
          className="relative z-10 inline-flex size-6 items-center justify-center rounded-full border border-line bg-surface text-muted opacity-60 transition hover:border-brand-300 hover:text-brand-700 hover:opacity-100 focus-visible:opacity-100 disabled:hidden"
          disabled={disabled}
          onClick={() => setOpen(true)}
          type="button"
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function BlockCard({
  block,
  index,
  count,
  errors,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  canDuplicate,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
}: {
  block: Block;
  index: number;
  count: number;
  errors: FieldErrors;
  onChange: (block: Block) => void;
  onMove: (by: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canDuplicate: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const Icon = ICONS[block.type];
  const label = `${BLOCK_LABELS[block.type]} block ${index + 1}`;
  const prefix = `blocks.${index}`;

  return (
    <div
      className={cn(
        "group/block rounded-xl border border-line bg-surface shadow-xs transition-shadow focus-within:border-brand-300 focus-within:shadow-(--shadow-card)",
        isDragging && "opacity-50",
        isDropTarget && "border-brand-400 ring-2 ring-brand-200",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-line border-b px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            aria-label={`Drag ${label}`}
            className={cn(iconButton, "cursor-grab active:cursor-grabbing")}
            draggable
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            type="button"
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>
          <span className="inline-flex items-center gap-1.5 font-medium text-muted text-xs uppercase tracking-wide">
            <Icon aria-hidden="true" className="size-3.5" />
            {BLOCK_LABELS[block.type]}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            aria-label={`Move ${label} up`}
            className={iconButton}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            type="button"
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={`Move ${label} down`}
            className={iconButton}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            type="button"
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={`Duplicate ${label}`}
            className={iconButton}
            disabled={!canDuplicate}
            onClick={onDuplicate}
            type="button"
          >
            <Copy aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={`Delete ${label}`}
            className={cn(iconButton, "hover:bg-red-50 hover:text-red-600")}
            onClick={onDelete}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      <div className="p-3">
        <BlockFields
          block={block}
          errors={errors}
          label={label}
          onChange={onChange}
          prefix={prefix}
        />
      </div>
    </div>
  );
}

function BlockFields({
  block,
  label,
  prefix,
  errors,
  onChange,
}: {
  block: Block;
  label: string;
  prefix: string;
  errors: FieldErrors;
  onChange: (block: Block) => void;
}) {
  const id = useId();
  switch (block.type) {
    case "heading": {
      const error = errorFor(errors, `${prefix}.text`);
      return (
        <>
          <input
            aria-describedby={`${id}-error`}
            aria-invalid={error ? true : undefined}
            aria-label={label}
            className="w-full bg-transparent font-semibold text-ink text-xl tracking-tight outline-none placeholder:text-muted/60"
            onChange={(event) =>
              onChange({ ...block, text: event.target.value })
            }
            placeholder="Heading"
            value={block.text}
          />
          <FieldError id={`${id}-error`} message={error} />
        </>
      );
    }
    case "text":
      return (
        <TextFields
          block={block}
          error={errorFor(errors, `${prefix}.text`)}
          label={label}
          onChange={onChange}
        />
      );
    case "image":
      return (
        <div className="grid gap-3">
          <ImageUpload
            error={errorFor(errors, `${prefix}.url`)}
            label="Image"
            onChange={(url) => onChange({ ...block, url })}
            onWidthChange={(width) => onChange({ ...block, width })}
            value={block.url}
            width={block.width}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                className="font-medium text-ink text-xs"
                htmlFor={`${id}-alt`}
              >
                Alt text
              </label>
              <input
                aria-describedby={`${id}-alt-error`}
                className={cn(inputClass, "mt-1")}
                id={`${id}-alt`}
                onChange={(event) =>
                  onChange({ ...block, alt: event.target.value })
                }
                placeholder="Describe the image"
                value={block.alt}
              />
              <FieldError
                id={`${id}-alt-error`}
                message={errorFor(errors, `${prefix}.alt`)}
              />
            </div>
            <div>
              <label
                className="font-medium text-ink text-xs"
                htmlFor={`${id}-caption`}
              >
                Caption
              </label>
              <input
                aria-describedby={`${id}-caption-error`}
                className={cn(inputClass, "mt-1")}
                id={`${id}-caption`}
                onChange={(event) =>
                  onChange({ ...block, caption: event.target.value })
                }
                placeholder="Optional"
                value={block.caption ?? ""}
              />
              <FieldError
                id={`${id}-caption-error`}
                message={errorFor(errors, `${prefix}.caption`)}
              />
            </div>
          </div>
        </div>
      );
    case "code":
      return (
        <CodeFields
          block={block}
          error={errorFor(errors, `${prefix}.code`)}
          label={label}
          onChange={onChange}
        />
      );
  }
}

type TextBlock = Extract<Block, { type: "text" }>;

const FORMAT_BUTTONS: {
  format: InlineFormat;
  label: string;
  shortcut: string;
  Icon: typeof Type;
}[] = [
  { format: "bold", label: "Bold", shortcut: "B", Icon: Bold },
  { format: "italic", label: "Italic", shortcut: "I", Icon: Italic },
  { format: "code", label: "Inline code", shortcut: "E", Icon: CodeIcon },
  { format: "link", label: "Link", shortcut: "K", Icon: Link2 },
];

/*
 * A text block: a textarea with a small toolbar (and Ctrl/⌘ shortcuts) that
 * wraps the selection in **bold**, *italic*, `code` or [link](url) markers.
 */
function TextFields({
  block,
  label,
  error,
  onChange,
}: {
  block: TextBlock;
  label: string;
  error?: string;
  onChange: (block: Block) => void;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);

  // After formatting, restore focus and select the wrapped text (or link URL).
  useLayoutEffect(() => {
    if (selection.current && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(
        selection.current.start,
        selection.current.end,
      );
      selection.current = null;
    }
  });

  function format(kind: InlineFormat) {
    const element = ref.current as HTMLTextAreaElement;
    const next = applyFormat(
      block.text,
      element.selectionStart,
      element.selectionEnd,
      kind,
    );
    selection.current = { start: next.start, end: next.end };
    onChange({ ...block, text: next.value });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey)
      return;
    const kind = FORMAT_SHORTCUTS[event.key.toLowerCase()];
    if (!kind) return;
    event.preventDefault();
    format(kind);
  }

  return (
    <>
      <div
        aria-controls={`${id}-text`}
        aria-label={`Format ${label}`}
        className="-mt-1 mb-2 flex items-center gap-0.5"
        role="toolbar"
      >
        {FORMAT_BUTTONS.map(({ format: kind, label: name, shortcut, Icon }) => (
          <button
            aria-keyshortcuts={`Control+${shortcut} Meta+${shortcut}`}
            aria-label={name}
            className={iconButton}
            key={kind}
            // Keep the textarea's selection when the button is clicked.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => format(kind)}
            title={`${name} (Ctrl/⌘+${shortcut})`}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        ))}
      </div>
      <AutoTextarea
        aria-describedby={`${id}-error`}
        aria-invalid={error ? true : undefined}
        aria-label={label}
        className="w-full bg-transparent text-[15px] text-ink leading-relaxed outline-none placeholder:text-muted/60"
        id={`${id}-text`}
        onChange={(event) => onChange({ ...block, text: event.target.value })}
        onKeyDown={onKeyDown}
        placeholder="Write something… (blank lines start new paragraphs)"
        ref={ref}
        value={block.text}
      />
      <FieldError id={`${id}-error`} message={error} />
    </>
  );
}

type CodeBlock = Extract<Block, { type: "code" }>;

/** Inserts two spaces at the selection (what Tab does in the code field). */
export function indent(value: string, start: number, end: number) {
  return {
    value: `${value.slice(0, start)}  ${value.slice(end)}`,
    caret: start + 2,
  };
}

function CodeFields({
  block,
  label,
  error,
  onChange,
}: {
  block: CodeBlock;
  label: string;
  error?: string;
  onChange: (block: Block) => void;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  const [theme, setTheme] = useState<CodeTheme>(DEFAULT_CODE_THEME);
  const palette = CODE_THEME_STYLES[theme];

  // After a Tab, put the caret back after the inserted spaces.
  useLayoutEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    const { selectionStart, selectionEnd } = event.currentTarget;
    const next = indent(block.code, selectionStart, selectionEnd);
    caret.current = next.caret;
    onChange({ ...block, code: next.value });
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border transition-colors",
        palette.wrapper,
      )}
      data-code-theme={theme}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5",
          palette.header,
        )}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-rose-400/85" />
            <span className="size-2 rounded-full bg-amber-400/85" />
            <span className="size-2 rounded-full bg-emerald-400/85" />
          </span>
          <label className="sr-only" htmlFor={`${id}-language`}>
            Language for {label}
          </label>
          <select
            className="rounded bg-transparent font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
            id={`${id}-language`}
            onChange={(event) =>
              onChange({
                ...block,
                language: event.target.value as CodeBlock["language"],
              })
            }
            value={block.language}
          >
            {CODE_LANGUAGES.map((language) => (
              <option className="text-ink" key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`${id}-theme`}>
            Theme for {label}
          </label>
          <select
            className={cn(
              "rounded border px-1.5 py-0.5 font-mono text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-brand-400",
              palette.badge,
            )}
            id={`${id}-theme`}
            onChange={(event) => setTheme(event.target.value as CodeTheme)}
            value={theme}
          >
            {CODE_THEMES.map((option) => (
              <option className="text-ink" key={option} value={option}>
                {CODE_THEME_STYLES[option].label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${id}-preset`}>
            Starter snippet for {label}
          </label>
          <select
            className={cn(
              "rounded border px-1.5 py-0.5 font-mono text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-brand-400",
              palette.badge,
            )}
            id={`${id}-preset`}
            onChange={(event) => {
              const preset = CODE_SNIPPET_PRESETS[Number(event.target.value)];
              setTheme(preset.theme);
              onChange({
                ...block,
                language: preset.language,
                code: preset.code,
              });
            }}
            value=""
          >
            <option className="text-ink" disabled value="">
              Starter snippet…
            </option>
            {CODE_SNIPPET_PRESETS.map((preset, index) => (
              <option className="text-ink" key={preset.id} value={index}>
                {preset.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] opacity-75">Tab inserts 2 spaces</span>
        </div>
      </div>
      <textarea
        aria-describedby={`${id}-error`}
        aria-invalid={error ? true : undefined}
        aria-label={label}
        className="field-sizing-content block min-h-32 w-full resize-y bg-transparent p-3 font-mono text-sm leading-relaxed outline-none placeholder:opacity-50"
        onChange={(event) => onChange({ ...block, code: event.target.value })}
        onKeyDown={onKeyDown}
        placeholder="// code"
        ref={ref}
        spellCheck={false}
        value={block.code}
      />
      {block.code ? (
        <div
          aria-hidden="true"
          className="border-white/10 border-t bg-black/20 px-3 py-2.5"
        >
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider opacity-60">
            Color preview ({palette.label})
          </div>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed">
            <HighlightedCode
              code={block.code}
              language={block.language}
              theme={theme}
            />
          </pre>
        </div>
      ) : null}
      <div className="bg-surface px-3">
        <FieldError id={`${id}-error`} message={error} />
      </div>
    </div>
  );
}
