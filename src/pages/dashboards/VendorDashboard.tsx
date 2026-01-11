import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';
import Layout from '../../components/Layout';
import { ShoppingBag, TrendingUp, Wallet, BarChart3 } from 'lucide-react';
import './Dashboard.css';

export default function VendorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSales: 0,
    totalEarnings: 0,
    orders: 0,
  });

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', user?.id);

      setProducts(productData || []);

      const { data: orderData } = await supabase
        .from('order_items')
        .select('subtotal, quantity')
        .eq('vendor_id', user?.id);

      const totalSales = (orderData || []).reduce((sum, o) => sum + (o.subtotal || 0), 0);

      const { data: commissionData } = await supabase
        .from('commissions')
        .select('amount')
        .eq('user_id', user?.id)
        .eq('commission_type', 'vendor_sale')
        .eq('status', 'earned');

      const totalEarnings = (commissionData || []).reduce((sum, c) => sum + (c.amount || 0), 0);

      setStats({
        totalProducts: productData?.length || 0,
        totalSales,
        totalEarnings,
        orders: orderData?.length || 0,
      });
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const statCards = [
    {
      title: 'Products',
      value: stats.totalProducts,
      icon: <ShoppingBag />,
      color: 'blue',
    },
    {
      title: 'Total Sales',
      value: `$${stats.totalSales.toFixed(2)}`,
      icon: <TrendingUp />,
      color: 'green',
    },
    {
      title: 'Orders',
      value: stats.orders,
      icon: <BarChart3 />,
      color: 'purple',
    },
    {
      title: 'Earnings',
      value: `$${stats.totalEarnings.toFixed(2)}`,
      icon: <Wallet />,
      color: 'orange',
    },
  ];

  return (
    <Layout title="Vendor Dashboard">
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
          <h3>Add New Product</h3>
          <p>Add new products or services to your store</p>
          <button onClick={() => navigate('/vendor/products')} className="btn btn-primary">+ Add Product</button>
        </div>

        <div className="card">
          <h3>Manage Products</h3>
          <p>Edit, delete, or manage your products</p>
          <button onClick={() => navigate('/vendor/products')} className="btn btn-primary">Manage Products</button>
        </div>

        <div className="card">
          <h3>Orders</h3>
          <p>View and manage customer orders</p>
          <button onClick={() => navigate('/vendor/orders')} className="btn btn-primary">View Orders</button>
        </div>

        <div className="card">
          <h3>Earnings & Payouts</h3>
          <p>Track your earnings and request payouts</p>
          <button onClick={() => navigate('/vendor/earnings')} className="btn btn-primary">View Earnings</button>
        </div>
      </div>
    </Layout>
  );
}
