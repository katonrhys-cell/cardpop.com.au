import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Camera, ScanLine } from 'lucide-react';
import { loadOpenCV } from '@/utils/opencvLoader.js';
import { findCardQuad } from '@/utils/detectCard.js';
import { orderCorners } from '@/utils/cardCrop.js';

// Live loop tuning. Detection runs on a small copy of the current frame —
// ~5fps at this size keeps the outline feeling live without cooking the phone.
const DETECT_EDGE = 480;
const DETECT_INTERVAL_MS = 180;
// Auto-capture when the outline has held still for this many consecutive
// detections, within this fraction of the frame's short side.
const STABLE_FRAMES = 5;
const STABLE_TOLERANCE = 0.02;

/** Largest corner displacement between two ordered quads. */
function quadDrift(a, b) {
  const oa = orderCorners(a);
  const ob = orderCorners(b);
  let max = 0;
  for (let i = 0; i < 4; i++) {
    max = Math.max(max, Math.hypot(oa[i][0] - ob[i][0], oa[i][1] - ob[i][1]));
  }
  return max;
}

/**
 * Live card scanner: camera view with a real-time outline that tracks the
 * card, auto-capturing once the outline holds steady (a shutter button is
 * always there for impatient thumbs). The captured frame is handed back as a
 * plain File, so the parent runs the exact same flow as a picked photo —
 * including the auto-suggested crop.
 *
 * Renders as a fixed full-viewport overlay. Mount it conditionally; it stops
 * the camera on unmount. If the camera can't start (no permission, no device,
 * insecure context) it shows the reason and offers to fall back — it never
 * traps the seller.
 */
const CardScanCamera = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const lastQuadRef = useRef(null);
  const stableRef = useRef(0);
  const busyRef = useRef(false);
  const doneRef = useRef(false);

  const [videoDims, setVideoDims] = useState(null); // natural camera frame size
  const [quad, setQuad] = useState(null);           // outline in frame coords
  const [stable, setStable] = useState(false);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(false);

  // Grab the current full-resolution frame and hand it back as a File.
  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || doneRef.current) return;
    doneRef.current = true;
    setFlash(true);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) { doneRef.current = false; setFlash(false); return; }
      onCapture(new File([blob], `card-scan-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  }, [onCapture]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Live scanning needs camera access, which this browser does not offer.');
        return;
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
      } catch {
        setError('Could not start the camera. Check permission, or use the photo picker instead.');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoplay policies — metadata still loads */ }

      // OpenCV loads while the seller lines the card up; frames before it's
      // ready simply go un-outlined.
      let cv = null;
      loadOpenCV().then(c => { cv = c; }).catch(() => {
        if (!cancelled) setError('Card detection could not load. You can still take the photo.');
      });

      const detectCanvas = document.createElement('canvas');
      const ctx = detectCanvas.getContext('2d', { willReadFrequently: true });

      loopRef.current = setInterval(() => {
        if (cancelled || doneRef.current || busyRef.current || !cv) return;
        if (!video.videoWidth) return;
        if (!videoDims) setVideoDims({ w: video.videoWidth, h: video.videoHeight });

        busyRef.current = true;
        try {
          const scale = DETECT_EDGE / Math.max(video.videoWidth, video.videoHeight);
          detectCanvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          detectCanvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          ctx.drawImage(video, 0, 0, detectCanvas.width, detectCanvas.height);

          const found = findCardQuad(cv, detectCanvas);
          if (found) {
            const frameQuad = found.map(([x, y]) => [x / scale, y / scale]);
            const prev = lastQuadRef.current;
            const tolerance = STABLE_TOLERANCE * Math.min(detectCanvas.width, detectCanvas.height) / scale;
            stableRef.current = prev && quadDrift(prev, frameQuad) <= tolerance
              ? stableRef.current + 1
              : 0;
            lastQuadRef.current = frameQuad;
            setQuad(frameQuad);
            const isStable = stableRef.current >= STABLE_FRAMES;
            setStable(isStable);
            if (isStable) capture();
          } else {
            stableRef.current = 0;
            lastQuadRef.current = null;
            setQuad(null);
            setStable(false);
          }
        } catch {
          // A bad frame must not kill the loop.
        } finally {
          busyRef.current = false;
        }
      }, DETECT_INTERVAL_MS);
    }

    start();
    return () => {
      cancelled = true;
      if (loopRef.current) clearInterval(loopRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
    // videoDims is set once from inside the loop; restarting the camera when it
    // lands would drop frames for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture]);

  const outline = quad && videoDims
    ? orderCorners(quad).map(([x, y]) => `${x},${y}`).join(' ')
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" data-testid="card-scan-camera">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-contain"
        />
        {videoDims && (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${videoDims.w} ${videoDims.h}`}
            preserveAspectRatio="xMidYMid meet"
            data-testid="scan-overlay"
            data-has-quad={outline ? 'true' : 'false'}
            data-stable={stable ? 'true' : 'false'}
          >
            {outline && (
              <polygon
                points={outline}
                fill={stable ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.08)'}
                stroke={stable ? '#10b981' : '#ffffff'}
                strokeWidth={Math.max(3, videoDims.w / 250)}
                strokeLinejoin="round"
              />
            )}
          </svg>
        )}
        {flash && <div className="absolute inset-0 bg-white/80 animate-pulse" />}

        <button
          type="button"
          onClick={onCancel}
          aria-label="Close scanner"
          className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="absolute inset-x-0 top-4 flex justify-center">
          <p className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white">
            {error
              ? error
              : stable
                ? 'Hold still…'
                : quad
                  ? 'Card found — hold steady to capture'
                  : 'Point the camera at the card'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 bg-black py-5">
        {error ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-white px-4 py-2 text-sm font-bold text-black"
          >
            Use the photo picker instead
          </button>
        ) : (
          <>
            <ScanLine className="h-5 w-5 text-white/40" aria-hidden />
            <button
              type="button"
              onClick={capture}
              aria-label="Take photo"
              data-testid="scan-shutter"
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white hover:bg-white/30"
            >
              <Camera className="h-7 w-7" />
            </button>
            <span className="w-5" aria-hidden />
          </>
        )}
      </div>
    </div>
  );
};

export default CardScanCamera;
