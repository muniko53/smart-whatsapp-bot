import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { IconCheck, IconX } from '../../components/icons';
import useIsMobile from '../../hooks/useIsMobile';
import api from '../../api';

const STATUS_TONE = {
  pending: 'badge-warn',
  confirmed: 'badge-ok',
  preparing: 'badge-info',
  ready: 'badge-ok',
  paid: 'badge-info',
  delivered: 'badge-ok',
  cancelled: 'badge-bad',
};

const FILTERS = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'paid', 'delivered', 'cancelled'];

export default function BusinessOrders() {
  const [orders, setOrders]     = useState([]);
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [eta, setEta]           = useState('');
  const isMobile = useIsMobile();

  const load = () => api.get('/business/orders').then(r => setOrders(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const countFor = f => f === 'all' ? orders.length : orders.filter(o => o.status === f).length;

  const updateStatus = async (id, status) => {
    setSaving(true);
    const order = orders.find(o => o.id === id);
    await api.put(`/business/orders/${id}`, { ...order, status, eta });
    await load();
    setSelected(s => s?.id === id ? { ...s, status, eta } : s);
    setSaving(false);
  };

  const verifyPayment = async (id) => {
    setSaving(true);
    await api.put(`/business/orders/${id}/verify`);
    await load();
    setSelected(s => s?.id === id ? { ...s, payment_verified: 1 } : s);
    setSaving(false);
  };

  const statusBadge = s => (
    <span className={`badge ${STATUS_TONE[s] || ''}`}>{s || 'unknown'}</span>
  );

  const payLabel = o => o.payment_method === 'cash_on_delivery' ? 'Cash on delivery' : 'M-Pesa';

  return (
    <Layout>
      <div className="page-head">
        <h1>Orders</h1>
        <p>{orders.length} total orders</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            style={{
              padding: '7px 14px', borderRadius: 999, border: '1px solid',
              borderColor: filter === f ? 'var(--brand)' : 'var(--line)',
              background: filter === f ? 'var(--brand)' : 'var(--surface)',
              color: filter === f ? '#fff' : 'var(--muted)',
              fontSize: 13, fontWeight: filter === f ? 600 : 400,
              transition: 'background 0.15s',
            }}>
            {f === 'all' ? `All (${countFor(f)})` : `${f} (${countFor(f)})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected && !isMobile ? '1fr 360px' : '1fr', gap: 16, alignItems: 'start' }}>
        {filtered.length === 0 ? (
          <div className="card empty">
            <p style={{ fontWeight: 600, color: 'var(--ink)' }}>No orders yet</p>
            <p>New orders from WhatsApp will appear here.</p>
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(o => (
              <button key={o.id} onClick={() => { setSelected(o); setEta(o.eta || ''); }}
                style={{
                  textAlign: 'left', background: 'var(--surface)',
                  border: '1px solid', borderColor: selected?.id === o.id ? 'var(--brand)' : 'var(--line)',
                  borderRadius: 'var(--radius)', padding: '14px 16px',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="num" style={{ fontWeight: 700, fontSize: 14 }}>#{o.id}</span>
                  {statusBadge(o.status)}
                </div>
                <p style={{ fontSize: 14, fontWeight: 500 }}>{o.customer_name || o.customer_number}</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.items}</p>
                <p className="num" style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{o.total}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th><th>Customer</th><th>Items</th>
                  <th>Total</th><th>Payment</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} onClick={() => { setSelected(o); setEta(o.eta || ''); }}
                    style={{
                      cursor: 'pointer',
                      background: selected?.id === o.id ? 'var(--accent-soft)' : undefined,
                    }}>
                    <td className="num" style={{ fontWeight: 700 }}>
                      #{o.id}
                      <div style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}>
                        {o.created_at?.slice(0, 16).replace('T', ' ')}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.customer_name || '—'}</div>
                      <div className="num" style={{ fontSize: 12, color: 'var(--muted)' }}>{o.customer_number}</div>
                    </td>
                    <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.items}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{o.total}</td>
                    <td style={{ color: 'var(--muted)' }}>{payLabel(o)}</td>
                    <td>{statusBadge(o.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <div className="card" style={{ padding: 20, position: isMobile ? 'static' : 'sticky', top: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="num" style={{ fontSize: 16, fontWeight: 700 }}>Order #{selected.id}</h2>
              <button onClick={() => setSelected(null)} aria-label="Close details"
                style={{ background: 'none', border: 'none', color: 'var(--muted)', display: 'flex', padding: 4 }}>
                <IconX size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              {[
                { label: 'Customer', value: selected.customer_name || '—' },
                { label: 'Phone', value: selected.customer_number },
                { label: 'Items', value: selected.items },
                { label: 'Total', value: selected.total || '—' },
                selected.delivery_type ? { label: 'Delivery', value: selected.delivery_type } : null,
                selected.booking_date ? { label: 'Booking', value: selected.booking_date } : null,
                (() => { try { const e = JSON.parse(selected.extras || '{}'); return e.size ? { label: 'Size', value: e.size } : null; } catch { return null; } })(),
                (() => { try { const e = JSON.parse(selected.extras || '{}'); return e.color ? { label: 'Color', value: e.color } : null; } catch { return null; } })(),
                { label: 'Payment', value: payLabel(selected) },
                selected.eta ? { label: 'ETA', value: selected.eta } : null,
                { label: 'Date', value: selected.created_at?.slice(0, 16).replace('T', ' ') },
              ].filter(Boolean).map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {selected.mpesa_code ? (
              <div style={{
                marginBottom: 16, padding: 14, borderRadius: 'var(--radius-sm)',
                background: selected.payment_verified ? 'var(--ok-bg)' : 'var(--warn-bg)',
                border: '1px solid var(--line)',
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>M-Pesa payment</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <p className="num" style={{ fontWeight: 700, letterSpacing: 1 }}>{selected.mpesa_code}</p>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Transaction code</p>
                  </div>
                  {selected.payment_verified ? (
                    <span className="badge badge-ok"><IconCheck size={14} /> Verified</span>
                  ) : (
                    <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 12 }}
                      onClick={() => verifyPayment(selected.id)} disabled={saving}>
                      Mark verified
                    </button>
                  )}
                </div>
                {!selected.payment_verified && (
                  <p style={{ fontSize: 12, color: 'var(--warn)', marginTop: 8 }}>
                    Check your M-Pesa statement for this code before verifying.
                  </p>
                )}
              </div>
            ) : selected.status === 'paid' ? (
              <div style={{ marginBottom: 16, padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--warn-bg)', border: '1px solid var(--line)' }}>
                <p style={{ fontSize: 12, color: 'var(--warn)' }}>Customer marked as paid but gave no transaction code.</p>
              </div>
            ) : null}

            <div style={{ marginBottom: 4 }}>
              <label className="label" htmlFor="order-eta">Update status</label>
              <input id="order-eta" className="input" value={eta}
                onChange={e => setEta(e.target.value)}
                placeholder="ETA (optional) e.g. Today 5pm, 30 mins"
                style={{ marginBottom: 10 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {['confirmed', 'preparing', 'ready', 'delivered', 'cancelled'].map(s => {
                  const active = selected.status === s;
                  return (
                    <button key={s} disabled={saving || active}
                      onClick={() => updateStatus(selected.id, s)}
                      className={active ? 'btn btn-primary' : 'btn btn-ghost'}
                      style={{ padding: '9px 0', fontSize: 13, textTransform: 'capitalize', opacity: active ? 1 : undefined }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
