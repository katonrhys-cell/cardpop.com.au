
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { ZoomIn, ImageOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { cn } from '@/lib/utils.js';

const ProductImageCarousel = ({ images = [], record = null }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const getImageUrl = (img) => {
    if (!img) return null;
    if (typeof img === 'string' && img.startsWith('http')) return img;
    // If record has a storage_path, use Supabase Storage
    if (record && record.storage_path) {
      return supabase.storage.from('vault-images').getPublicUrl(record.storage_path).data.publicUrl;
    }
    // img might itself be a storage path
    if (typeof img === 'string') {
      return supabase.storage.from('vault-images').getPublicUrl(img).data.publicUrl;
    }
    return null;
  };

  const validImages = Array.isArray(images) ? images : (images ? [images] : []);
  const currentImage = validImages.length > 0 ? getImageUrl(validImages[activeIndex]) : null;

  if (validImages.length === 0 || !currentImage) {
    return (
      <div className="w-full aspect-[4/5] md:aspect-square bg-muted/40 rounded-3xl border border-border flex flex-col items-center justify-center text-muted-foreground">
        <ImageOff className="w-16 h-16 mb-4 opacity-20" />
        <p className="font-medium text-sm">No images available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image with Zoom Modal */}
      <Dialog>
        <DialogTrigger asChild>
          <div className="relative w-full aspect-[4/5] md:aspect-square rounded-3xl border border-border overflow-hidden bg-white dark:bg-zinc-950 cursor-zoom-in group shadow-sm">
            <img 
              src={currentImage} 
              alt={`Product view ${activeIndex + 1}`} 
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
            <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <ZoomIn className="w-5 h-5 text-foreground" />
            </div>
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-4xl w-[90vw] h-[90vh] p-0 overflow-hidden bg-transparent border-none shadow-none">
          <DialogTitle className="sr-only">Product Image Zoom</DialogTitle>
          <div className="w-full h-full flex items-center justify-center bg-black/90 rounded-2xl">
            <img 
              src={currentImage} 
              alt={`Product view ${activeIndex + 1} zoomed`} 
              className="max-w-full max-h-full object-contain p-4"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Thumbnails */}
      {validImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
          {validImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                "relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 bg-white dark:bg-zinc-950 transition-all duration-200 snap-start",
                activeIndex === idx 
                  ? "border-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background" 
                  : "border-border hover:border-primary/50 opacity-70 hover:opacity-100"
              )}
            >
              <img 
                src={getImageUrl(img)} 
                alt={`Thumbnail ${idx + 1}`} 
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductImageCarousel;
