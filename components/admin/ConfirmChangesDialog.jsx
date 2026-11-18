import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/**
 * "Here is what is about to change — are you sure?" Lists every change
 * (before → after) and writes nothing until the admin confirms.
 *
 * `changes`: [{ id, title, sku, lines: [{ label, from, to }] }]
 */
const ConfirmChangesDialog = ({
  open, title, description, changes = [], notes = [], children,
  confirmLabel = 'Confirm changes', confirmDisabled = false, busy = false, onConfirm, onCancel,
}) => (
  <AlertDialog open={open} onOpenChange={(next) => { if (!next && !busy) onCancel?.(); }}>
    <AlertDialogContent className="max-w-xl rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>

      <ul aria-label="Changes to be made" className="max-h-[45vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
        {changes.map((c) => (
          <li key={c.id} className="px-3 py-2 text-sm">
            <p className="font-semibold text-foreground">
              {c.title}
              {c.sku && <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">{c.sku}</span>}
            </p>
            {c.lines.map((line) => (
              <p key={line.label} className="mt-0.5 flex flex-wrap items-center gap-1.5 text-muted-foreground">
                <span>{line.label}:</span>
                <span className="tabular-nums line-through">{line.from}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-label="changes to" />
                <span className="font-semibold tabular-nums text-foreground">{line.to}</span>
              </p>
            ))}
          </li>
        ))}
      </ul>

      {notes.length > 0 && (
        <div className="space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          {notes.map((note) => (
            <p key={note} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              {note}
            </p>
          ))}
        </div>
      )}

      {children}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
        <Button className="font-bold" disabled={busy || confirmDisabled} onClick={onConfirm}>
          {busy ? 'Saving…' : confirmLabel}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmChangesDialog;
