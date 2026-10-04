import React, { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// ─── Brand marks ──────────────────────────────────────────────────────────────
// Inlined as SVGs: lucide dropped brand icons, and the coloured Google/Facebook
// marks aren't in any icon set. Apple stays monochrome (currentColor) so it
// adapts to light/dark (Apple's mark is monochrome too); Google and Facebook use their fixed brand colours.
const GoogleIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const AppleIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
  </svg>
);

const FacebookIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="#1877F2" className={className} aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

// Social providers to surface. Each key must match a provider enabled in the
// Supabase dashboard (Auth → Providers); a button for a disabled provider will
// error on click. To add/remove one, edit this list.
// Collectors sign in with Google, Apple (iPhone) and Facebook. GitHub was an
// odd fit for a card marketplace and is gone; enable Apple in Supabase →
// Auth → Providers (needs an Apple Developer account + Services ID) before
// this button will work — see docs/oauth-login.md.
const OAUTH_PROVIDERS = [
  { key: 'google',   label: 'Continue with Google',   Icon: GoogleIcon },
  { key: 'apple',    label: 'Continue with Apple',    Icon: AppleIcon },
  { key: 'facebook', label: 'Continue with Facebook', Icon: FacebookIcon },
];

/**
 * Renders an "or continue with" divider and a button per OAuth provider.
 * On click it kicks off Supabase's OAuth redirect flow; the session is picked
 * up automatically on return (supabaseClient has detectSessionInUrl: true).
 *
 * @param {string}  redirectTo   Absolute URL to return to after auth. Must be in
 *                               the Supabase Auth "Redirect URLs" allow-list.
 * @param {boolean} disabled     Disable the buttons (e.g. while a parent form submits).
 * @param {string}  dividerLabel Text shown in the divider.
 */
const OAuthButtons = ({ redirectTo, disabled = false, dividerLabel = 'Or continue with' }) => {
  const [oauthLoading, setOauthLoading] = useState(null);

  const handleOAuthLogin = async (provider) => {
    setOauthLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo || `${window.location.origin}/account` },
      });
      if (error) throw error;
      // On success the browser redirects to the provider, so nothing else runs.
    } catch (error) {
      setOauthLoading(null);
      toast.error(error.message || `Could not sign in with ${provider}. Please try again.`);
    }
  };

  if (OAUTH_PROVIDERS.length === 0) return null;

  return (
    <div className="w-full space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{dividerLabel}</span>
        </div>
      </div>
      {OAUTH_PROVIDERS.map(({ key, label, Icon }) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          className="w-full font-semibold h-12 text-base rounded-xl"
          onClick={() => handleOAuthLogin(key)}
          disabled={disabled || oauthLoading !== null}
        >
          {oauthLoading === key ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <><Icon className="w-5 h-5 mr-2" /> {label}</>
          )}
        </Button>
      ))}
    </div>
  );
};

export default OAuthButtons;
