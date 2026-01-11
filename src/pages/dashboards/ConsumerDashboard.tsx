import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';
import Layout from '../../components/Layout';
import { ShoppingBag, TrendingUp, Wallet, User } from 'lucide-react';
import './Dashboard.css';

export default function ConsumerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    totalEarnings: 0,
  });

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user?.id);

      setOrders(orderData || []);

      const totalSpent = (orderData || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

      const { data: commissionData } = await supabase
        .from('commissions')
        .select('amount')
        .eq('user_id', user?.id)
        .eq('status', 'earned');

      const totalEarnings = (commissionData || []).reduce((sum, c) => sum + (c.amount || 0), 0);

      setStats({
        totalOrders: orderData?.length || 0,
        totalSpent,
        totalEarnings,
      });
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const statCards = [
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: <ShoppingBag />,
      color: 'blue',
    },
    {
      title: 'Total Spent',
      value: `$${stats.totalSpent.toFixed(2)}`,
      icon: <Wallet />,
      color: 'green',
    },
    {
      title: 'Earnings',
      value: `$${stats.totalEarnings.toFixed(2)}`,
      icon: <TrendingUp />,
      color: 'purple',
    },
  ];

  return (
    <Layout title="My Account">
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
          <h3>Profile Information</h3>
          <p className="stat-title">Name: {user?.full_name}</p>
          <p className="stat-title">Email: {user?.email}</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Edit Profile
          </button>
        </div>

        <div className="card">
          <h3>Purchase History</h3>
          <p>View your complete order history</p>
          <button className="btn btn-primary">View Orders</button>
        </div>

        <div className="card">
          <h3>Referral Program</h3>
          <p>Earn commissions by referring friends</p>
          <button className="btn btn-primary">Manage Referrals</button>
        </div>

        <div className="card">
          <h3>Become a Vendor</h3>
          <p>Start selling your products on our platform</p>
          <button className="btn btn-secondary">Apply as Vendor</button>
        </div>
      </div>
    </Layout>
  );
}
