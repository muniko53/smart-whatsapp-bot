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

export default function Terms() {
  const contact = supportLine() || 'the team that gave you access';
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 16px' }}>
      <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
          Last updated: {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Terms of Service — {PRODUCT_NAME}</h1>

        <Section title="The service">
          <p>{PRODUCT_NAME} provides an automated WhatsApp assistant and a management dashboard
          for businesses. Accounts are created by an administrator; there is no public self-signup.</p>
        </Section>

        <Section title="Acceptable use">
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Message only customers who contacted you first, and within WhatsApp's 24-hour messaging window.</li>
            <li>No spam, fraud, or unlawful content. WhatsApp may restrict numbers that violate its policies.</li>
            <li>Keep product prices and business details accurate — the bot repeats what you enter.</li>
          </ul>
        </Section>

        <Section title="Payments">
          <p>M-Pesa payments move directly between customers and your business accounts. We record
          totals and transaction codes but never touch the money. Verify transaction codes against
          your M-Pesa statement before fulfilling orders.</p>
        </Section>

        <Section title="Availability">
          <p>The service depends on Meta's WhatsApp API and third-party AI providers. We aim for
          continuous operation but do not guarantee uninterrupted service, and AI replies should be
          spot-checked for accuracy.</p>
        </Section>

        <Section title="Suspension">
          <p>Accounts engaged in spam, fraud, or abuse may be suspended. Contact {contact} to appeal.</p>
        </Section>

        <Link to="/login" style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 14 }}>Back to sign in</Link>
      </div>
    </div>
  );
}
