import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';

export default function BusinessCustomers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch]       = useState('');
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(false);

  const load = () => api.get('/business/customers')
    .then(r => setCustomers(r.data))
    .catch(() => setError(true));
  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c =>
    !search || (c.name || c.phone).toLowerCase().includes(search.toLowerCase())
  );

  const saveName = async () => {
    if (!editing) return;
    setSaving(true);
    await api.put(`/business/customers/${editing.id}`, { name: editing.name });
    await load();
    setEditing(null);
    setSaving(false);
  };

  if (error) return (
    <Layout>
      <div className="card empty">
        <p style={{ fontWeight: 600, color: 'var(--ink)' }}>Could not load customers.</p>
        <p>Make sure the server is running, then <button onClick={() => { setError(false); load(); }}
          style={{ color: 'var(--brand)', background: 'none', border: 'none', fontWeight: 600, fontSize: 13 }}>
          try again</button>.</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="page-head">
        <h1>Customers</h1>
        <p>{customers.length} total customers</p>
      </div>

      <div style={{ marginBottom: 16, maxWidth: 420 }}>
        <input className="input" placeholder="Search by name or phone…"
          value={search} onChange={e => setSearch(e.target.value)}
          aria-label="Search customers" />
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty">
            <p style={{ fontWeight: 600, color: 'var(--ink)' }}>
              {search ? 'No matches' : 'No customers yet'}
            </p>
            <p>{search ? 'Try a different search.' : 'Customers who message you will appear here.'}</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Visits</th><th>Last seen</th><th><span style={{ display: 'none' }}>Actions</span></th></tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    {editing?.id === c.id ? (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <input className="input" value={editing.name} autoFocus
                          onChange={e => setEditing({ ...editing, name: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && saveName()}
                          style={{ padding: '6px 10px', fontSize: 13, width: 150 }} />
                        <button className="btn btn-primary" onClick={saveName} disabled={saving}
                          style={{ padding: '6px 12px', fontSize: 12 }}>
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button className="btn btn-ghost" onClick={() => setEditing(null)}
                          style={{ padding: '6px 10px', fontSize: 12 }}>Cancel</button>
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--accent-soft)', color: 'var(--brand)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 700,
                        }}>
                          {(c.name || c.phone || '?')[0].toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {c.name || <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontWeight: 400 }}>No name</span>}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="num" style={{ color: 'var(--muted)' }}>{c.phone}</td>
                  <td><span className={`badge ${c.visit_count >= 5 ? 'badge-ok' : ''}`}>{c.visit_count || 1}</span></td>
                  <td className="num" style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {c.last_seen ? c.last_seen.slice(0, 16).replace('T', ' ') : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editing?.id !== c.id && (
                      <button className="btn btn-ghost"
                        onClick={() => setEditing({ id: c.id, name: c.name || '' })}
                        style={{ padding: '6px 12px', fontSize: 12 }}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
