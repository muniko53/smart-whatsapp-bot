import React from 'react';

export default function StatCard({ icon, label, value, delta, tone = 'neutral' }) {
  const tones = {
    neutral: 'var(--muted)',
    up: 'var(--ok)',
    down: 'var(--bad)',
  };
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>
          {label}
        </span>
        <span style={{ color: 'var(--brand)', display: 'flex' }}>{icon}</span>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, color: 'var(--ink)',
        lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {delta && (
        <div style={{ fontSize: 13, color: tones[tone] || tones.neutral, fontWeight: 500 }}>
          {delta}
        </div>
      )}
    </div>
  );
}
