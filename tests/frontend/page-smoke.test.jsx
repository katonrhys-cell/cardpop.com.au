import React, { Suspense } from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeAll } from 'vitest';

/**
 * Smoke test: every page under pages/ must render without throwing.
 *
 * This does not assert on output — it only guards against the class of bug that
 * unit tests miss entirely: an import error, a bad hook call, or destructuring
 * undefined data on first paint that white-screens a whole route. Data sources
 * (Supabase, the API server) and the app's context providers are mocked with
 * empty/default values so each page renders in its initial (loading/empty)
 * state in isolation.
 */

// ─── Supabase client stub ──────────────────────────────────────────────────────

// A query builder where every method is chainable and awaiting (or calling
// single/maybeSingle) resolves to an empty result. A Proxy handles any method
// name a page might call (eq, in, order, range, ilike, contains, …).
function makeQuery(result = { data: [], error: null, count: 0 }) {
  // Backed by a real resolved promise so that then/catch/finally are genuinely
  // chainable (a page doing `query.then(...).catch(...)` must not blow up).
  const settled = Promise.resolve(result);
  const proxy = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return settled.then.bind(settled);
        if (prop === 'catch') return settled.catch.bind(settled);
        if (prop === 'finally') return settled.finally.bind(settled);
        if (prop === 'single' || prop === 'maybeSingle' || prop === 'csv') {
          return () => Promise.resolve(result);
        }
        // Any other builder method (eq, in, order, range, ilike, …) is chainable.
        return () => proxy;
      },
    },
  );
  return proxy;
}

const mockSupabase = {
  from: vi.fn(() => makeQuery()),
  rpc: vi.fn(() => makeQuery()),
  channel: vi.fn(() => {
    const ch = { on: vi.fn(() => ch), subscribe: vi.fn(() => ch), unsubscribe: vi.fn() };
    return ch;
  }),
  removeChannel: vi.fn(),
  auth: {
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signOut: vi.fn(async () => ({ error: null })),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    signUp: vi.fn(async () => ({ data: {}, error: null })),
    mfa: {
      listFactors: vi.fn(async () => ({ data: { totp: [] }, error: null })),
      enroll: vi.fn(async () => ({ data: {}, error: null })),
      challenge: vi.fn(async () => ({ data: {}, error: null })),
      verify: vi.fn(async () => ({ data: {}, error: null })),
      getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: 'aal1' }, error: null })),
    },
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(async () => ({ data: {}, error: null })),
      remove: vi.fn(async () => ({ data: {}, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      list: vi.fn(async () => ({ data: [], error: null })),
    })),
  },
  functions: {
    invoke: vi.fn(async () => ({ data: null, error: null })),
  },
};

vi.mock('@/lib/supabaseClient.js', () => ({ supabase: mockSupabase, default: mockSupabase }));

vi.mock('@/lib/apiServerClient.js', () => {
  const client = {
    fetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })),
  };
  return { default: client, apiServerClient: client };
});

// ─── Context / hook stubs ───────────────────────────────────────────────────────

const asyncFn = () => vi.fn(async () => ({}));
const passthrough = ({ children }) => children;

const authValue = {
  currentUser: null, profile: null, session: null, authToken: null,
  isAuthenticated: false, mfaRequired: false, isAdmin: false,
  isVerified: false, isEmailVerified: false, loading: false, profileLoading: false,
  signup: asyncFn(), login: asyncFn(), logout: asyncFn(),
  requestOTP: asyncFn(), requestMFA: asyncFn(), loginWithOTP: asyncFn(),
  verifyMFACode: asyncFn(), enrollTOTP: asyncFn(), confirmTOTP: asyncFn(),
  unenrollTOTP: asyncFn(), listMFAFactors: asyncFn(), resendVerificationEmail: asyncFn(),
  resetPassword: asyncFn(), updatePassword: asyncFn(), refetchProfile: asyncFn(),
};
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => authValue, AuthProvider: passthrough }));

// IMPORTANT: every hook below returns the SAME object instance on each call.
// The real hooks memoize their return (useCallback/useMemo); pages list these
// values in effect dependency arrays. A mock that returns fresh refs each render
// makes those effects re-run every render → setState → infinite loop (hang).

const adminValue = { isAdmin: false, loading: false, logAdminAction: asyncFn(), getSystemHealth: asyncFn() };
vi.mock('@/contexts/AdminContext.jsx', () => ({ useAdmin: () => adminValue, AdminProvider: passthrough }));

const categoryValue = { hierarchy: [], loading: false, error: null };
vi.mock('@/contexts/CategoryContext.jsx', () => ({ useCategory: () => categoryValue, CategoryHierarchyProvider: passthrough }));

const accountValue = {
  stats: { listingsCount: 0, offersCount: 0, transactionsCount: 0, reviewsCount: 0, unreadNotifications: 0 },
  loading: false,
};
vi.mock('@/contexts/AccountContext.jsx', () => ({ useAccount: () => accountValue, AccountProvider: passthrough }));

const cartValue = {
  cartItems: [], isCartOpen: false, setIsCartOpen: vi.fn(),
  addToCart: vi.fn(), removeFromCart: vi.fn(), updateQuantity: vi.fn(),
  clearCart: vi.fn(), getCartTotal: () => '$0.00',
};
vi.mock('@/hooks/useCart.jsx', () => ({ useCart: () => cartValue, CartProvider: passthrough }));

const arr = async () => [];
const categoriesValue = {
  loading: false, error: null,
  getCategories: vi.fn(arr),
  getRootCategories: vi.fn(arr), getFranchisesByCategory: vi.fn(arr),
  getManufacturersByFranchise: vi.fn(arr), getTeamsByFranchise: vi.fn(arr),
  getSetsByFranchiseAndManufacturer: vi.fn(arr), getCategoriesByGroup: vi.fn(arr),
  getParallelsByFranchise: vi.fn(arr), getSubsetsBySet: vi.fn(arr),
  getSubcategoriesByCategory: vi.fn(arr), getBrandsBySubcategory: vi.fn(arr),
  getSeriesByBrand: vi.fn(arr), createNode: vi.fn(async () => ({})),
  updateNode: vi.fn(async () => ({})), deleteNode: vi.fn(async () => ({})),
  buildNameMap: vi.fn(async () => ({})),
};
vi.mock('@/hooks/useCategories.js', () => ({ useCategories: () => categoriesValue }));

// react-helmet (used by SEOHead on most pages) drives DOM side-effects that can
// throw React 18's "Should not already be working" during test teardown and
// poison subsequent renders. A page's <head> tags aren't what a smoke test
// checks, so stub it out.
vi.mock('@/components/SEOHead.jsx', () => ({ default: () => null }));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));

// ─── Browser globals happy-dom doesn't implement ───────────────────────────────

beforeAll(() => {
  window.scrollTo = window.scrollTo || vi.fn();
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
  }
  for (const name of ['IntersectionObserver', 'ResizeObserver']) {
    if (!globalThis[name]) {
      globalThis[name] = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
      };
      window[name] = globalThis[name];
    }
  }
});

// Silence the expected console noise from async cleanup / act warnings so a
// genuine render throw stands out. Stubbed once and left in place — restoring
// per-test would also reset the module-level mock implementations above.
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// ─── The test ───────────────────────────────────────────────────────────────────

const pageModules = import.meta.glob('../../pages/**/*.jsx');

// Catches render/lifecycle errors so a broken page fails its own test cleanly
// via React's boundary mechanism, instead of letting the throw escape into the
// async work loop and corrupt React's internal state for every later test
// (the "Should not already be working" cascade).
class Catch extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <div data-page-error>{String(this.state.error?.message || this.state.error)}</div>;
    }
    return this.props.children;
  }
}

function renderPage(Page) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Suspense fallback={<div>loading</div>}>
        <Catch>
          <Page />
        </Catch>
      </Suspense>
    </MemoryRouter>,
  );
}

// Pages that can't render in isolation from empty mocks because they require a
// route param or a specific populated API payload on first paint (e.g. a detail
// page keyed by a :slug, or a dashboard that indexes into a stats object). They
// still get the import/export check below; a full render needs dedicated
// fixtures and belongs in a page-specific test.
const NEEDS_FIXTURE = new Set([
  'AustralianMarketsPage.jsx', // indexes statsData.totalSalesVolume from a populated stats payload
  'CardMarketDetailPage.jsx',  // detail page keyed by a route :slug + card payload
  'CategoryPage.jsx',          // reads a :categorySlug route param (slug.replace(...))
  'DiagnosticsPage.jsx',       // renders a populated diagnostics/health payload
]);

describe('every page module imports and exports a component', () => {
  for (const [path, loader] of Object.entries(pageModules)) {
    const name = path.replace('../../pages/', '');
    it(`exports ${name}`, async () => {
      // Importing alone catches syntax errors, bad top-level imports, and
      // module-eval crashes — the cheapest, most universal smoke signal.
      const mod = await loader();
      expect(mod).toBeTruthy();
      expect(['function', 'object']).toContain(typeof mod.default);
    });
  }
});

describe('page smoke tests — every page renders without throwing', () => {
  for (const [path, loader] of Object.entries(pageModules)) {
    const name = path.replace('../../pages/', '');
    const runner = NEEDS_FIXTURE.has(name) ? it.skip : it;
    runner(`renders ${name}`, async () => {
      const mod = await loader();
      const Page = mod.default;
      // Skip modules that aren't a renderable component (barrels, constants).
      if (typeof Page !== 'function') return;

      let boundary;
      // Render, then let all mount-effect async work (Supabase queries and their
      // .then chains) settle inside act before unmounting. Stable hook refs
      // (above) guarantee no page settles into a perpetual update loop, so this
      // always terminates.
      await act(async () => {
        boundary = renderPage(Page);
      });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      // The ErrorBoundary swallows a render failure; surface it as a readable
      // assertion so a white-screening page is caught here.
      const crash = boundary.container.querySelector('[data-page-error]');
      expect(crash?.textContent ?? null, `${name} threw during render`).toBeNull();

      boundary.unmount();
    });
  }
});
