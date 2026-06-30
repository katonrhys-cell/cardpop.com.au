import '@testing-library/jest-dom';
import { vi } from 'vitest';

// react-helmet-async requires a <HelmetProvider> context. Isolated component
// tests render without the App's provider, so mock it to context-free no-ops
// (the old react-helmet behaviour) — head/meta side effects aren't asserted here.
vi.mock('react-helmet-async', () => ({
  Helmet: () => null,
  HelmetProvider: ({ children }) => children,
}));
