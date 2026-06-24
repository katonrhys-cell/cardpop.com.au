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

  const title = 'Format Photo';

  const description = 'Your card is cut out and centered on a studio dark-gradient 1000×1400 backdrop for professional marketplace display.';

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
                    Formatting your photo…
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

                <div className="text-xs text-muted-foreground text-center px-4 space-y-1">
                  <p className="font-medium">Export format:</p>
                  <p>1000×1400 • Studio dark-gradient backdrop • Centered card</p>
                </div>
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
                  'Apply Format'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm font-medium text-emerald-700">
                ✓ Photo formatted successfully!
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Your vault photo has been updated with the formatted version.
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
