import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';

export default function AdminEscalations() {
  const [escalations, setEscalations] = useState([]);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState('all'); // all | open | resolved
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  useEffect(() => {
    api.get('/admin/escalations')
      .then(r => setEscalations(r.data))
      .catch(() => setError('Could not load escalations. Make sure the server is running.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = escalations
    .filter(e => filter === 'all' || (filter === 'resolved' ? e.resolved : !e.resolved))
    .filter(e => !search || (e.customer_number||e.business_name||e.reason||'').toLowerCase().includes(search.toLowerCase()));

  const openCount     = escalations.filter(e => !e.resolved).length;
  const resolvedCount = escalations.filter(e =>  e.resolved).length;

  return (
    <Layout>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'var(--ink)' }}>Escalations</h1>
        <p style={{ color:'var(--muted)', fontSize:13, marginTop:4 }}>{escalations.length} total · {openCount} open</p>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Total',    value:escalations.length, bg:'var(--line-soft)',  color:'var(--ink)' },
          { label:'Open',     value:openCount,          bg:'#FFE5E5',  color:'#CC0000' },
          { label:'Resolved', value:resolvedCount,      bg:'var(--accent-soft)',  color:'var(--brand)' },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:12, padding:'16px 20px' }}>
            <p style={{ fontSize:26, fontWeight:700, color:c.color }}>{c.value}</p>
            <p style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { key:'all',      label:`All (${escalations.length})` },
          { key:'open',     label:`Open (${openCount})` },
          { key:'resolved', label:`Resolved (${resolvedCount})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding:'7px 14px', borderRadius:999, border:'1.5px solid',
              borderColor: filter===f.key ? 'var(--accent)' : 'var(--line)',
              background: filter===f.key ? 'var(--accent-soft)' : 'white',
              color: filter===f.key ? 'var(--brand)' : 'var(--muted)',
              fontSize:12, fontWeight: filter===f.key ? 600 : 400, cursor:'pointer',
            }}>{f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom:16 }}>
        <input
          placeholder="Search by customer, business, or reason…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width:'100%', padding:'10px 16px', borderRadius:12, border:'1.5px solid var(--line)', fontSize:13, outline:'none', boxSizing:'border-box' }}
        />
      </div>

      {/* List */}
      <div style={{ background:'white', borderRadius:16, overflow:'hidden', border:'1px solid var(--line)' }}>
        {error ? (
          <div style={{ padding:40, textAlign:'center', color:'#CC0000' }}>⚠️ {error}</div>
        ) : loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:60, textAlign:'center', color:'var(--muted)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
            <p>No escalations found</p>
          </div>
        ) : filtered.map((e, i) => (
          <div key={e.id} style={{ padding:'16px 20px', borderBottom:'1px solid var(--line-soft)', background: i%2===0?'white':'#FAFAFA' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{
                    padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700,
                    background: e.resolved ? 'var(--accent-soft)' : '#FFE5E5',
                    color: e.resolved ? 'var(--brand)' : '#CC0000',
                  }}>{e.resolved ? 'RESOLVED' : 'OPEN'}</span>
                  <span style={{ padding:'3px 9px', borderRadius:999, background:'#E3F2FD', color:'#0D47A1', fontSize:11, fontWeight:600 }}>
                    {e.business_name||'—'}
                  </span>
                </div>
                <p style={{ fontSize:14, fontWeight:600, color:'var(--ink)', marginBottom:2 }}>{e.customer_number}</p>
                <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.5 }}>{e.reason || 'No reason provided'}</p>
              </div>
              <p style={{ fontSize:11, color:'var(--muted)', flexShrink:0 }}>{e.created_at?.slice(0,16)}</p>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
