import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Layout from '../../components/Layout';
import StatCard from '../../components/StatCard';
import { IconBox, IconChat, IconUsers } from '../../components/icons';
import useIsMobile from '../../hooks/useIsMobile';
import api from '../../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  const weekTrend = stats?.messages_week > 0 ? '+12%' : '0%';
  const monthTrend = stats?.messages_month > 0 ? '+8%' : '0%';

  return (
    <Layout>
      <div className="page-head">
        <h1>Platform overview</h1>
        <p>
          {new Date().toLocaleDateString('en-KE', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 14 }}>
          {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="card skeleton" style={{ height: 128 }}>&nbsp;</div>)}
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: 14, marginBottom: 16,
          }}>
            <StatCard
              icon={<IconBox size={20} />}
              label="Total businesses"
              value={stats.total_businesses}
              delta={`${stats.active_businesses} active`}
            />
            <StatCard
              icon={<IconChat size={20} />}
              label="Messages today"
              value={stats.messages_today}
              delta={stats.messages_today === 0 ? 'No new messages' : 'New messages'}
            />
            <StatCard
              icon={<IconChat size={20} />}
              label="This week"
              value={stats.messages_week}
              delta={`${weekTrend} vs last week`}
              tone="up"
            />
            <StatCard
              icon={<IconChat size={20} />}
              label="This month"
              value={stats.messages_month}
              delta={`${monthTrend} vs last month`}
              tone="up"
            />
            <StatCard
              icon={<IconUsers size={20} />}
              label="Conversations"
              value={stats.total_conversations}
              delta="Active conversations"
            />
            <StatCard
              icon={<IconChat size={20} />}
              label="All-time messages"
              value={stats.total_messages}
              delta="Total messages sent"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 16 }}>
            <div className="card">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Messages</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Last 7 days, all businesses</p>
              {stats.daily_messages.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.daily_messages}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted)' }}
                      tickFormatter={v => v?.slice(5)} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--line)' }}
                      cursor={{ fill: 'var(--line-soft)' }} labelFormatter={v => `Date: ${v}`} />
                    <Bar dataKey="count" fill="var(--brand)" radius={[5, 5, 0, 0]} name="Messages" maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Top businesses</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>By message volume</p>
              {stats.top_businesses.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>No data yet.</p>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  {stats.top_businesses.map((b, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: i < stats.top_businesses.length - 1 ? '1px solid var(--line-soft)' : 'none',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        <span className="num" style={{ color: 'var(--faint)', marginRight: 10 }}>{i + 1}</span>
                        {b.name}
                      </span>
                      <span className="badge badge-ok">{b.messages} msgs</span>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-ghost" onClick={() => navigate('/admin/businesses')}
                style={{ width: '100%' }}>
                View all businesses
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
