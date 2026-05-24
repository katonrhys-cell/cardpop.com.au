import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

const ImageZoomModal = ({ isOpen, onClose, imageUrl, altText }) => {
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const springConfig = { damping: 25, stiffness: 200 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;

  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      x.set(0);
      y.set(0);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '=' || e.key === '+') handleZoom(0.5);
      if (e.key === '-') handleZoom(-0.5);
      
      const panStep = 50;
      if (e.key === 'ArrowUp') y.set(y.get() + panStep);
      if (e.key === 'ArrowDown') y.set(y.get() - panStep);
      if (e.key === 'ArrowLeft') x.set(x.get() + panStep);
      if (e.key === 'ArrowRight') x.set(x.get() - panStep);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, x, y]);

  const handleZoom = (delta) => {
    setScale((prev) => {
      const newScale = Math.min(Math.max(prev + delta, MIN_SCALE), MAX_SCALE);
      if (newScale === MIN_SCALE) {
        x.set(0);
        y.set(0);
      }
      return newScale;
    });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.005;
    handleZoom(delta);
  };

  const resetZoom = () => {
    setScale(1);
    x.set(0);
    y.set(0);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center backdrop-blur-md"
          onWheel={handleWheel}
        >
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/60 to-transparent">
            <div className="text-white/80 font-medium text-sm bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
              {Math.round(scale * 100)}%
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white bg-black/40 hover:bg-white/20 rounded-full transition-all backdrop-blur-sm"
              aria-label="Close image zoom"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Image Container */}
          <div 
            ref={containerRef}
            className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          >
            <motion.div
              drag={scale > 1}
              dragConstraints={containerRef}
              dragElastic={0.1}
              style={{ x: springX, y: springY, scale }}
              className="relative flex items-center justify-center w-[90vw] h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={imageUrl}
                alt={altText}
                className="max-w-full max-h-full object-contain drop-shadow-2xl pointer-events-none"
              />
            </motion.div>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 z-20">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => handleZoom(-0.5)}
              disabled={scale <= MIN_SCALE}
              className="text-white hover:bg-white/20 rounded-xl h-10 w-10"
            >
              <ZoomOut className="w-5 h-5" />
            </Button>
            
            <input 
              type="range" 
              min={MIN_SCALE} 
              max={MAX_SCALE} 
              step="0.1" 
              value={scale} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setScale(val);
                if (val === MIN_SCALE) {
                  x.set(0);
                  y.set(0);
                }
              }}
              className="w-32 sm:w-48 accent-primary"
            />
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => handleZoom(0.5)}
              disabled={scale >= MAX_SCALE}
              className="text-white hover:bg-white/20 rounded-xl h-10 w-10"
            >
              <ZoomIn className="w-5 h-5" />
            </Button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={resetZoom}
              disabled={scale === MIN_SCALE && x.get() === 0 && y.get() === 0}
              className="text-white hover:bg-white/20 rounded-xl h-10 w-10"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ImageZoomModal;