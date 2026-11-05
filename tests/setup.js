import '@testing-library/jest-dom';
import { vi } from 'vitest';

// happy-dom 21 implements the Web Animations API. framer-motion then drives
// animations through Element.animate() and cancels them on unmount, which
// rejects each animation's `finished` promise with nobody listening, so Vitest
// reports unhandled rejections and fails the run. Tests never assert on
// animation, so remove animate() and keep framer-motion on its JS animator,
// as it was under happy-dom 20.
if (typeof Element !== 'undefined' && Object.prototype.hasOwnProperty.call(Element.prototype, 'animate')) {
  delete Element.prototype.animate;
}

// react-helmet-async requires a <HelmetProvider> context. Isolated component
// tests render without the App's provider, so mock it to context-free no-ops
// (the old react-helmet behaviour) — head/meta side effects aren't asserted here.
vi.mock('react-helmet-async', () => ({
  Helmet: () => null,
  HelmetProvider: ({ children }) => children,
}));
