import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { IconCheck, IconX } from '../../components/icons';
import { supportLine } from '../../config';
import api from '../../api';

const GUIDE_TIPS = {
  restaurant: ['Add products grouped by category: Meals, Drinks, Sides, Desserts',
    'Bot will ask Dine In / Takeaway / Delivery after item selection',
    'Set your M-Pesa paybill so customers pay right in WhatsApp',
    'Add FAQs like: "We deliver within 5km" or "Orders ready in 20 mins"'],
  cloth: ['Add products with category: Men, Women, Kids, Accessories',
    'Bot will ask for size and color after selection',
    'Add FAQs like: "We accept returns within 7 days"',
    'Add a description per item e.g. "100% cotton, slim fit"'],
  electron: ['Add products with specs in description (e.g. "128GB, 6GB RAM")',
    'Add FAQs: warranty policy, repair turnaround time',
    'Bot will help customers find items based on budget if undecided',
    'Categorize by: Phones, Laptops, Accessories, Repairs'],
  service: ['Add services as products e.g. "Haircut — Ksh 300"',
    'Bot will ask for preferred date and time after service selection',
    'Add FAQs: "Service takes 45 mins", "Home visits available"',
    'Set opening hours so bot knows your availability'],
};

function Section({ title, desc, children }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{title}</h2>
      {desc && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>{desc}</p>}
      {children}
    </div>
  );
}

