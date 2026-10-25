import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * The "why didn't my profile save?" pop-up.
 *
 * Takes the object `describeUploadError()` / `checkImageFile()` return
 * (`utils/storageUploadError.js`) and shows it as a modal the user must
 * dismiss — unlike a toast, which disappears before anyone reads it.
 *
 * `error` null = closed.
 */
export default function UploadErrorDialog({ error, onClose }) {
  const open = Boolean(error);
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onClose?.(); }}>
      <AlertDialogContent className="rounded-2xl" data-testid="upload-error-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" aria-hidden="true" />
            {error?.title || 'Your changes couldn\'t be saved'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-relaxed">
            {error?.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error?.detail && (
          <p className="text-xs text-muted-foreground font-mono break-words rounded-md bg-muted px-3 py-2">
            {error.detail}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogAction className="rounded-xl font-bold">OK, got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
