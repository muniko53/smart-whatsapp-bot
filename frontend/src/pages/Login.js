import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_THREAD = [
  { from: 'customer', text: 'Hi! Do you deliver to Westlands?' },
  { from: 'bot', text: 'Yes — delivery is Ksh 200 and takes about 40 minutes. Want me to place the order?' },
  { from: 'customer', text: 'Yes please!' },
];

const FEATURES = [
  { title: 'Instant AI replies', body: 'Every WhatsApp message answered in seconds, 24/7.' },
  { title: 'Automatic orders', body: 'Catalog, quantities, M-Pesa instructions — handled.' },
  { title: 'Live analytics', body: 'Revenue, orders and customers at a glance.' },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (user) navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
  }, [user, navigate]);

  const handleLogin = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--brand-strong)',
    }}>
      <div style={{
        display: 'flex', width: '100%', maxWidth: 880,
        borderRadius: 20, overflow: 'hidden', background: 'var(--surface)',
        boxShadow: 'var(--shadow-float)',
      }}>
        <div className="login-side" style={{
          flex: 1, background: 'var(--brand)', color: '#fff',
          padding: '44px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }} aria-hidden="true">
            {DEMO_THREAD.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: b.from === 'bot' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  background: b.from === 'bot' ? 'var(--accent)' : 'rgba(255,255,255,0.94)',
                  color: b.from === 'bot' ? '#fff' : 'var(--ink)',
                  borderRadius: b.from === 'bot' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding: '9px 13px', fontSize: 12.5, lineHeight: 1.5, maxWidth: 250,
                }}>
                  {b.text}
                </div>
              </div>
            ))}
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.25, marginBottom: 10, letterSpacing: '-0.5px' }}>
            Your AI sales rep, available 24/7
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.7, marginBottom: 28 }}>
            Automate WhatsApp replies, capture orders and grow your business — never miss a sale.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 12 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                  background: 'var(--accent)',
                }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          width: 340, background: 'var(--surface)', padding: '44px 36px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0,
        }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{
              width: 48, height: 48, background: 'var(--brand)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}>
              <svg viewBox="0 0 39 39" width="28" height="28" fill="none" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M19.5 0C8.73 0 0 8.73 0 19.5c0 3.44.9 6.67 2.48 9.46L0 39l10.34-2.44A19.42 19.42 0 0019.5 39C30.27 39 39 30.27 39 19.5S30.27 0 19.5 0z" fill="white" />
                <path fillRule="evenodd" clipRule="evenodd" d="M29.15 23.57c-.45-.22-2.64-1.3-3.05-1.45-.4-.15-.7-.22-.99.22-.3.45-1.15 1.45-1.4 1.74-.26.3-.52.33-.97.11-.45-.22-1.9-.7-3.62-2.23-1.34-1.19-2.24-2.66-2.5-3.11-.26-.45-.03-.69.2-.91.2-.2.45-.52.67-.78.22-.26.3-.45.45-.74.15-.3.07-.56-.04-.78-.1-.22-1-2.4-1.36-3.28-.36-.87-.72-.74-.99-.75h-.85c-.3 0-.78.11-1.18.56-.41.44-1.56 1.52-1.56 3.71s1.6 4.3 1.82 4.6c.22.29 3.14 4.8 7.61 6.73 1.06.46 1.89.73 2.53.93.06.02.12.04.18.05 1.05.3 2 .26 2.75.16.84-.12 2.59-1.06 2.95-2.08.37-1.03.37-1.9.26-2.09-.11-.18-.4-.29-.85-.51z" fill="#25D366" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px' }}>Welcome back</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sign in to your dashboard</p>
          </div>

          {error && (
            <div role="alert" style={{
              background: 'var(--bad-bg)', border: '1px solid #F0CFC9', borderRadius: 10,
              padding: '10px 13px', color: 'var(--bad)', fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label className="label" htmlFor="login-email">Email</label>
              <input id="login-email" className="input" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@business.co.ke" required autoComplete="email" />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label className="label" htmlFor="login-password">Password</label>
              <div style={{ position: 'relative' }}>
                <input id="login-password" className="input" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Your password" required autoComplete="current-password"
                  style={{ paddingRight: 64 }} />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--muted)',
                    fontSize: 13, fontWeight: 600, padding: '4px 8px',
                  }}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', padding: 13 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
              Contact your administrator if you need access.
            </p>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--faint)' }}>
            Smart WhatsApp Assistant · <Link to="/privacy" style={{ color: 'var(--brand)' }}>Privacy</Link> · <Link to="/terms" style={{ color: 'var(--brand)' }}>Terms</Link>
          </p>
        </div>
      </div>
      <style>{`@media (max-width: 760px) { .login-side { display: none !important; } }`}</style>
    </div>
  );
}