export default function BusinessProfile() {
  const [form, setForm]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const [creds, setCreds]           = useState({ current_password: '', email: '', new_password: '', confirm_password: '' });
  const [credSaving, setCredSaving] = useState(false);
  const [credMsg, setCredMsg]       = useState(null);
  const [showPw, setShowPw]         = useState({ current: false, new: false, confirm: false });
  const [credUnlocked, setCredUnlocked] = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [gatePassword, setGatePassword] = useState('');
  const [gateShowPw, setGateShowPw] = useState(false);

  useEffect(() => {
    api.get('/business/profile').then(r => setForm(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const verifyGate = async () => {
    if (!gatePassword) return;
    setVerifying(true); setCredMsg(null);
    try {
      await api.put('/business/credentials', { current_password: gatePassword });
      setCredUnlocked(true);
      setCreds(p => ({ ...p, current_password: gatePassword }));
    } catch (err) {
      setCredMsg({ type: 'error', text: err.response?.data?.error || 'Incorrect password.' });
    } finally { setVerifying(false); }
  };

  const handleCredentials = async () => {
    if (creds.new_password && creds.new_password !== creds.confirm_password) {
      setCredMsg({ type: 'error', text: 'New passwords do not match.' }); return;
    }
    if (!creds.email && !creds.new_password) {
      setCredMsg({ type: 'error', text: 'Enter a new email or new password to update.' }); return;
    }
    setCredSaving(true); setCredMsg(null);
    try {
      await api.put('/business/credentials', {
        current_password: creds.current_password,
        email: creds.email || undefined,
        new_password: creds.new_password || undefined,
      });
      setCredMsg({ type: 'success', text: 'Credentials updated! Use your new details next time you log in.' });
      setCreds({ current_password: '', email: '', new_password: '', confirm_password: '' });
      setCredUnlocked(false);
      setGatePassword('');
    } catch (err) {
      setCredMsg({ type: 'error', text: err.response?.data?.error || 'Update failed.' });
    } finally { setCredSaving(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/business/profile', form);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { alert('Failed to save'); }
    finally { setSaving(false); }
  };

  if (!form) return <Layout><p style={{ color: 'var(--muted)' }}>Loading profile…</p></Layout>;

  const t = (form.type || '').toLowerCase();
  const guideKey = Object.keys(GUIDE_TIPS).find(k => t.includes(k));
  const pwMismatch = creds.confirm_password && creds.new_password !== creds.confirm_password;

  return (
    <Layout narrow>
      <div className="page-head">
        <h1>Business profile</h1>
        <p>This info is what the AI uses to answer your customers.</p>
      </div>

      {saved && (
        <div className="card" style={{
          marginBottom: 16, padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center',
          background: 'var(--ok-bg)', borderColor: '#BFE3CE', color: 'var(--ok)',
          fontWeight: 600, fontSize: 13,
        }}>
          <IconCheck size={16} /> Profile saved successfully
        </div>
      )}

      {guideKey && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--info-bg)', borderColor: '#C3D8F2' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Setup guide</h2>
          <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
            {GUIDE_TIPS[guideKey].map((tip, i) => (
              <li key={i} style={{ fontSize: 13, marginBottom: 6 }}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Basic information">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {[
            { key: 'name', label: 'Business name', ph: 'My Shop' },
            { key: 'type', label: 'Business type', ph: 'Retail / Food' },
            { key: 'location', label: 'Location', ph: 'Nairobi, Kenya' },
            { key: 'hours', label: 'Opening hours', ph: 'Mon-Sat 8AM-8PM' },
            { key: 'phone', label: 'Contact phone', ph: '+254700000000' },
            { key: 'owner_number', label: 'Escalation number', ph: '+254700000000' },
          ].map(f => (
            <div key={f.key}>
              <label className="label" htmlFor={`biz-${f.key}`}>{f.label}</label>
              <input id={`biz-${f.key}`} className="input" value={form[f.key] || ''} placeholder={f.ph}
                onChange={e => set(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </Section>

      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontWeight: 600, fontSize: 14 }}>WhatsApp API credentials</p>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Managed by your administrator{supportLine() ? <>; {supportLine().toLowerCase()} for changes</> : '.'}
        </p>
      </div>

      <Section title="Products & services" desc="Shown in the customer catalog. Add a photo URL so customers can see what they're buying.">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <span className={`badge ${(form.products || []).length >= 50 ? 'badge-bad' : 'badge-ok'}`}>
            {(form.products || []).length} / 50
          </span>
        </div>
        {(form.products || []).map((p, i) => (
          <div key={i} style={{
            border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
            padding: 14, marginBottom: 12, background: 'var(--surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span className="num" style={{
                minWidth: 26, height: 26, borderRadius: 8, background: 'var(--brand)',
                color: '#fff', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{i + 1}</span>
              <input className="input" placeholder="Product / service name *" value={p.name || ''}
                style={{ flex: 3 }}
                onChange={e => { const arr = [...form.products]; arr[i] = { ...arr[i], name: e.target.value }; set('products', arr); }} />
              <input className="input" placeholder="Price e.g. Ksh 150" value={p.price || ''}
                style={{ flex: 1, minWidth: 110 }}
                onChange={e => { const arr = [...form.products]; arr[i] = { ...arr[i], price: e.target.value }; set('products', arr); }} />
              <button onClick={() => set('products', form.products.filter((_, j) => j !== i))}
                aria-label="Remove product"
                className="btn btn-danger-ghost" style={{ padding: '8px 10px' }}>
                <IconX size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, marginBottom: 10 }}>
              <input className="input" placeholder="Category (e.g. Meals, Drinks)" value={p.category || ''}
                onChange={e => { const arr = [...form.products]; arr[i] = { ...arr[i], category: e.target.value }; set('products', arr); }} />
              <input className="input" placeholder="Short description — size, colour, specs…" value={p.description || ''}
                onChange={e => { const arr = [...form.products]; arr[i] = { ...arr[i], description: e.target.value }; set('products', arr); }} />
              <div>
                <input className="input num" type="number" min="-1" title="Stock quantity (-1 = unlimited)"
                  value={p.stock_qty === undefined ? -1 : p.stock_qty} style={{ width: 76, textAlign: 'center' }}
                  onChange={e => { const arr = [...form.products]; arr[i] = { ...arr[i], stock_qty: parseInt(e.target.value) || 0 }; set('products', arr); }} />
                <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2, textAlign: 'center' }}>-1 = unlimited</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}>
                Upload photo
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append('file', file);
                    try {
                      const res = await api.post('/business/upload-image', fd);
                      const arr = [...form.products];
                      arr[i] = { ...arr[i], photo_url: res.data.url };
                      set('products', arr);
                    } catch { alert('Upload failed. Make sure the server is running.'); }
                    e.target.value = '';
                  }} />
              </label>
              <input className="input" placeholder="…or paste image URL" value={p.photo_url || ''}
                style={{ flex: 1, fontSize: 12 }}
                onChange={e => { const arr = [...form.products]; arr[i] = { ...arr[i], photo_url: e.target.value }; set('products', arr); }} />
              {p.photo_url ? (
                <img src={p.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--line)', flexShrink: 0 }}
                  onError={e => e.target.style.display = 'none'} />
              ) : null}
            </div>
          </div>
        ))}
        {(form.products || []).length < 50 ? (
          <button className="btn btn-ghost" style={{ width: '100%', borderStyle: 'dashed', marginTop: 4 }}
            onClick={() => set('products', [...(form.products || []), { name: '', price: '', category: '', description: '', photo_url: '' }])}>
            + Add product
          </button>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 8 }}>
            Maximum 50 products reached. Remove one to add another.
          </p>
        )}
      </Section>

      <Section title="M-Pesa payments" desc="The bot sends these details after order confirmation. Leave blank to skip the payment step.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label className="label" htmlFor="mpesa-paybill">Paybill</label>
            <input id="mpesa-paybill" className="input" placeholder="Business no. e.g. 522522"
              value={form.paybill || ''} onChange={e => set('paybill', e.target.value)} />
            <input className="input" placeholder="Account no. (blank = order ID)" value={form.paybill_account || ''}
              style={{ marginTop: 8 }} onChange={e => set('paybill_account', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="mpesa-till">Till number</label>
            <input id="mpesa-till" className="input" placeholder="e.g. 123456"
              value={form.till_number || ''} onChange={e => set('till_number', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="mpesa-send">Send money</label>
            <input id="mpesa-send" className="input" placeholder="e.g. +254712345678"
              value={form.send_money || ''} onChange={e => set('send_money', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="mpesa-pochi">Pochi la Biashara</label>
            <input id="mpesa-pochi" className="input" placeholder="e.g. +254712345678"
              value={form.pochi_number || ''} onChange={e => set('pochi_number', e.target.value)} />
          </div>
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '12px 14px', borderRadius: 'var(--radius-sm)', marginTop: 14,
          border: '1px solid', borderColor: form.pay_on_delivery ? 'var(--brand)' : 'var(--line)',
          background: form.pay_on_delivery ? 'var(--accent-soft)' : 'var(--surface)',
          cursor: 'pointer',
        }}>
          <span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>Pay on delivery (cash)</span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>
              Customers can pay cash when they receive the order
            </span>
          </span>
          <input type="checkbox" checked={!!form.pay_on_delivery}
            onChange={() => set('pay_on_delivery', form.pay_on_delivery ? 0 : 1)}
            style={{ accentColor: 'var(--brand)', width: 20, height: 20 }} />
        </label>
      </Section>

      <Section title="FAQs" desc="Common info the AI should know about your business.">
        {(form.faqs || []).map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input className="input" placeholder="e.g. We accept M-Pesa payments"
              value={f.content || f || ''} style={{ flex: 1 }}
              onChange={e => { const arr = [...form.faqs]; arr[i] = { ...arr[i], content: e.target.value }; set('faqs', arr); }} />
            <button onClick={() => set('faqs', form.faqs.filter((_, j) => j !== i))}
              aria-label="Remove FAQ" className="btn btn-danger-ghost" style={{ padding: '8px 10px' }}>
              <IconX size={16} />
            </button>
          </div>
        ))}
        <button className="btn btn-ghost" style={{ width: '100%', borderStyle: 'dashed', marginTop: 4 }}
          onClick={() => set('faqs', [...(form.faqs || []), { content: '' }])}>
          + Add FAQ
        </button>
      </Section>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}
        style={{ padding: '13px 40px', fontSize: 15, marginBottom: 20 }}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>

      <Section title="Login credentials" desc="Change your login email or password. Verify your identity first.">
        {credMsg && (
          <div className="card" style={{
            marginBottom: 16, padding: '12px 16px', fontSize: 13, fontWeight: 500,
            background: credMsg.type === 'success' ? 'var(--ok-bg)' : 'var(--bad-bg)',
            borderColor: credMsg.type === 'success' ? '#BFE3CE' : '#F0CFC9',
            color: credMsg.type === 'success' ? 'var(--ok)' : 'var(--bad)',
          }}>
            {credMsg.text}
          </div>
        )}

        {!credUnlocked ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type={gateShowPw ? 'text' : 'password'}
              placeholder="Current password" value={gatePassword}
              onChange={e => setGatePassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyGate()}
              style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={() => setGateShowPw(p => !p)} aria-label="Show password">
              {gateShowPw ? 'Hide' : 'Show'}
            </button>
            <button className="btn btn-primary" onClick={verifyGate} disabled={verifying || !gatePassword}>
              {verifying ? 'Verifying…' : 'Unlock'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div>
                <label className="label" htmlFor="cred-email">New email address</label>
                <input id="cred-email" className="input" type="email" placeholder="Leave blank to keep current"
                  value={creds.email} onChange={e => setCreds(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="cred-pw">New password</label>
                <input id="cred-pw" className="input" type={showPw.new ? 'text' : 'password'}
                  placeholder="Leave blank to keep current" value={creds.new_password}
                  onChange={e => setCreds(p => ({ ...p, new_password: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="cred-pw2">Confirm new password</label>
                <input id="cred-pw2" className="input" type={showPw.confirm ? 'text' : 'password'}
                  placeholder="Repeat new password" value={creds.confirm_password}
                  style={pwMismatch ? { borderColor: 'var(--bad)' } : undefined}
                  onChange={e => setCreds(p => ({ ...p, confirm_password: e.target.value }))} />
                {pwMismatch && <p className="hint" style={{ color: 'var(--bad)' }}>Passwords do not match</p>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                <input type="checkbox" checked={showPw.new}
                  onChange={() => setShowPw(p => ({ ...p, new: !p.new, confirm: !p.confirm }))}
                  style={{ accentColor: 'var(--brand)' }} /> Show passwords
              </label>
              <span style={{ flex: 1 }} />
              <button className="btn btn-ghost"
                onClick={() => { setCredUnlocked(false); setGatePassword(''); setCredMsg(null); }}>
                Lock
              </button>
              <button className="btn btn-primary" onClick={handleCredentials} disabled={credSaving}>
                {credSaving ? 'Updating…' : 'Update credentials'}
              </button>
            </div>
          </div>
        )}
      </Section>
    </Layout>
  );
}
