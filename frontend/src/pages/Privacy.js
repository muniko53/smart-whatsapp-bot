import React from 'react';
import { Link } from 'react-router-dom';
import { PRODUCT_NAME, supportLine } from '../config';

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

export default function Privacy() {
  const contact = supportLine() || 'the team that gave you access';
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 16px' }}>
      <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
          Last updated: {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Privacy Policy — {PRODUCT_NAME}</h1>

        <Section title="What this service does">
          <p>{PRODUCT_NAME} is a WhatsApp sales assistant for small businesses. It reads customer
          messages sent to the business's WhatsApp number, replies automatically, takes orders,
          and shows businesses a dashboard of conversations, orders, and customers.</p>
        </Section>

        <Section title="Data we store">
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>WhatsApp messages (customer and bot replies) to keep conversation history.</li>
            <li>Customer phone numbers, names provided, orders, and M-Pesa transaction codes.</li>
            <li>Business profile data: products, prices, FAQs, and payment details the business enters.</li>
            <li>Sign-in tokens: a short-lived access token (tab session) and a 7-day refresh cookie.</li>
          </ul>
        </Section>

        <Section title="What we never do">
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>No advertising trackers, no analytics beacons, no data sale — ever.</li>
            <li>Message content is never used to train shared models.</li>
            <li>We do not scrape the web or pull data from anywhere outside what you send us.</li>
          </ul>
        </Section>

        <Section title="Third parties">
          <p>Messages travel through Meta's WhatsApp Cloud API. AI replies and voice-note
          transcription are processed by our AI providers. M-Pesa payments stay between the
          customer, Safaricom, and the business — we only record the transaction code.</p>
        </Section>

        <Section title="Your rights">
          <p>Ask the business you messaged — or {contact} — to view, correct, or delete your
          data. Businesses can delete conversations, customers, and orders from the dashboard.</p>
        </Section>

        <Link to="/login" style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 14 }}>Back to sign in</Link>
      </div>
    </div>
  );
}
