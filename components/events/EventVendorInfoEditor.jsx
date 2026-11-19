import React, { useRef } from 'react';
import { ArrowDown, ArrowUp, FileText, ImageIcon, Link2, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  MAX_VENDOR_INTRO_CHARS,
  MAX_VENDOR_FAQS,
  MAX_VENDOR_QUESTION_CHARS,
  MAX_VENDOR_ANSWER_CHARS,
  MAX_VENDOR_DOCUMENTS,
  MAX_VENDOR_LINKS,
  MAX_VENDOR_TITLE_CHARS,
  emptyVendorFaq,
  emptyVendorLink,
  isPdfUrl,
  safeVendorUrl,
} from '@/utils/eventVendorInfo.js';
import { vendorFileError, VENDOR_FILE_ACCEPT } from '@/utils/uploadEventVendorFile.js';

// The event form's Vendors tab, below the application link: what traders need
// to know (utils/eventVendorInfo.js). Controlled: `value` is
// { intro, faqs: [{ question, answer }], documents, links: [{ label, url }] }
// where a document is { title, url } (saved) or { title, file } (picked —
// uploaded when the form is saved, see EventFormModal). The event page shows
// it as "Vendor Information" (components/events/EventVendorInfo.jsx).

const move = (list, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

const RowButtons = ({ index, count, onMove, onRemove, disabled, noun }) => (
  <div className="flex gap-1 shrink-0">
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
      onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={`Move ${noun} ${index + 1} up`}>
      <ArrowUp className="w-3.5 h-3.5" />
    </Button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
      onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={`Move ${noun} ${index + 1} down`}>
      <ArrowDown className="w-3.5 h-3.5" />
    </Button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
      onClick={onRemove} disabled={disabled} aria-label={`Remove ${noun} ${index + 1}`}>
      <Trash2 className="w-3.5 h-3.5" />
    </Button>
  </div>
);

const SectionHeading = ({ children, hint }) => (
  <div className="space-y-0.5">
    <h3 className="font-bold text-foreground">{children}</h3>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const EventVendorInfoEditor = ({ value, onChange, disabled = false }) => {
  const fileRef = useRef(null);
  const { intro = '', faqs = [], documents = [], links = [] } = value || {};
  const set = (patch) => onChange({ intro, faqs, documents, links, ...patch });

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const problems = files.map(vendorFileError);
    const firstProblem = problems.find(Boolean);
    if (firstProblem) {
      const skipped = problems.filter(Boolean).length;
      toast.error(skipped === 1 ? firstProblem : `${skipped} files were skipped. ${firstProblem}`);
    }
    const ok = files.filter((_, i) => !problems[i]);
    const room = MAX_VENDOR_DOCUMENTS - documents.length;
    if (ok.length > room) toast.error(`Up to ${MAX_VENDOR_DOCUMENTS} vendor documents.`);
    const added = ok.slice(0, Math.max(room, 0)).map((file) => ({
      title: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, MAX_VENDOR_TITLE_CHARS),
      file,
    }));
    if (added.length) set({ documents: [...documents, ...added] });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="space-y-2">
        <Label htmlFor="vendor_intro" className="font-bold">Information for vendors</Label>
        <Textarea
          id="vendor_intro"
          value={intro}
          onChange={(e) => set({ intro: e.target.value.slice(0, MAX_VENDOR_INTRO_CHARS) })}
          placeholder="Table sizes and prices, bump-in times, what's included (power, chairs), payment and cancellation terms…"
          rows={6}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">{intro.length}/{MAX_VENDOR_INTRO_CHARS}</p>
      </div>

      {/* Documents */}
      <div className="space-y-3">
        <SectionHeading hint="Trader pack, floor plan, vendor terms — PDF or image, up to 20MB each. Uploaded when you save.">
          Vendor documents
        </SectionHeading>
        {documents.length > 0 && (
          <ul className="space-y-2 list-none p-0 m-0">
            {documents.map((doc, i) => {
              const pdf = doc.file ? /pdf/i.test(doc.file.type) || /\.pdf$/i.test(doc.file.name) : isPdfUrl(doc.url);
              const Icon = pdf ? FileText : ImageIcon;
              return (
                <li key={doc.url || `${doc.file?.name}-${i}`} className="rounded-2xl border border-border bg-muted/20 p-3 flex items-center gap-2">
                  <Icon className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <Label htmlFor={`vendor-doc-${i + 1}`} className="sr-only">Vendor document {i + 1} title</Label>
                    <Input
                      id={`vendor-doc-${i + 1}`}
                      value={doc.title}
                      onChange={(e) => set({ documents: documents.map((d, j) => (j === i ? { ...d, title: e.target.value.slice(0, MAX_VENDOR_TITLE_CHARS) } : d)) })}
                      placeholder="Title — e.g. Trader Pack 2027"
                      disabled={disabled}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.file ? `New: ${doc.file.name}` : (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="hover:underline">View saved file</a>
                      )}
                    </p>
                  </div>
                  <RowButtons
                    index={i} count={documents.length} noun="vendor document" disabled={disabled}
                    onMove={(dir) => set({ documents: move(documents, i, dir) })}
                    onRemove={() => set({ documents: documents.filter((_, j) => j !== i) })}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={VENDOR_FILE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
          data-testid="vendor-file-input"
        />
        <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}
          disabled={disabled || documents.length >= MAX_VENDOR_DOCUMENTS}>
          <Upload className="w-4 h-4" /> Upload document
        </Button>
      </div>

      {/* Links */}
      <div className="space-y-3">
        <SectionHeading hint="Your own vendor page, vendor FAQ page, stall map — anything that lives on another site.">
          Vendor links
        </SectionHeading>
        {links.map((link, i) => {
          const typed = link.url.trim().length > 0;
          const looksOk = !typed || Boolean(safeVendorUrl(link.url)) || !/^[a-z][a-z0-9+.-]*:/i.test(link.url.trim());
          return (
            <div key={i} className="rounded-2xl border border-border bg-muted/20 p-3 flex items-start gap-2">
              <Link2 className="w-5 h-5 text-muted-foreground shrink-0 mt-2" aria-hidden="true" />
              <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`vendor-link-label-${i + 1}`} className="sr-only">Vendor link {i + 1} label</Label>
                  <Input
                    id={`vendor-link-label-${i + 1}`}
                    value={link.label}
                    onChange={(e) => set({ links: links.map((l, j) => (j === i ? { ...l, label: e.target.value.slice(0, MAX_VENDOR_TITLE_CHARS) } : l)) })}
                    placeholder="Label — e.g. Vendor FAQs"
                    disabled={disabled}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label htmlFor={`vendor-link-url-${i + 1}`} className="sr-only">Vendor link {i + 1} address</Label>
                  <Input
                    id={`vendor-link-url-${i + 1}`}
                    type="url"
                    value={link.url}
                    onChange={(e) => set({ links: links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)) })}
                    placeholder="https://"
                    disabled={disabled}
                    className="h-9"
                    aria-invalid={!looksOk}
                  />
                </div>
              </div>
              <RowButtons
                index={i} count={links.length} noun="vendor link" disabled={disabled}
                onMove={(dir) => set({ links: move(links, i, dir) })}
                onRemove={() => set({ links: links.filter((_, j) => j !== i) })}
              />
            </div>
          );
        })}
        <Button type="button" variant="outline" className="gap-2" onClick={() => set({ links: [...links, emptyVendorLink()] })}
          disabled={disabled || links.length >= MAX_VENDOR_LINKS}>
          <Plus className="w-4 h-4" /> Add link
        </Button>
      </div>

      {/* FAQs */}
      <div className="space-y-3">
        <SectionHeading hint="Questions traders ask you every time. Shown as an expandable list on the event page.">
          Vendor FAQs
        </SectionHeading>
        {faqs.map((faq, i) => (
          <div key={i} className="rounded-2xl border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <Label htmlFor={`vendor-faq-q-${i + 1}`} className="sr-only">Vendor FAQ {i + 1} question</Label>
                <Input
                  id={`vendor-faq-q-${i + 1}`}
                  value={faq.question}
                  onChange={(e) => set({ faqs: faqs.map((f, j) => (j === i ? { ...f, question: e.target.value.slice(0, MAX_VENDOR_QUESTION_CHARS) } : f)) })}
                  placeholder="Question — e.g. How big is a trader table?"
                  disabled={disabled}
                  className="h-9 font-semibold"
                />
              </div>
              <RowButtons
                index={i} count={faqs.length} noun="vendor FAQ" disabled={disabled}
                onMove={(dir) => set({ faqs: move(faqs, i, dir) })}
                onRemove={() => set({ faqs: faqs.filter((_, j) => j !== i) })}
              />
            </div>
            <Label htmlFor={`vendor-faq-a-${i + 1}`} className="sr-only">Vendor FAQ {i + 1} answer</Label>
            <Textarea
              id={`vendor-faq-a-${i + 1}`}
              value={faq.answer}
              onChange={(e) => set({ faqs: faqs.map((f, j) => (j === i ? { ...f, answer: e.target.value.slice(0, MAX_VENDOR_ANSWER_CHARS) } : f)) })}
              placeholder="Answer"
              rows={3}
              disabled={disabled}
            />
          </div>
        ))}
        <Button type="button" variant="outline" className="gap-2" onClick={() => set({ faqs: [...faqs, emptyVendorFaq()] })}
          disabled={disabled || faqs.length >= MAX_VENDOR_FAQS}>
          <Plus className="w-4 h-4" /> Add question
        </Button>
      </div>
    </div>
  );
};

export default EventVendorInfoEditor;
