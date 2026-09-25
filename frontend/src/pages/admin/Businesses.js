import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api';

const EMPTY = {
  name:'', type:'', location:'', hours:'', phone:'', owner_number:'',
  email:'', password:'', whatsapp_token:'', phone_number_id:'',
  paybill:'', till_number:'',
};

const BIZ_TYPES = [
  { value:'Restaurant',        label:'🍽️  Restaurant / Food' },
  { value:'Clothing Store',    label:'👗  Clothing / Fashion' },
  { value:'Electronics Shop',  label:'📱  Electronics / Tech' },
  { value:'Service Provider',  label:'⚡  Service Provider' },
  { value:'Retail Shop',       label:'🛒  Retail Shop' },
  { value:'Other',             label:'📦  Other' },
];

const inp = {
  width:'100%', padding:'10px 14px', borderRadius:8, fontSize:13,
  border:'1.5px solid var(--line)', background:'var(--line-soft)', color:'var(--ink)', boxSizing:'border-box',
};

const SectionLabel = ({ children }) => (
  <p style={{ fontSize:11, fontWeight:700, color:'var(--muted)', margin:'0 0 10px', textTransform:'uppercase', letterSpacing:1 }}>{children}</p>
);

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const navigate = useNavigate();

  const load = () => api.get('/admin/businesses').then(r => setBusinesses(r.data));
  useEffect(() => { load(); }, []);

  const filtered = businesses.filter(b => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
                        b.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'active' ? b.active : !b.active);
    return matchSearch && matchFilter;
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/admin/businesses', form);
      setShowModal(false); setForm(EMPTY); load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create business');
    } finally { setSaving(false); }
  };

  const toggleActive = async (b) => {
    await api.put(`/admin/businesses/${b.id}`, { ...b, active: b.active ? 0 : 1 });
    load();
  };

  return (
    <Layout>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:700, color:'var(--ink)' }}>Businesses</h1>
          <p style={{ color:'var(--muted)', fontSize:14, marginTop:4 }}>{businesses.length} businesses registered</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{
          padding:'12px 24px', background:'linear-gradient(135deg,var(--accent),var(--brand))',
          color:'white', border:'none', borderRadius:12, fontWeight:600, fontSize:14,
          boxShadow:'0 4px 16px rgba(37,211,102,0.4)', cursor:'pointer',
        }}>+ Add Business</button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search businesses..."
          style={{ flex:1, padding:'10px 16px', borderRadius:10, border:'1.5px solid var(--line)', background:'white', fontSize:14 }}
        />
        {['all','active','inactive'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:'10px 18px', borderRadius:10, border:'1.5px solid',
            borderColor: filter===f ? 'var(--accent)' : 'var(--line)',
            background: filter===f ? 'var(--accent-soft)' : 'white',
            color: filter===f ? 'var(--brand)' : 'var(--muted)',
            fontWeight: filter===f ? 600 : 400, fontSize:13, textTransform:'capitalize', cursor:'pointer',
          }}>{f}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:'white', borderRadius:16, border:'1px solid var(--line)', overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:640 }}>
            <thead>
              <tr style={{ background:'var(--line-soft)' }}>
                {['Business','Email','Type','Messages','Subscription','Account','Actions'].map(h => (
                  <th key={h} style={{ padding:'14px 16px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>No businesses found</td></tr>
              ) : filtered.map((b, i) => (
                <tr key={b.id} style={{ borderTop:'1px solid var(--line-soft)', background: i%2===0?'white':'#FAFAFA' }}>
                  <td style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:14 }}>
                        {b.name[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight:600, color:'var(--ink)', fontSize:14 }}>{b.name}</span>
                    </div>
                  </td>
                  <td style={{ padding:'14px 16px', fontSize:13, color:'var(--muted)' }}>{b.email}</td>
                  <td style={{ padding:'14px 16px', fontSize:13, color:'var(--muted)' }}>{b.type || '—'}</td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ background:'var(--accent-soft)', color:'var(--brand)', padding:'4px 10px', borderRadius:999, fontSize:12, fontWeight:600 }}>{b.msg_count ?? 0}</span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    {(() => {
                      const s = b.subscription_status || 'trial';
                      const exp = b.trial_expires_at;
                      const isExpired = s === 'trial' && exp && new Date(exp) < new Date();
                      const cfg = s === 'suspended' || isExpired
                        ? { bg:'#FFE5E5', color:'#C62828', label: isExpired ? 'Expired' : 'Suspended' }
                        : s === 'active'
                        ? { bg:'var(--accent-soft)', color:'var(--brand)', label:'Active' }
                        : { bg:'#FFF8E1', color:'#856404', label:'Trial' };
                      return (
                        <div>
                          <span style={{ padding:'4px 10px', borderRadius:999, fontSize:12, fontWeight:600, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>
                          {s === 'trial' && exp && !isExpired && (
                            <p style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
                              Exp: {new Date(exp).toLocaleDateString('en-KE')}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:600, background: b.active?'var(--accent-soft)':'#FFE5E5', color: b.active?'var(--brand)':'#CC0000' }}>
                      {b.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => navigate(`/admin/businesses/${b.id}`)}
                        style={{ padding:'6px 14px', borderRadius:8, border:'1.5px solid var(--accent)', background:'transparent', color:'var(--brand)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                        Manage
                      </button>
                      <button onClick={() => toggleActive(b)}
                        style={{ padding:'6px 14px', borderRadius:8, border:'1.5px solid var(--line)', background:'transparent', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>
                        {b.active ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Business Modal */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
          <div style={{ background:'white', borderRadius:20, padding:32, width:'100%', maxWidth:560, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--ink)' }}>Add New Business</h2>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', fontSize:20, color:'var(--muted)', cursor:'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize:13, color:'var(--muted)', marginBottom:24 }}>
              The business owner will log in and set up their own products, photos, FAQs and M-Pesa details.
            </p>

            <form onSubmit={handleSave}>
              {/* Account */}
              <SectionLabel>Account</SectionLabel>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                {[
                  { key:'name',     label:'Business Name *', ph:'Mama Mboga Shop' },
                  { key:'email',    label:'Login Email *',   ph:'owner@business.com' },
                  { key:'password', label:'Password *',      ph:'changeme123' },
                  { key:'phone',    label:'Contact Phone',   ph:'+254700000000' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--muted)', marginBottom:4 }}>{f.label}</label>
                    <input value={form[f.key]} placeholder={f.ph} required={f.label.includes('*')}
                      onChange={e => set(f.key, e.target.value)} style={inp} />
                  </div>
                ))}
              </div>

              {/* Business type */}
              <SectionLabel>Business Type *</SectionLabel>
              <div style={{ marginBottom:20 }}>
                <select value={form.type} onChange={e => set('type', e.target.value)} required style={{ ...inp, cursor:'pointer' }}>
                  <option value="">— Select type —</option>
                  {BIZ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <p style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>
                  This tells the AI how to behave — restaurant bot asks for dine-in/delivery, clothing bot asks for size & color, etc.
                </p>
              </div>

              {/* Location & Hours */}
              <SectionLabel>Location & Hours</SectionLabel>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--muted)', marginBottom:4 }}>Location</label>
                  <input value={form.location} placeholder="Nairobi, Kenya" onChange={e => set('location', e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--muted)', marginBottom:4 }}>Opening Hours</label>
                  <input value={form.hours} placeholder="Mon-Sat 8AM-8PM" onChange={e => set('hours', e.target.value)} style={inp} />
                </div>
              </div>

              {/* WhatsApp */}
              <SectionLabel>WhatsApp Integration</SectionLabel>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                {[
                  { key:'owner_number',    label:'Owner / Escalation Number', ph:'+254700000000' },
                  { key:'whatsapp_token',  label:'WhatsApp Token',            ph:'EAAxxxxx...' },
                  { key:'phone_number_id', label:'Phone Number ID',           ph:'1234567890' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--muted)', marginBottom:4 }}>{f.label}</label>
                    <input value={form[f.key]} placeholder={f.ph} onChange={e => set(f.key, e.target.value)} style={inp} />
                  </div>
                ))}
              </div>

              {/* Info box */}
              <div style={{ background:'#F0FFF4', border:'1.5px solid var(--accent)', borderRadius:10, padding:'12px 16px', marginBottom:24 }}>
                <p style={{ fontSize:13, color:'var(--brand)', fontWeight:600, marginBottom:4 }}>📋 What happens next?</p>
                <ul style={{ margin:0, padding:'0 0 0 16px', fontSize:12, color:'var(--brand)' }}>
                  <li>Business owner logs in with the email & password above</li>
                  <li>They add their own products, photos, categories, and FAQs</li>
                  <li>They set their M-Pesa Paybill or Till number</li>
                  <li>Bot goes live automatically once WhatsApp credentials are set</li>
                </ul>
              </div>

              <div style={{ display:'flex', gap:12 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex:1, padding:'12px', borderRadius:10, border:'1.5px solid var(--line)', background:'white', color:'var(--muted)', fontWeight:600, cursor:'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ flex:1, padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,var(--accent),var(--brand))', color:'white', fontWeight:700, cursor:'pointer' }}>
                  {saving ? 'Creating...' : 'Create Business'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
