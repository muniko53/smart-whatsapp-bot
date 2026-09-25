import React, { useState, useRef, useEffect } from 'react';
import api from '../api';
import { IconChat, IconMega, IconX } from './icons';
import { SUPPORT_WHATSAPP } from '../config';

// Contact block for FAQ answers — empty when no support number is configured
// (never show a wrong number).
const CONTACT_LINES = SUPPORT_WHATSAPP
  ? `📞 Message us on WhatsApp: ${SUPPORT_WHATSAPP}`
  : '';
const CONTACT_INLINE = SUPPORT_WHATSAPP ? ` on WhatsApp at ${SUPPORT_WHATSAPP}` : '';

const SUGGESTIONS = [
  'How does the bot work?',
  'How much does it cost?',
  'How do I get started?',
  'Does it support M-Pesa?',
  'Can I try it for free?',
  'What businesses can use this?',
];

// Built-in FAQ answers — work instantly without the server
const LOCAL_FAQS = [
  {
    patterns: ['how does', 'how it work', 'what is', 'explain', 'tell me about'],
    answer: `🤖 *How it works:*

Our platform connects a smart AI bot to your WhatsApp Business number. When a customer messages you:

1️⃣ Bot greets them & shows your product menu
2️⃣ Customer browses, selects items & places order
3️⃣ M-Pesa payment instructions are sent automatically
4️⃣ You get a WhatsApp alert + order appears on your dashboard
5️⃣ You update the status → customer gets notified

All 24/7 — without you typing a single reply! 😊`,
  },
  {
    patterns: ['cost', 'price', 'how much', 'pricing', 'fee', 'charge', 'pay', 'bei'],
    answer: `💰 *Pricing & Special Offer:*

We believe in letting the results speak first — so we offer *new businesses a free trial period* to experience the full platform before any commitment.

🎁 You get to:
• Run the bot with real customers
• Receive actual orders through WhatsApp
• See your dashboard, analytics & payments working

Once you see it working for your business, we discuss a plan that fits your size and needs.

📞 *Reach out to get started:*${CONTACT_LINES ? `\n${CONTACT_LINES}` : ''}

We'll set everything up with you — no upfront cost to try. 🙌`,
  },
  {
    patterns: ['get started', 'sign up', 'register', 'how to start', 'begin', 'start', 'join'],
    answer: `🚀 *Getting started is easy — and free to try:*

1️⃣ Contact us${CONTACT_INLINE ? ` on WhatsApp at *${SUPPORT_WHATSAPP}*` : ''} — we create your account
2️⃣ We guide you through the WhatsApp API setup (~30 mins, one time)
3️⃣ Add your products, M-Pesa details & business info
4️⃣ Share your number — bot goes live immediately!

🎁 *New businesses get a free trial* — use the full platform with real customers first, subscribe only when you're convinced it works.

No risk. No pressure. Just results. 💪`,
  },
  {
    patterns: ['mpesa', 'm-pesa', 'payment', 'pay', 'lipa', 'pesa'],
    answer: `💳 *M-Pesa support:*

Yes! We support all M-Pesa payment methods:

🏦 Paybill (Business No. + Account No.)
🏪 Till Number (Buy Goods)
📲 Send Money (phone number)
💼 Pochi la Biashara
💵 Pay on Delivery (cash)

After a customer confirms their order, the bot automatically sends them the payment instructions. Once they pay, they share the M-Pesa code and you get an instant alert! ✅`,
  },
  {
    patterns: ['free', 'trial', 'try', 'test', 'demo'],
    answer: `🎁 *Free tier:*

Yes! Meta provides *1,000 free conversations per month* per WhatsApp number — completely free.

For most new businesses, this covers all your customers when starting out. You only start paying Meta when you go beyond 1,000 conversations in a month.

Contact us${CONTACT_INLINE} to get started for free! 😊`,
  },
  {
    patterns: ['business', 'who can', 'what type', 'restaurant', 'shop', 'store', 'use this', 'for who', 'suitable'],
    answer: `🏪 *Who can use this:*

Any business that gets customer inquiries on WhatsApp! We're built specifically for:

🍽️ Restaurants & food businesses
👗 Clothing & fashion stores
📱 Electronics & tech shops
⚡ Service providers (salons, repairs, tutors)
🛒 General retail & online shops

The bot adapts its personality and flow based on your business type automatically.`,
  },
  {
    patterns: ['feature', 'what can', 'capabilities', 'include', 'does it have'],
    answer: `✨ *Features included:*

• 24/7 auto replies in English & Swahili
• Product catalog with categories & photos
• Full order management (place, track, update)
• M-Pesa payment automation
• Customer database & history
• Marketing broadcasts to all customers
• Analytics dashboard (revenue, orders, top products)
• AI upselling after every order
• Voice note transcription
• Low stock alerts to owner
• Delivery tracking with ETA
• Escalation to human agent when needed`,
  },
  {
    patterns: ['hello', 'hi', 'hey', 'hii', 'habari', 'sasa', 'niaje', 'good morning', 'good afternoon'],
    answer: `👋 Hello! Welcome to Smart WhatsApp Sales Assistant.

I'm here to answer any questions you have about our platform. What would you like to know?

You can ask about pricing, features, how to get started, M-Pesa support, or anything else! 😊`,
  },
  {
    patterns: ['contact', 'reach', 'talk to', 'human', 'person', 'support', 'help'],
    answer: `📞 *Talk to us:*${CONTACT_LINES ? `\n\n${CONTACT_LINES}` : ''}

Our team will walk you through the platform, answer every question, and get your bot live — *at no cost to start*.

We'd rather show you it works than convince you with words. 🙌`,
  },
];

