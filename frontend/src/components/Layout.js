import React, { useState } from 'react';
import Sidebar from './Sidebar';
import useIsMobile from '../hooks/useIsMobile';

export default function Layout({ children, narrow = false }) {
  const isMobile   = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const sidebarW   = isMobile ? 0 : collapsed ? 68 : 248;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main style={{
        marginLeft: sidebarW,
        padding: isMobile ? '72px 16px 32px' : '28px 32px 40px',
        flex: 1, minWidth: 0,
        transition: 'margin-left 0.2s ease',
      }}>
        <div style={{ maxWidth: narrow ? 880 : 1200, margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
