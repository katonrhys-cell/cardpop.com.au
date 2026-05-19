
# COMPREHENSIVE STABILITY FIXES - Frontend & Performance

## 1. Global Error Boundary Injection
Verify `ErrorBoundary.jsx` wraps `<Router>` inside `App.jsx` to prevent blank whitescreens on unexpected errors. Also apply targeted `<ErrorBoundary>` boundaries around high-risk dynamic sections like `<CardVaultDisplay>`.

## 2. PocketBase Real-time Cleanup
Mandatory cleanup pattern inside all `useEffect` hooks initiating socket subscriptions:
