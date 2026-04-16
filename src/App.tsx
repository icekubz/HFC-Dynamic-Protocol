import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import ConsumerDashboard from './pages/dashboards/ConsumerDashboard';
import VendorDashboard from './pages/dashboards/VendorDashboard';
import AffiliateDashboard from './pages/dashboards/AffiliateDashboard';
import TEEAdminDashboard from './pages/dashboards/TEEAdminDashboard';
import TEEAffiliateDashboard from './pages/dashboards/TEEAffiliateDashboard';
import Marketplace from './pages/Marketplace';
import ProductManagement from './pages/vendor/ProductManagement';
import AffiliateLinks from './pages/affiliate/AffiliateLinks';
import PackageSelection from './pages/affiliate/PackageSelection';
import UserManagement from './pages/admin/UserManagement';
import CategoryManagement from './pages/admin/CategoryManagement';
import CommissionManagement from './pages/admin/CommissionManagement';
import Reports from './pages/admin/Reports';
import EditProfile from './pages/consumer/EditProfile';
import OrderHistory from './pages/consumer/OrderHistory';
import Referrals from './pages/consumer/Referrals';
import OrderManagement from './pages/vendor/OrderManagement';
import Earnings from './pages/vendor/Earnings';
import BinaryTree from './pages/affiliate/BinaryTree';
import CommissionHistory from './pages/affiliate/CommissionHistory';

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

        <Route path="/" element={<Marketplace />} />
        <Route path="/marketplace" element={<Marketplace />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/categories"
          element={
            <ProtectedRoute requiredRole="admin">
              <CategoryManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/commissions"
          element={
            <ProtectedRoute requiredRole="admin">
              <CommissionManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute requiredRole="admin">
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/consumer"
          element={
            <ProtectedRoute requiredRole="consumer">
              <ConsumerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/consumer/edit"
          element={
            <ProtectedRoute requiredRole="consumer">
              <EditProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/consumer/orders"
          element={
            <ProtectedRoute requiredRole="consumer">
              <OrderHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/consumer/referrals"
          element={
            <ProtectedRoute requiredRole="consumer">
              <Referrals />
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
          path="/vendor/orders"
          element={
            <ProtectedRoute requiredRole="vendor">
              <OrderManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vendor/earnings"
          element={
            <ProtectedRoute requiredRole="vendor">
              <Earnings />
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

        <Route
          path="/affiliate/tree"
          element={
            <ProtectedRoute requiredRole="affiliate">
              <BinaryTree />
            </ProtectedRoute>
          }
        />

        <Route
          path="/affiliate/commissions"
          element={
            <ProtectedRoute requiredRole="affiliate">
              <CommissionHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tee/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <TEEAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tee/affiliate"
          element={
            <ProtectedRoute>
              <TEEAffiliateDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
