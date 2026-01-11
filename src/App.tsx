import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import ConsumerDashboard from './pages/dashboards/ConsumerDashboard';
import VendorDashboard from './pages/dashboards/VendorDashboard';
import AffiliateDashboard from './pages/dashboards/AffiliateDashboard';
import Marketplace from './pages/Marketplace';
import ProductManagement from './pages/vendor/ProductManagement';
import AffiliateLinks from './pages/affiliate/AffiliateLinks';
import PackageSelection from './pages/affiliate/PackageSelection';

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const { isAuthenticated, roles, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (requiredRole && !roles.includes(requiredRole as any)) return <Navigate to="/" />;

  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/marketplace" /> : <Navigate to="/login" />
          }
        />

        <Route
          path="/marketplace"
          element={
            <ProtectedRoute>
              <Marketplace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/consumer/*"
          element={
            <ProtectedRoute requiredRole="consumer">
              <ConsumerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vendor"
          element={
            <ProtectedRoute requiredRole="vendor">
              <VendorDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vendor/products"
          element={
            <ProtectedRoute requiredRole="vendor">
              <ProductManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/affiliate"
          element={
            <ProtectedRoute requiredRole="affiliate">
              <AffiliateDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/affiliate/links"
          element={
            <ProtectedRoute requiredRole="affiliate">
              <AffiliateLinks />
            </ProtectedRoute>
          }
        />

        <Route
          path="/affiliate/packages"
          element={
            <ProtectedRoute requiredRole="affiliate">
              <PackageSelection />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
