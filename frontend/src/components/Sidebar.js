import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useIsMobile from '../hooks/useIsMobile';
import {
  IconGrid, IconChat, IconBox, IconUsers, IconMega, IconGear,
  IconLogout, IconMenu, IconX, IconCollapse,
} from './icons';

const adminLinks = [
  { to: '/admin',             Icon: IconGrid,  label: 'Dashboard'   },
  { to: '/admin/businesses',  Icon: IconBox,   label: 'Businesses'  },
  { to: '/admin/orders',      Icon: IconChat,  label: 'All Orders'  },
  { to: '/admin/escalations', Icon: IconUsers, label: 'Escalations' },
];
const bizLinks = [
  { to: '/dashboard',     Icon: IconGrid,  label: 'Dashboard'     },
  { to: '/conversations', Icon: IconChat,  label: 'Conversations' },
  { to: '/orders',        Icon: IconBox,   label: 'Orders'        },
  { to: '/customers',     Icon: IconUsers, label: 'Customers'     },
  { to: '/marketing',     Icon: IconMega,  label: 'Marketing'     },
  { to: '/profile',       Icon: IconGear,  label: 'My Profile'    },
];

const WA_LOGO = (
  <svg viewBox="0 0 39 39" width="22" height="22" fill="none" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd"
      d="M19.5 0C8.73 0 0 8.73 0 19.5c0 3.44.9 6.67 2.48 9.46L0 39l10.34-2.44A19.42 19.42 0 0019.5 39C30.27 39 39 30.27 39 19.5S30.27 0 19.5 0z"
      fill="white" />
    <path fillRule="evenodd" clipRule="evenodd"
      d="M29.15 23.57c-.45-.22-2.64-1.3-3.05-1.45-.4-.15-.7-.22-.99.22-.3.45-1.15 1.45-1.4 1.74-.26.3-.52.33-.97.11-.45-.22-1.9-.7-3.62-2.23-1.34-1.19-2.24-2.66-2.5-3.11-.26-.45-.03-.69.2-.91.2-.2.45-.52.67-.78.22-.26.3-.45.45-.74.15-.3.07-.56-.04-.78-.1-.22-1-2.4-1.36-3.28-.36-.87-.72-.74-.99-.75h-.85c-.3 0-.78.11-1.18.56-.41.44-1.56 1.52-1.56 3.71s1.6 4.3 1.82 4.6c.22.29 3.14 4.8 7.61 6.73 1.06.46 1.89.73 2.53.93.06.02.12.04.18.05 1.05.3 2 .26 2.75.16.84-.12 2.59-1.06 2.95-2.08.37-1.03.37-1.9.26-2.09-.11-.18-.4-.29-.85-.51z"
      fill="#25D366" />
  </svg>
);

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const isMobile  = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = user?.role === 'admin' ? adminLinks : bizLinks;
  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Business';
  const initial = (user?.email || '?').charAt(0).toUpperCase();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const W = collapsed ? 68 : 248;

  const sidebarContent = (
    <aside style={{
      width: W,
      minHeight: '100vh',
      background: 'var(--brand-strong)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed',
      left: isMobile ? (mobileOpen ? 0 : -280) : 0,
      top: 0, zIndex: 200,
      transition: 'width 0.2s ease, left 0.25s ease',
      overflow: 'hidden',
    }}>

      {/* Brand */}
      <div style={{
        padding: '20px 16px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: 36, height: 36, background: 'var(--accent)', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {WA_LOGO}
        </div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <p style={{
              color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1.25,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>Smart WhatsApp</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{roleLabel}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        {links.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin' || to === '/dashboard'}
            onClick={() => isMobile && setMobileOpen(false)}
            title={collapsed ? label : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '11px 0' : '10px 12px',
              marginBottom: 2,
              borderRadius: 10,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : 'rgba(255,255,255,0.72)',
              background: isActive ? 'rgba(37,211,102,0.18)' : 'transparent',
              transition: 'background 0.15s, color 0.15s',
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.classList.contains('active'))
                e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '';
            }}
          >
            <Icon size={18} />
            {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer: user chip + actions */}
      <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(37,211,102,0.25)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700,
            }}>{initial}</div>
            <p style={{
              color: 'rgba(255,255,255,0.75)', fontSize: 12,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
            }}>{user?.email}</p>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleLogout} title="Sign out"
            style={{
              flex: 1, padding: '9px 0', background: 'rgba(255,255,255,0.08)',
              color: '#fff', border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 8, fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}>
            <IconLogout size={16} />{!collapsed && 'Sign out'}
          </button>
          {!isMobile && (
            <button onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                padding: '9px 10px', background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
                transform: collapsed ? 'scaleX(-1)' : 'none',
              }}>
              <IconCollapse size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 56,
          background: 'var(--brand)', display: 'flex', alignItems: 'center',
          padding: '0 16px', zIndex: 100,
        }}>
          <button onClick={() => setMobileOpen(true)}
            style={{ background: 'none', border: 'none', color: '#fff', padding: 4, marginRight: 12, display: 'flex' }}
            aria-label="Open menu">
            <IconMenu size={22} />
          </button>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Smart WhatsApp Assistant</p>
          <button onClick={() => setMobileOpen(false)} aria-label="Close menu"
            style={{ display: 'none' }}>
            <IconX size={20} />
          </button>
        </div>
      )}

      {isMobile && mobileOpen && (
        <div>
          <div onClick={() => setMobileOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(16,35,31,0.5)', zIndex: 199,
          }} />
          <button onClick={() => setMobileOpen(false)} aria-label="Close menu"
            style={{
              position: 'fixed', top: 12, right: 12, zIndex: 201,
              background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
              borderRadius: 8, padding: 8, display: 'flex',
            }}>
            <IconX size={20} />
          </button>
        </div>
      )}

      {sidebarContent}
    </>
  );
}
