import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  const home = user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/login';
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', textAlign: 'center', padding: '48px 32px' }}>
        <p className="num" style={{ fontSize: 56, fontWeight: 800, color: 'var(--brand)', lineHeight: 1 }}>404</p>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '12px 0 8px' }}>Page not found</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>
          The page moved, or the link has a typo. Your data is safe.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>Go back</button>
          <Link className="btn btn-primary" to={home} style={{ textDecoration: 'none' }}>
            {user ? 'Go to dashboard' : 'Go to sign in'}
          </Link>
        </div>
      </div>
    </div>
  );
}
