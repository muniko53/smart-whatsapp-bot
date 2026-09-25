// Privacy-friendly analytics (Plausible). Inert unless configured:
// set REACT_APP_PLAUSIBLE_DOMAIN=yourdomain in frontend/.env to enable.
// No cookies, no cross-site tracking; respects the cookie-consent choice
// (pageviews only fire after Accept).
const DOMAIN = process.env.REACT_APP_PLAUSIBLE_DOMAIN || '';

function consent() {
  try { return localStorage.getItem('wa_cookie_consent'); } catch { return null; }
}

function send(event, props) {
  if (!DOMAIN || consent() !== 'accepted') return;
  try {
    const body = {
      name: event,
      url: window.location.href,
      domain: DOMAIN,
      props: props || {},
    };
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        'https://plausible.io/api/event',
        new Blob([JSON.stringify(body)], { type: 'text/event-stream' })
      );
    }
  } catch { /* analytics must never break the app */ }
}

export const trackPageview = () => send('pageview');
export const trackEvent = (name, props) => send(name, props);
export const analyticsEnabled = () => Boolean(DOMAIN);