function localAnswer(message) {
  const msg = message.toLowerCase();
  for (const faq of LOCAL_FAQS) {
    if (faq.patterns.some(p => msg.includes(p))) {
      return faq.answer;
    }
  }
  return null;
}

const BOT_AVATAR = (
  <div style={{
    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
    background: 'var(--brand)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}><IconChat size={16} /></div>
);

export default function WebChatWidget() {
  const [open, setOpen]         = useState(false);
  const [labelDismissed, setLabelDismissed] = useState(false);
  const [hoverLabel, setHoverLabel] = useState(false);
  const hoverTimer = useRef(null);
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: "👋 Hi! I'm the Smart WhatsApp Sales Assistant.\n\nI can answer any questions you have about how our platform works, pricing, setup, and more.\n\nWhat would you like to know?",
    }
  ]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread]   = useState(0);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);

    // Try local FAQ first (instant, no server needed)
    const local = localAnswer(msg);
    if (local) {
      setTimeout(() => {
        setMessages(m => [...m, { role: 'bot', text: local }]);
        if (!open) setUnread(u => u + 1);
      }, 400);
      return;
    }

    // Fall back to AI for complex questions
    setLoading(true);
    try {
      const history = messages.slice(-6).map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', text: m.text }));
      const r = await api.post('/webchat', { message: msg, history });
      setMessages(m => [...m, { role: 'bot', text: r.data.reply }]);
      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(m => [...m, { role: 'bot', text: SUPPORT_WHATSAPP
        ? `I'm not sure about that one. Message us on WhatsApp at ${SUPPORT_WHATSAPP} and our team will help you!`
        : "I'm not sure about that one. Please try again shortly." }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 96, right: 24, zIndex: 9999,
          width: 360, maxWidth: 'calc(100vw - 40px)',
          background: 'white', borderRadius: 20,
          boxShadow: '0 16px 60px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '70vh', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: 'var(--brand)',
            padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}><IconChat size={20} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                Smart WhatsApp Assistant
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.75)', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
                Online — replies instantly
              </p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat"
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8, display: 'flex', padding: 4 }}>
              <IconX size={20} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px',
            background: '#EAE6DF', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: 8,
              }}>
                {m.role === 'bot' && BOT_AVATAR}
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'user'
                    ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                  background: m.role === 'user' ? 'var(--accent-soft)' : 'white',
                  boxShadow: '0 1px 1px rgba(16,35,31,0.12)',
                  fontSize: 13, color: 'var(--ink)', lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                {BOT_AVATAR}
                <div style={{
                  padding: '12px 16px', background: 'white', borderRadius: '4px 18px 18px 18px',
                  boxShadow: '0 1px 1px rgba(16,35,31,0.12)', fontSize: 13, color: 'var(--muted)',
                }}>
                  Typing…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions */}
          {messages.length <= 2 && !loading && (
            <div style={{
              padding: '10px 12px', background: 'var(--surface-soft)',
              borderTop: '1px solid var(--line)',
              display: 'flex', flexWrap: 'wrap', gap: 6,
            }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                    background: 'white', border: '1px solid var(--line)', color: 'var(--brand)',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '12px 14px', background: 'white',
            borderTop: '1px solid var(--line-soft)',
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask anything about the platform…"
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 24,
                border: '1px solid var(--line)', fontSize: 13, outline: 'none',
                background: 'var(--surface-soft)', color: 'var(--ink)',
              }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              aria-label="Send message"
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: input.trim() ? 'var(--brand)' : 'var(--line)',
                color: input.trim() ? 'white' : 'var(--faint)',
                cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}>
              <IconMega size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Hover tooltip label */}
      {!open && hoverLabel && (
        <div style={{
          position: 'fixed', bottom: 34, right: 96, zIndex: 9998,
          background: 'white', borderRadius: 14,
          boxShadow: 'var(--shadow-float)',
          padding: '10px 16px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Got questions?</p>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Chat with our AI assistant now</p>
          {/* Arrow pointing right */}
          <div style={{
            position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderLeft: '8px solid white',
          }} />
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => { setOpen(o => !o); setLabelDismissed(true); setHoverLabel(false); }}
        onMouseEnter={() => {
          if (!open) {
            setHoverLabel(true);
            clearTimeout(hoverTimer.current);
            hoverTimer.current = setTimeout(() => setHoverLabel(false), 3000);
          }
        }}
        onMouseLeave={() => { clearTimeout(hoverTimer.current); setHoverLabel(false); }}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          width: 60, height: 60, borderRadius: '50%',
          border: '3px solid white',
          background: 'var(--brand)',
          boxShadow: 'var(--shadow-float)',
          cursor: 'pointer', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {open ? <IconX size={24} /> : <IconChat size={26} />}
        {!open && unread > 0 && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--bad)', color: 'white',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid white',
          }}>{unread}</div>
        )}
      </button>

    </>
  );
}
