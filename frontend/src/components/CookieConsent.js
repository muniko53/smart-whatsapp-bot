import React, { useEffect, useState } from 'react';

const KEY = 'wa_cookie_consent';

export function getConsent() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

// Best-effort removal of the server-set refresh cookie (works same-origin;
// cross-domain cookies can only be retired server-side on next sign-in).
export function clearRefreshCookie() {
  try {
    document.cookie = 'refresh_token=; Max-Age=0; path=/';
  } catch { /* ignore */ }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const analyticsOn = Boolean(process.env.REACT_APP_PLAUSIBLE_DOMAIN);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  const choose = (value) => {
    try { localStorage.setItem(KEY, value); } catch { /* ignore */ }
    if (value === 'declined') clearRefreshCookie();
    setVisible(false);
  };

  return (
    <div role="dialog" aria-live="polite" aria-label="Cookie consent"
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 9990,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}>
      <div className="card" style={{
        pointerEvents: 'auto', maxWidth: 560, width: '100%',
        padding: '16px 18px', boxShadow: 'var(--shadow-float)',
        display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Cookies, minus the creepiness</p>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            We use one essential cookie to keep you signed in (refresh token, 7 days)
            plus temporary session storage that clears when you close the tab.
            {analyticsOn
              ? ' We also count anonymous page visits (no cookies, no personal data). No ads, no trackers.'
              : ' No analytics, no tracking, no ads.'} See our <a href="/privacy"
            style={{ color: 'var(--brand)', fontWeight: 600 }}>privacy policy</a>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-ghost" onClick={() => choose('declined')}
            style={{ padding: '9px 16px', fontSize: 13 }} title="Session-only sign-in">
            Session only
          </button>
          <button className="btn btn-primary" onClick={() => choose('accepted')}
            style={{ padding: '9px 16px', fontSize: 13 }} autoFocus>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
