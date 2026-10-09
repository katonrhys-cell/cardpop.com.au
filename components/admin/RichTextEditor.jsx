import React, { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Link2, Unlink, ImagePlus, Undo2, Redo2, Minus,
} from 'lucide-react';
import { toast } from 'sonner';

// Admin rich-text editor (Tiptap) that reads and writes the same HTML the blog
// already stores in blog_articles.content, so an article written here renders
// through the existing `.article-content` styles and DOMPurify pass unchanged.
// `onUploadImage(file) → Promise<url>` is supplied by the page so the editor
// doesn't know about storage buckets.

const ToolbarButton = ({ onClick, active, disabled, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    aria-pressed={active || undefined}
    className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors disabled:opacity-40 ${
      active ? 'bg-brand-red text-white' : 'text-foreground hover:bg-muted'
    }`}
  >
    {children}
  </button>
);

const Divider = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />;

const RichTextEditor = ({ value = '', onChange, onUploadImage, placeholder = 'Tell the story of the day…', minHeight = '28rem' }) => {
  const fileInputRef = useRef(null);
  const lastEmitted = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { loading: 'lazy', decoding: 'async' } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'article-content prose prose-neutral dark:prose-invert max-w-none focus:outline-none px-5 py-4',
        style: `min-height:${minHeight}`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : ed.getHTML();
      lastEmitted.current = html;
      onChange?.(html);
    },
  });

  // Reflect an external reset (e.g. the page loads the saved article after mount).
  useEffect(() => {
    if (!editor) return;
    if ((value || '') !== (lastEmitted.current || '')) {
      editor.commands.setContent(value || '', { emitUpdate: false });
      lastEmitted.current = value || '';
    }
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href || '';
    const url = window.prompt('Link URL (https://… or /path on CardPop)', previous);
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|\/)/i.test(trimmed)) {
      toast.error('Links must start with https:// or /');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  }, [editor]);

  const pickImage = () => fileInputRef.current?.click();

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;
    if (!onUploadImage) {
      toast.error('Image upload is not available here');
      return;
    }
    const alt = window.prompt('Describe the photo (alt text for readers who can\'t see it)', '') ?? '';
    try {
      toast.message('Uploading photo…');
      const url = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: alt.trim() || null }).run();
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    }
  };

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-brand-red/40">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5 bg-muted/40 rounded-t-xl" role="toolbar" aria-label="Formatting">
        <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></ToolbarButton>
        <Divider />
        <ToolbarButton label="Section heading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton label="Sub-heading" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></ToolbarButton>
        <Divider />
        <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="w-4 h-4" /></ToolbarButton>
        <Divider />
        <ToolbarButton label="Add link" active={editor.isActive('link')} onClick={setLink}><Link2 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton label="Remove link" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()}><Unlink className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton label="Insert photo" onClick={pickImage} disabled={!onUploadImage}><ImagePlus className="w-4 h-4" /></ToolbarButton>
        <span className="flex-1" />
        <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="w-4 h-4" /></ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
