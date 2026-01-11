import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { calculateCompanyProfit } from '../../services/commissionService';
import Layout from '../../components/Layout';
import { BarChart3, Users, ShoppingBag, TrendingUp, DollarSign, Percent } from 'lucide-react';
import './Dashboard.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalCommissions: 0,
    companyProfit: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [users, products, orders] = await Promise.all([
        supabase.from('users').select('id'),
        supabase.from('products').select('id'),
        supabase.from('orders').select('total_amount').eq('payment_status', 'paid'),
      ]);

      const revenue = (orders.data || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

      const profitData = await calculateCompanyProfit();

      setStats({
        totalUsers: users.data?.length || 0,
        totalProducts: products.data?.length || 0,
        totalOrders: orders.data?.length || 0,
        totalRevenue: revenue,
        totalCommissions: profitData.totalCommissionsPaid,
        companyProfit: profitData.companyProfit,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: <Users />,
      color: 'blue',
    },
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: <ShoppingBag />,
      color: 'green',
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: <TrendingUp />,
      color: 'purple',
    },
    {
      title: 'Total Revenue',
      value: `$${stats.totalRevenue.toFixed(2)}`,
      icon: <BarChart3 />,
      color: 'orange',
    },
    {
      title: 'Commissions Paid',
      value: `$${stats.totalCommissions.toFixed(2)}`,
      icon: <Percent />,
      color: 'blue',
    },
    {
      title: 'Company Profit',
      value: `$${stats.companyProfit.toFixed(2)}`,
      icon: <DollarSign />,
      color: 'green',
    },
  ];

  return (
    <Layout title="Admin Dashboard">
      <div className="dashboard-grid">
        {statCards.map((card, idx) => (
          <div key={idx} className={`stat-card ${card.color}`}>
            <div className="stat-icon">{card.icon}</div>
            <div className="stat-content">
              <p className="stat-title">{card.title}</p>
              <p className="stat-value">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-sections">
        <div className="card">
          <h3>User Management</h3>
          <p>Manage user roles and permissions</p>
          <button className="btn btn-primary">Manage Users</button>
        </div>

        <div className="card">
          <h3>Category Management</h3>
          <p>Create and manage product categories</p>
          <button className="btn btn-primary">Manage Categories</button>
        </div>

        <div className="card">
          <h3>Commission Management</h3>
          <p>Configure commission rules and payouts</p>
          <button className="btn btn-primary">Manage Commissions</button>
        </div>

        <div className="card">
          <h3>Reports & Analytics</h3>
          <p>View detailed analytics and reports</p>
          <button className="btn btn-primary">View Reports</button>
        </div>
      </div>
    </Layout>
  );
}
