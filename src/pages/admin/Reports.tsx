import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { BarChart3, LineChart, TrendingUp, DollarSign } from 'lucide-react';
import '../dashboards/Dashboard.css';

interface ReportData {
  totalRevenue: number;
  totalOrders: number;
  totalUsers: number;
  totalAffiliates: number;
  totalCommissions: number;
}

export default function Reports() {
  const [reportData, setReportData] = useState<ReportData>({
    totalRevenue: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalAffiliates: 0,
    totalCommissions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      const [users, orders, affiliates] = await Promise.all([
        supabase.from('users').select('id').eq('user_role', 'consumer'),
        supabase.from('orders').select('total_amount'),
        supabase.from('users').select('id').eq('user_role', 'affiliate'),
      ]);

      const totalRevenue = (orders.data || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

      setReportData({
        totalRevenue,
        totalOrders: orders.data?.length || 0,
        totalUsers: users.data?.length || 0,
        totalAffiliates: affiliates.data?.length || 0,
        totalCommissions: totalRevenue * 0.1,
      });
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Reports & Analytics">
      <div className="management-container">
        <div className="management-header">
          <h2><BarChart3 /> Reports & Analytics</h2>
          <p>View detailed analytics and performance metrics</p>
        </div>

        {loading ? (
          <p>Loading reports...</p>
        ) : (
          <div className="dashboard-grid">
            <div className="stat-card blue">
              <div className="stat-icon"><TrendingUp /></div>
              <div className="stat-content">
                <p className="stat-title">Total Revenue</p>
                <p className="stat-value">${reportData.totalRevenue.toFixed(2)}</p>
              </div>
            </div>

            <div className="stat-card green">
              <div className="stat-icon"><LineChart /></div>
              <div className="stat-content">
                <p className="stat-title">Total Orders</p>
                <p className="stat-value">{reportData.totalOrders}</p>
              </div>
            </div>

            <div className="stat-card orange">
              <div className="stat-icon"><BarChart3 /></div>
              <div className="stat-content">
                <p className="stat-title">Total Users</p>
                <p className="stat-value">{reportData.totalUsers}</p>
              </div>
            </div>

            <div className="stat-card purple">
              <div className="stat-icon"><DollarSign /></div>
              <div className="stat-content">
                <p className="stat-title">Total Affiliates</p>
                <p className="stat-value">{reportData.totalAffiliates}</p>
              </div>
            </div>

            <div className="stat-card blue">
              <div className="stat-icon"><TrendingUp /></div>
              <div className="stat-content">
                <p className="stat-title">Total Commissions</p>
                <p className="stat-value">${reportData.totalCommissions.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
