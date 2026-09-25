import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Layout from '../../components/Layout';
import StatCard from '../../components/StatCard';
import { IconBox, IconChat, IconUsers, IconClock, IconAlert } from '../../components/icons';
import { supportLine } from '../../config';
import api from '../../api';
import useIsMobile from '../../hooks/useIsMobile';

const ksh = n => `Ksh ${(n || 0).toLocaleString('en-KE')}`;

export default function BusinessDashboard() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const isMobile = useIsMobile();

  const load = () => api.get('/business/stats')
    .then(r => setStats(r.data))
    .catch(() => setError(true))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const toggleBot = async () => { await api.put('/business/bot/toggle'); load(); };
  const retry = () => { setError(false); setLoading(true); load(); };

  const subBanner = () => {
    if (!stats) return null;
    const status = stats.subscription_status;
    const exp    = stats.trial_expires_at;
    if (status === 'suspended') return {
      tone: 'bad', title: 'Bot service suspended',
      body: `Your account has been suspended. ${supportLine('Contact us on WhatsApp')} to restore access.`,
    };
    if (status === 'trial' && exp) {
      const days = Math.ceil((new Date(exp) - new Date()) / 86400000);
      if (days < 0) return {
        tone: 'bad', title: 'Free trial expired',
        body: `Your trial has ended. ${supportLine('Contact us on WhatsApp')} to continue using the bot.`,
      };
      if (days <= 7) return {
        tone: 'warn', title: `Free trial ends in ${days} day${days === 1 ? '' : 's'}`,
        body: `${supportLine('Reach out on WhatsApp')} to subscribe and keep your bot running.`,
      };
    }
    return null;
  };

  const banner = subBanner();

  return (
    <Layout>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 2 }}>
              {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <h1>{stats?.business_name ? `Welcome back, ${stats.business_name}` : 'My Dashboard'}</h1>
            <p>How your bot is performing today.</p>
          </div>
          {stats && (
            <button onClick={toggleBot} aria-pressed={!!stats.bot_enabled}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 999, padding: '8px 8px 8px 16px',
                fontSize: 13, fontWeight: 600, color: 'var(--ink)',
              }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: stats.bot_enabled ? 'var(--accent)' : 'var(--faint)',
              }} />
              Bot {stats.bot_enabled ? 'on' : 'off'}
              <span style={{
                width: 40, height: 22, borderRadius: 11, position: 'relative',
                background: stats.bot_enabled ? 'var(--brand)' : '#C4CFCB',
                transition: 'background 0.15s',
              }}>
                <span style={{
                  position: 'absolute', top: 3, left: stats.bot_enabled ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.15s',
                }} />
              </span>
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="card empty">
          <p style={{ fontWeight: 600, color: 'var(--ink)' }}>Could not load dashboard.</p>
          <p>Make sure the server is running, then <button onClick={retry}
            style={{ color: 'var(--brand)', background: 'none', border: 'none', fontWeight: 600, fontSize: 13 }}>
            try again</button>.</p>
        </div>
      ) : loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14 }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="card skeleton" style={{ height: 128 }}>&nbsp;</div>)}
        </div>
      ) : (
        <>
          {banner && (
            <div className="card"
              style={{
                display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start',
                background: banner.tone === 'bad' ? 'var(--bad-bg)' : 'var(--warn-bg)',
                borderColor: banner.tone === 'bad' ? '#F0CFC9' : '#F0DFAE',
              }}>
              <span style={{ color: banner.tone === 'bad' ? 'var(--bad)' : 'var(--warn)', display: 'flex' }}>
                <IconAlert size={20} />
              </span>
              <div>
                <p style={{ fontWeight: 700, marginBottom: 2 }}>{banner.title}</p>
                <p style={{ fontSize: 13 }}>{banner.body}</p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
            <StatCard icon={<IconBox size={20} />} label="Orders today" value={stats.orders_today} />
            <StatCard icon={<IconBox size={20} />} label="Total orders" value={stats.total_orders} />
            <StatCard icon={<IconBox size={20} />} label="Revenue today" value={ksh(stats.revenue_today)} />
            <StatCard icon={<IconBox size={20} />} label="Revenue this month" value={ksh(stats.revenue_month)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <StatCard icon={<IconChat size={20} />} label="Messages today" value={stats.messages_today} />
            <StatCard icon={<IconChat size={20} />} label="Conversations" value={stats.total_conversations} />
            <StatCard icon={<IconUsers size={20} />} label="New customers (30d)"
              value={stats.new_customers_month}
              delta={`${stats.new_customers_prev ?? 0} previous period`}
              tone={(stats.new_customers_month ?? 0) >= (stats.new_customers_prev ?? 0) ? 'up' : 'down'} />
            <StatCard icon={<IconUsers size={20} />} label="Conversion rate"
              value={`${stats.conversion_rate ?? 0}%`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="card">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Messages</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Last 7 days</p>
              {stats.daily_messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 13 }}>No messages yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={stats.daily_messages}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={v => v?.slice(5)} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--line)' }} />
                    <Line type="monotone" dataKey="count" stroke="var(--brand)" strokeWidth={2.5}
                      dot={false} activeDot={{ r: 4 }} name="Messages" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Orders</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Last 7 days</p>
              {(stats.daily_orders || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 13 }}>No orders yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.daily_orders}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={v => v?.slice(5)} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--line)' }} cursor={{ fill: 'var(--line-soft)' }} />
                    <Bar dataKey="count" fill="var(--brand)" radius={[5, 5, 0, 0]} name="Orders" maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {(stats.top_products || []).length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Top products</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>By order count</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stats.top_products.map((p, i) => {
                  const max = stats.top_products[0].count;
                  const pct = Math.round((p.count / max) * 100);
                  return (
                    <div key={p.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                          <span style={{ color: 'var(--faint)', marginRight: 8 }}>{i + 1}</span>{p.name}
                        </span>
                        <span className="num" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{p.count} orders</span>
                      </div>
                      <div style={{ background: 'var(--line-soft)', borderRadius: 999, height: 6 }}>
                        <div style={{ background: 'var(--brand)', borderRadius: 999, height: 6, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!stats.bot_enabled && (
            <div className="card" style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              background: 'var(--warn-bg)', borderColor: '#F0DFAE',
            }}>
              <span style={{ color: 'var(--warn)', display: 'flex' }}><IconClock size={20} /></span>
              <div>
                <p style={{ fontWeight: 600 }}>Bot is currently off</p>
                <p style={{ fontSize: 13 }}>Customers won't receive automated replies. Toggle the bot above to re-enable.</p>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
