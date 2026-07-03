import React, { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// ─── Brand marks ──────────────────────────────────────────────────────────────
// Inlined as SVGs: lucide dropped brand icons, and the coloured Google/Facebook
// marks aren't in any icon set. GitHub stays monochrome (currentColor) so it
// adapts to light/dark; Google and Facebook use their fixed brand colours.
const GithubIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const GoogleIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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
const OAUTH_PROVIDERS = [
  { key: 'google',   label: 'Continue with Google',   Icon: GoogleIcon },
  { key: 'github',   label: 'Continue with GitHub',   Icon: GithubIcon },
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
