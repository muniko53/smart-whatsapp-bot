import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { trackPageview } from './utils/analytics';
import WebChatWidget from './components/WebChatWidget';
import CookieConsent from './components/CookieConsent';
import Login from './pages/Login';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';
import AdminDashboard from './pages/admin/Dashboard';
import AdminBusinesses from './pages/admin/Businesses';
import AdminBusinessDetail from './pages/admin/BusinessDetail';
import AdminOrders from './pages/admin/Orders';
import AdminEscalations from './pages/admin/Escalations';
import BusinessDashboard from './pages/business/Dashboard';
import BusinessProfile from './pages/business/Profile';
import BusinessConversations from './pages/business/Conversations';
import BusinessOrders from './pages/business/Orders';
import BusinessCustomers from './pages/business/Customers';
import BusinessMarketing from './pages/business/Marketing';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'var(--brand-strong)' }}>
      <div style={{ textAlign:'center', color:'white' }}>
        <p style={{ fontSize:18, opacity:0.8 }}>Loading…</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}

function RouteTracker() {
  const location = useLocation();
  React.useEffect(() => { trackPageview(); }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteTracker />
        <WebChatWidget />
        <CookieConsent />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/businesses" element={<ProtectedRoute role="admin"><AdminBusinesses /></ProtectedRoute>} />
          <Route path="/admin/businesses/:id" element={<ProtectedRoute role="admin"><AdminBusinessDetail /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute role="admin"><AdminOrders /></ProtectedRoute>} />
          <Route path="/admin/escalations" element={<ProtectedRoute role="admin"><AdminEscalations /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute role="business"><BusinessDashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute role="business"><BusinessProfile /></ProtectedRoute>} />
          <Route path="/conversations" element={<ProtectedRoute role="business"><BusinessConversations /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute role="business"><BusinessOrders /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute role="business"><BusinessCustomers /></ProtectedRoute>} />
          <Route path="/marketing" element={<ProtectedRoute role="business"><BusinessMarketing /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
