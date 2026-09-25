import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import WebChatWidget from './components/WebChatWidget';
import Login from './pages/Login';
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <WebChatWidget />
        <Routes>
          <Route path="/login" element={<Login />} />
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
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
