import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { IconChat, IconCollapse } from '../../components/icons';
import api from '../../api';
import useIsMobile from '../../hooks/useIsMobile';

const initialOf = n => (n || '?').trim().charAt(0).toUpperCase();

export default function BusinessConversations() {
  const [convos, setConvos]       = useState([]);
  const [active, setActive]       = useState(null);
  const [messages, setMessages]   = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => { api.get('/business/conversations').then(r => setConvos(r.data)).catch(() => {}); }, []);

  const openConvo = async (c) => {
    setActive(c); setLoadingMsgs(true);
    try {
      const r = await api.get(`/business/conversations/${c.id}/messages`);
      setMessages(r.data);
    } finally { setLoadingMsgs(false); }
  };

  return (
    <Layout>
      <div className="page-head">
        <h1>Conversations</h1>
        <p>{convos.length} conversations</p>
      </div>

      <div style={{
        display: isMobile && active ? 'block' : 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '340px 1fr',
        gap: 16, height: isMobile ? 'auto' : 'calc(100vh - 190px)', minHeight: isMobile ? 480 : 0,
      }}>
        <div className="table-wrap" style={{
          display: isMobile && active ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>All chats</p>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {convos.length === 0 ? (
              <div className="empty">
                <p style={{ fontWeight: 600, color: 'var(--ink)' }}>No conversations yet</p>
                <p>Chats from WhatsApp will appear here.</p>
              </div>
            ) : convos.map(c => {
              const isActive = active?.id === c.id;
              return (
                <button key={c.id} onClick={() => openConvo(c)}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--line-soft)',
                    background: isActive ? 'var(--accent-soft)' : 'var(--surface)',
                    display: 'flex', gap: 12, alignItems: 'center',
                    transition: 'background 0.15s',
                  }}>
                  <span style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--brand)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 15,
                  }}>{initialOf(c.customer_number)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="num" style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>{c.customer_number}</span>
                    <span style={{
                      display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{c.last_message || 'No messages'}</span>
                  </span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>
                      {c.updated_at?.slice(0, 10)}
                    </span>
                    <span className="badge" style={{ marginTop: 4 }}>{c.msg_count}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="table-wrap" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!active ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface-soft)', color: 'var(--muted)', gap: 8, padding: 32,
            }}>
              <span style={{ color: 'var(--faint)', display: 'flex' }}><IconChat size={40} /></span>
              <p style={{ fontSize: 15, fontWeight: 500 }}>Select a conversation to view</p>
            </div>
          ) : (
            <>
              <div style={{
                padding: '12px 16px', background: 'var(--brand-strong)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                {isMobile && (
                  <button onClick={() => setActive(null)} aria-label="Back to chats"
                    style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', padding: 4 }}>
                    <span style={{ transform: 'scaleX(-1)', display: 'flex' }}><IconCollapse size={20} /></span>
                  </button>
                )}
                <span style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>{initialOf(active.customer_number)}</span>
                <div>
                  <p className="num" style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{active.customer_number}</p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{active.msg_count} messages</p>
                </div>
              </div>

              <div style={{
                flex: 1, overflowY: 'auto', padding: 20,
                background: '#EAE6DF', display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {loadingMsgs ? (
                  <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading messages…</p>
                ) : messages.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end' }}>
                    <div style={{
                      maxWidth: '72%', padding: '9px 13px',
                      borderRadius: m.role === 'user' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                      background: m.role === 'user' ? '#fff' : '#D9F2C7',
                      boxShadow: '0 1px 1px rgba(16,35,31,0.12)',
                    }}>
                      <p style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</p>
                      <p className="num" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>
                        {m.created_at?.slice(11, 16)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
