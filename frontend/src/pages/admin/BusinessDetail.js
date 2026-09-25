import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatCard from '../../components/StatCard';
import { IconBox, IconChat, IconClock } from '../../components/icons';
import api from '../../api';

const card = { background:'white', borderRadius:16, padding:24, border:'1px solid var(--line)', marginBottom:20 };
const inp  = { width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid var(--line)', background:'var(--line-soft)', fontSize:13, color:'var(--ink)', boxSizing:'border-box' };
const lbl  = { display:'block', fontSize:12, fontWeight:600, color:'var(--muted)', marginBottom:4 };

const BIZ_TYPES = [
  'Restaurant', 'Clothing Store', 'Electronics Shop', 'Service Provider', 'Retail Shop', 'Other',
];

export default function AdminBusinessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [biz, setBiz]       = useState(null);
  const [edit, setEdit]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const load = () => api.get('/admin/businesses').then(r => {
    const b = r.data.find(x => x.id === parseInt(id));
    setBiz(b);
    setEdit({ ...b });
  });
  useEffect(() => { load(); }, [id]);

  const set = (k, v) => setEdit(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/businesses/${id}`, edit);
      load();
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { alert('Save failed'); }
    finally { setSaving(false); }
  };

  if (!biz) return <Layout><p style={{ color:'var(--muted)' }}>Loading...</p></Layout>;

  return (
    <Layout>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:28 }}>
        <button onClick={() => navigate('/admin/businesses')}
          style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>←</button>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--ink)' }}>{biz.name}</h1>
          <p style={{ color:'var(--muted)', fontSize:13 }}>{biz.email}</p>
        </div>
        <span style={{ marginLeft:'auto', padding:'6px 16px', borderRadius:999, background: biz.active?'var(--accent-soft)':'#FFE5E5', color: biz.active?'var(--brand)':'#CC0000', fontWeight:600, fontSize:13 }}>
          {biz.active ? '● Active' : '● Inactive'}
        </span>
      </div>

      {saved && (
        <div style={{ marginBottom:16, padding:'12px 20px', borderRadius:10, background:'var(--accent-soft)', color:'var(--brand)', fontWeight:600, fontSize:13 }}>
          ✓ Changes saved
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:16, marginBottom:24 }}>
        <StatCard icon={<IconChat size={20} />} label="Total messages"  value={biz.msg_count} />
        <StatCard icon={<IconChat size={20} />} label="Conversations"   value={biz.conv_count} />
        <StatCard icon={<IconBox size={20} />} label="Products"        value={biz.product_count ?? '—'} />
        <StatCard icon={<IconClock size={20} />} label="Joined"           value={biz.created_at?.slice(0, 10)} />
      </div>

      {/* Account Settings */}
      <div style={card}>
        <h2 style={{ fontSize:16, fontWeight:700, color:'var(--ink)', marginBottom:20 }}>Account Settings</h2>

        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Business Type</label>
          <select value={edit?.type||''} onChange={e => set('type', e.target.value)} style={{ ...inp, cursor:'pointer' }}>
            <option value="">— Select type —</option>
            {BIZ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14, marginBottom:20 }}>
          {[
            { key:'name',         label:'Business Name' },
            { key:'location',     label:'Location' },
            { key:'hours',        label:'Opening Hours' },
            { key:'phone',        label:'Contact Phone' },
            { key:'owner_number', label:'Escalation / Owner Number' },
          ].map(f => (
            <div key={f.key}>
              <label style={lbl}>{f.label}</label>
              <input value={edit?.[f.key]||''} onChange={e => set(f.key, e.target.value)} style={inp} />
            </div>
          ))}
        </div>

        {/* Status toggles */}
        <div style={{ display:'flex', gap:24, marginBottom:24, flexWrap:'wrap' }}>
          {[{ key:'active', label:'Account Active' }, { key:'bot_enabled', label:'Bot Enabled' }].map(t => (
            <label key={t.key} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <div onClick={() => set(t.key, edit?.[t.key] ? 0 : 1)}
                style={{ width:44, height:24, borderRadius:12, position:'relative', background: edit?.[t.key]?'var(--accent)':'#CED4DA', transition:'background 0.2s', cursor:'pointer' }}>
                <div style={{ position:'absolute', top:3, left: edit?.[t.key]?22:2, width:18, height:18, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--ink)' }}>{t.label}</span>
            </label>
          ))}
        </div>

        {/* WhatsApp credentials */}
        <p style={{ fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:10, textTransform:'uppercase', letterSpacing:1 }}>WhatsApp Integration</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14, marginBottom:24 }}>
          {[
            { key:'whatsapp_token',  label:'WhatsApp Token' },
            { key:'phone_number_id', label:'Phone Number ID' },
          ].map(f => (
            <div key={f.key}>
              <label style={lbl}>{f.label}</label>
              <input value={edit?.[f.key]||''} onChange={e => set(f.key, e.target.value)} style={inp} />
            </div>
          ))}
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ padding:'12px 32px', borderRadius:10, border:'none', background:'linear-gradient(135deg,var(--accent),var(--brand))', color:'white', fontWeight:600, fontSize:14, cursor:'pointer' }}>
          {saving ? 'Saving...' : '💾  Save Changes'}
        </button>
      </div>

      {/* Subscription Management */}
      <div style={card}>
        <h2 style={{ fontSize:16, fontWeight:700, color:'var(--ink)', marginBottom:6 }}>Subscription Management</h2>
        <p style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>
          Control this business's access. Suspended businesses get a message to contact you instead of bot replies.
        </p>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14, marginBottom:20 }}>
          <div>
            <label style={lbl}>Subscription Status</label>
            <select value={edit?.subscription_status || 'trial'} onChange={e => set('subscription_status', e.target.value)}
              style={{ ...inp, cursor:'pointer', borderColor: edit?.subscription_status === 'suspended' ? '#FFCDD2' : edit?.subscription_status === 'active' ? '#A5D6A7' : 'var(--line)' }}>
              <option value="trial">🎁 Trial</option>
              <option value="active">✅ Active (Subscribed)</option>
              <option value="suspended">🚫 Suspended</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Trial Expires On</label>
            <input type="date" value={edit?.trial_expires_at || ''} onChange={e => set('trial_expires_at', e.target.value)} style={inp} />
            <p style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>Leave blank for no expiry (trial runs indefinitely)</p>
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={lbl}>Admin Note (internal only)</label>
          <textarea value={edit?.subscription_note || ''} onChange={e => set('subscription_note', e.target.value)}
            placeholder="e.g. Contacted on 20 Apr, agreed to pay by Friday..."
            rows={3} style={{ ...inp, resize:'vertical', fontFamily:'inherit' }} />
        </div>

        {edit?.subscription_status === 'suspended' && (
          <div style={{ padding:'12px 16px', borderRadius:10, background:'#FFF0F0', border:'1px solid #FFCDD2', marginBottom:20 }}>
            <p style={{ fontSize:13, color:'#C62828', fontWeight:600 }}>⚠️ Bot disabled for this business</p>
            <p style={{ fontSize:12, color:'#C62828', marginTop:2 }}>
              Customers who message them will receive: "This business's bot service is currently unavailable. Please contact the business directly."
            </p>
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ padding:'12px 32px', borderRadius:10, border:'none', background:'linear-gradient(135deg,var(--accent),var(--brand))', color:'white', fontWeight:600, fontSize:14, cursor:'pointer' }}>
          {saving ? 'Saving...' : '💾  Save Subscription'}
        </button>
      </div>

      {/* Info box */}
      <div style={{ background:'var(--line-soft)', borderRadius:14, padding:'16px 20px' }}>
        <p style={{ fontSize:13, fontWeight:600, color:'var(--ink)', marginBottom:6 }}>📋 Business owner manages their own:</p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {['Products & photos','Categories','M-Pesa Paybill / Till','FAQs & policies','Pricing'].map(item => (
            <span key={item} style={{ padding:'4px 12px', borderRadius:999, background:'white', border:'1.5px solid var(--line)', fontSize:12, color:'var(--muted)' }}>
              {item}
            </span>
          ))}
        </div>
        <p style={{ fontSize:12, color:'var(--muted)', marginTop:10 }}>
          They log in at <strong>localhost:3001</strong> using the email and password you created for them.
        </p>
      </div>
    </Layout>
  );
}
