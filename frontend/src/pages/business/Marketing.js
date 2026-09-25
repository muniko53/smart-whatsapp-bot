import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import useIsMobile from '../../hooks/useIsMobile';
import api from '../../api';

const SEGMENTS = [
  { value: 'all',    label: 'All customers',       desc: 'Everyone who has ever messaged you' },
  { value: 'recent', label: 'Active (last 30 days)', desc: 'Customers seen in the past month' },
  { value: 'repeat', label: 'Repeat customers',      desc: 'Customers who messaged 2+ times' },
];

const TEMPLATES = [
  { label: 'Flash Sale',      text: '🔥 *Flash Sale — Today Only!*\n\nGet 20% off everything in our store!\n\nReply *1* to browse our products now. 🛍️' },
  { label: 'New Products',    text: '✨ *New Arrivals!*\n\nWe just added exciting new products to our catalog!\n\nReply *1* to see what\'s new. 👀' },
  { label: 'Come Back',       text: '👋 We miss you!\n\nIt\'s been a while. Come check out what we have in store for you.\n\nReply *1* to browse our menu. 😊' },
  { label: 'Weekend Special', text: '🎉 *Weekend Special!*\n\nEnjoy exclusive weekend deals from us.\n\nReply *1* to order now before they run out! ⏰' },
];

export default function Marketing() {
  const [segment, setSegment]     = useState('all');
  const [message, setMessage]     = useState('');
  const [sending, setSending]     = useState(false);
  const [result, setResult]       = useState(null);
  const [customerCount, setCount] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    api.get('/business/customers').then(r => setCount(r.data.length)).catch(() => {});
  }, []);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const r = await api.post('/business/marketing/broadcast', { message, segment });
      setResult(r.data);
    } catch {
      setResult({ error: 'Failed to send. Make sure WhatsApp credentials are configured in your profile.' });
    }
    setSending(false);
  };

  return (
    <Layout narrow>
      <div className="page-head">
        <h1>Marketing</h1>
        <p>Send broadcast messages to your customers via WhatsApp.</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>1. Choose audience</p>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          {customerCount !== null ? `${customerCount} customers in database` : 'Loading audience…'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SEGMENTS.map(s => {
            const selected = segment === s.value;
            return (
              <label key={s.value} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                borderRadius: 'var(--radius-sm)', border: '1px solid',
                borderColor: selected ? 'var(--brand)' : 'var(--line)',
                background: selected ? 'var(--accent-soft)' : 'var(--surface)',
                cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
              }}>
                <input type="radio" name="segment" value={s.value}
                  checked={selected} onChange={() => setSegment(s.value)}
                  style={{ accentColor: 'var(--brand)', marginTop: 3 }} />
                <span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{s.label}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>{s.desc}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>2. Write your message</p>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          Supports WhatsApp formatting: *bold*, _italic_
        </p>
        <textarea className="input" value={message}
          onChange={e => setMessage(e.target.value.slice(0, 1000))}
          placeholder="Type your message here…"
          rows={6} />
        <p className="num" style={{
          fontSize: 12, color: message.length > 900 ? 'var(--bad)' : 'var(--muted)',
          marginTop: 6, textAlign: 'right',
        }}>
          {message.length}/1000
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {TEMPLATES.map(t => (
            <button key={t.label} onClick={() => setMessage(t.text)}
              className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" onClick={send}
        disabled={sending || !message.trim()}
        style={{ width: '100%', padding: 13, fontSize: 15, marginBottom: 16 }}>
        {sending ? 'Sending…' : `Send broadcast${segment !== 'all' ? ` (${segment})` : ''}`}
      </button>

      {result && (
        <div className="card" style={{
          marginBottom: 16,
          background: result.error ? 'var(--bad-bg)' : 'var(--ok-bg)',
          borderColor: result.error ? '#F0CFC9' : '#BFE3CE',
        }}>
          {result.error ? (
            <p style={{ color: 'var(--bad)', fontSize: 13 }}>{result.error}</p>
          ) : (
            <>
              <p style={{ fontWeight: 700, color: 'var(--ok)', marginBottom: 4 }}>Broadcast sent</p>
              <p className="num" style={{ fontSize: 13 }}>
                Sent <strong>{result.sent}</strong> · Failed <strong>{result.failed}</strong> · Total <strong>{result.total}</strong>
              </p>
            </>
          )}
        </div>
      )}

      <div className="card" style={{ background: 'var(--warn-bg)', borderColor: '#F0DFAE' }}>
        <p style={{ fontWeight: 600, color: 'var(--warn)', marginBottom: 8 }}>WhatsApp rules</p>
        <ul style={{ fontSize: 13, color: 'var(--warn)', paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
          <li>You can only message customers who have messaged you first</li>
          <li>Messages must go out within 24h of their last message</li>
          <li>Avoid spammy content — WhatsApp may flag your number</li>
          <li>Keep messages relevant and valuable</li>
        </ul>
      </div>
      {!isMobile && <div style={{ height: 8 }} />}
    </Layout>
  );
}
