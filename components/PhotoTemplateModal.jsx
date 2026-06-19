import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';

const PhotoTemplateModal = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  previewUrl,
  processType,
  step = 'preview' // 'preview' or 'confirm'
}) => {
  const canvasRef = useRef(null);

  const title = processType === 'slab'
    ? 'Slab Template Preview'
    : 'Background Removal Preview';

  const description = processType === 'slab'
    ? 'Your card will be centered on a white 1000×1400 template, perfect for slab display.'
    : 'The background will be removed from your card image.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === 'preview' && (
          <div className="space-y-6">
            {isProcessing ? (
              <div className="aspect-square bg-muted rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {processType === 'slab' ? 'Creating template...' : 'Removing background...'}
                  </p>
                </div>
              </div>
            ) : previewUrl ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-full max-w-lg">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full rounded-xl border border-border shadow-md"
                  />
                </div>

                {processType === 'slab' && (
                  <div className="text-xs text-muted-foreground text-center px-4">
                    <p className="mb-2">
                      <strong>CardPop recommends this for slabs</strong>
                    </p>
                    <p>Your card image will be centered on a white background at 1000×1400 pixels</p>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isProcessing}
              >
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button
                onClick={onConfirm}
                className="flex-1"
                disabled={!previewUrl || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                  </>
                ) : (
                  `${processType === 'slab' ? 'Use Template' : 'Apply'}`
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm font-medium text-emerald-700">
                ✓ Image processed successfully!
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Your vault photo has been updated.
              </p>
            </div>

            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoTemplateModal;
