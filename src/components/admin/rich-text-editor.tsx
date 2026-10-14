"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useState } from "react";
import { Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Underline, Undo2, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaPickerDialog } from "./media-picker";

function ToolButton({ onClick, active, label, children, disabled }: { onClick: () => void; active?: boolean; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn("rounded p-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-40", active && "bg-brand-50 text-brand-800")}
    >
      {children}
    </button>
  );
}

function setLink(editor: Editor) {
  const prev = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link address (https://…, /page, mailto:…)", prev ?? "https://");
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  if (!/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(url)) {
    window.alert("Please use a full https:// address, a site path such as /about, or mailto:");
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}

/**
 * TipTap rich-text editor. The HTML is submitted in a hidden input and is
 * sanitised again on the server before it is stored.
 */
export function RichTextEditor({ name, initialHtml, label, onChange, minimal }: { name?: string; initialHtml?: string | null; label: string; onChange?: (html: string) => void; minimal?: boolean }) {
  const [html, setHtml] = useState(initialHtml ?? "");
  const [picker, setPicker] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true } }), Image],
    content: initialHtml ?? "",
    immediatelyRender: false,
    editorProps: { attributes: { class: "admin-rich prose-sm", "aria-label": label, role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => {
      const value = editor.isEmpty ? "" : editor.getHTML();
      setHtml(value);
      onChange?.(value);
    },
  });

  return (
    <div className="tiptap-editor rounded-lg border border-gray-300 bg-white focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
      {name ? <input type="hidden" name={name} value={html} /> : null}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-2 py-1" role="toolbar" aria-label={`${label} formatting`}>
        {editor ? (
          <>
            <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolButton>
            <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolButton>
            <ToolButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="h-4 w-4" /></ToolButton>
            {!minimal ? (
              <>
                <span className="mx-1 h-5 w-px bg-gray-200" />
                <ToolButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolButton>
                <ToolButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolButton>
              </>
            ) : null}
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <ToolButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolButton>
            <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolButton>
            <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolButton>
            <ToolButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></ToolButton>
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <ToolButton label="Add link" active={editor.isActive("link")} onClick={() => setLink(editor)}><Link2 className="h-4 w-4" /></ToolButton>
            <ToolButton label="Remove link" disabled={!editor.isActive("link")} onClick={() => editor.chain().focus().unsetLink().run()}><Unlink className="h-4 w-4" /></ToolButton>
            {!minimal ? <ToolButton label="Insert image" onClick={() => setPicker(true)}><ImagePlus className="h-4 w-4" /></ToolButton> : null}
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <ToolButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolButton>
            <ToolButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolButton>
          </>
        ) : (
          <span className="px-2 py-1 text-xs text-gray-500">Loading editor…</span>
        )}
      </div>
      <EditorContent editor={editor} />
      <MediaPickerDialog open={picker} onClose={() => setPicker(false)} onPick={(m) => editor?.chain().focus().setImage({ src: m.url, alt: m.alt }).run()} />
    </div>
  );
}
