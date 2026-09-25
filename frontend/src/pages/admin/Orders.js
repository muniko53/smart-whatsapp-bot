import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';

const STATUS_COLORS = {
  pending:   { bg:'#FFF3CD', color:'#856404' },
  confirmed: { bg:'var(--accent-soft)', color:'var(--brand)' },
  preparing: { bg:'#E3F2FD', color:'#0D47A1' },
  ready:     { bg:'#E8F5E9', color:'#2E7D32' },
  delivered: { bg:'#F3E5F5', color:'#6A1B9A' },
  cancelled: { bg:'#FFE5E5', color:'#CC0000' },
};

export default function AdminOrders() {
  const [orders, setOrders]   = useState([]);
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get('/admin/orders')
      .then(r => setOrders(r.data))
      .catch(() => setError('Could not load orders. Make sure the server is running.'))
      .finally(() => setLoading(false));
  }, []);

  const statusBadge = (s) => (
    <span style={{
      padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:600,
      background:(STATUS_COLORS[s]||{}).bg||'var(--line-soft)',
      color:(STATUS_COLORS[s]||{}).color||'var(--muted)',
    }}>{s?.toUpperCase()}</span>
  );

  const filtered = orders
    .filter(o => filter === 'all' || o.status === filter)
    .filter(o => !search || (o.customer_name||o.customer_number||o.business_name||'').toLowerCase().includes(search.toLowerCase()));

  const counts = {};
  orders.forEach(o => { counts[o.status] = (counts[o.status]||0)+1; });

  return (
    <Layout>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'var(--ink)' }}>All Orders</h1>
        <p style={{ color:'var(--muted)', fontSize:13, marginTop:4 }}>{orders.length} total across all businesses</p>
      </div>

      {/* Summary chips */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {['all','pending','confirmed','preparing','ready','delivered','cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding:'7px 14px', borderRadius:999, border:'1.5px solid',
              borderColor: filter===f ? 'var(--accent)' : 'var(--line)',
              background: filter===f ? 'var(--accent-soft)' : 'white',
              color: filter===f ? 'var(--brand)' : 'var(--muted)',
              fontSize:12, fontWeight: filter===f ? 600 : 400,
              cursor:'pointer', textTransform:'capitalize',
            }}>
            {f === 'all' ? `All (${orders.length})` : `${f} (${counts[f]||0})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom:16 }}>
        <input
          placeholder="Search by customer, phone, or business…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width:'100%', padding:'10px 16px', borderRadius:12, border:'1.5px solid var(--line)', fontSize:13, outline:'none', boxSizing:'border-box' }}
        />
      </div>

      {/* Table */}
      <div style={{ background:'white', borderRadius:16, overflow:'hidden', border:'1px solid var(--line)' }}>
        {error ? (
          <div style={{ padding:40, textAlign:'center', color:'#CC0000' }}>⚠️ {error}</div>
        ) : loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:60, textAlign:'center', color:'var(--muted)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🛍️</div>
            <p>No orders found</p>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--line-soft)' }}>
                  {['#','Business','Customer','Phone','Items','Status','Date'].map(h => (
                    <th key={h} style={{ padding:'12px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => (
                  <tr key={o.id} style={{ borderBottom:'1px solid var(--line-soft)', background: i%2===0?'white':'#FAFAFA' }}>
                    <td style={{ padding:'12px 14px', fontSize:13, fontWeight:700, color:'var(--ink)' }}>#{o.id}</td>
                    <td style={{ padding:'12px 14px' }}>
                      <span style={{ padding:'3px 9px', borderRadius:999, background:'#E3F2FD', color:'#0D47A1', fontSize:11, fontWeight:600 }}>
                        {o.business_name||'—'}
                      </span>
                    </td>
                    <td style={{ padding:'12px 14px', fontSize:13, color:'var(--ink)', fontWeight:500 }}>{o.customer_name||'—'}</td>
                    <td style={{ padding:'12px 14px', fontSize:12, color:'var(--muted)' }}>{o.customer_number}</td>
                    <td style={{ padding:'12px 14px', fontSize:12, color:'var(--muted)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.items}</td>
                    <td style={{ padding:'12px 14px' }}>{statusBadge(o.status)}</td>
                    <td style={{ padding:'12px 14px', fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>{o.created_at?.slice(0,16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
