"use client";
import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading2, Heading3, Undo, Redo } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

export function RichTextEditor({ value, onChange, placeholder = "Start typing…", className, minHeight = 200 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank", class: "text-primary underline" }
      })
    ],
    content: value || "",
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: cn("rte-content focus:outline-none px-3 py-2.5"),
        style: `min-height:${minHeight}px;`
      }
    },
    immediatelyRender: false
  });

  // Sync external value changes (e.g. when initial loads asynchronously)
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    // Avoid replacing while user is typing
    if (value && value !== current && editor.isEmpty) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return <div className={cn("rounded-md border border-input bg-white", className)} style={{ minHeight: minHeight + 40 }} />;
  }

  return (
    <div className={cn("rounded-md border border-input bg-white transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring", className)}>
      <Toolbar editor={editor} />
      <div className="relative">
        {editor.isEmpty && (
          <span className="pointer-events-none absolute left-3 top-2.5 select-none text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const buttons: Array<{
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
  }> = [
    {
      label: "Bold",
      icon: Bold,
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive("bold")
    },
    {
      label: "Italic",
      icon: Italic,
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive("italic")
    },
    {
      label: "Heading 2",
      icon: Heading2,
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive("heading", { level: 2 })
    },
    {
      label: "Heading 3",
      icon: Heading3,
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive("heading", { level: 3 })
    },
    {
      label: "Bulleted list",
      icon: List,
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive("bulletList")
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive("orderedList")
    }
  ];

  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
      {buttons.map((b) => (
        <ToolbarButton key={b.label} label={b.label} icon={b.icon} onClick={b.onClick} isActive={b.isActive} />
      ))}
      <ToolbarButton
        label={editor.isActive("link") ? "Remove link" : "Add link"}
        icon={LinkIcon}
        onClick={setLink}
        isActive={editor.isActive("link")}
      />
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton label="Undo" icon={Undo} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
      <ToolbarButton label="Redo" icon={Redo} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
    </div>
  );
}

function ToolbarButton({
  label, icon: Icon, onClick, isActive, disabled
}: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; isActive?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent",
        isActive && "bg-primary/10 text-primary hover:bg-primary/15"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * Read-only renderer for descriptions stored as HTML (or plain text legacy content).
 * Wrap with the same .rte-content class so spacing/lists stay consistent.
 */
export function RichTextView({ html, className }: { html: string | null | undefined; className?: string }) {
  const content = html ?? "";
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  if (!content.trim()) return null;
  if (isHtml) {
    return <div className={cn("rte-content", className)} dangerouslySetInnerHTML={{ __html: content }} />;
  }
  // Legacy plain text — preserve line breaks
  return <div className={cn("rte-content whitespace-pre-wrap", className)}>{content}</div>;
}
