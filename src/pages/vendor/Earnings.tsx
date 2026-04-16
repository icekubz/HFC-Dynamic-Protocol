import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { DollarSign, TrendingUp, Wallet, Download } from 'lucide-react';
import './ProductManagement.css';

interface EarningsData {
  totalEarnings: number;
  totalOrders: number;
  averageOrderValue: number;
  monthlyEarnings: number;
  withdrawnAmount: number;
}

export default function Earnings() {
  const [earnings, setEarnings] = useState<EarningsData>({
    totalEarnings: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    monthlyEarnings: 0,
    withdrawnAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('vendor_id', user.id);

      const totalEarnings = (orders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const totalOrders = orders?.length || 0;

      setEarnings({
        totalEarnings,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalEarnings / totalOrders : 0,
        monthlyEarnings: totalEarnings * 0.4,
        withdrawnAmount: totalEarnings * 0.2,
      });
    } catch (err) {
      console.error('Error fetching earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Earnings">
      <div className="management-container">
        <div className="management-header">
          <h2><DollarSign /> Earnings</h2>
          <p>View your sales and earnings</p>
        </div>

        {loading ? (
          <p>Loading earnings...</p>
        ) : (
          <>
            <div className="earnings-grid">
              <div className="earnings-card">
                <div className="earnings-icon"><DollarSign /></div>
                <h3>Total Earnings</h3>
                <p className="earnings-value">${earnings.totalEarnings.toFixed(2)}</p>
              </div>

              <div className="earnings-card">
                <div className="earnings-icon"><TrendingUp /></div>
                <h3>Total Orders</h3>
                <p className="earnings-value">{earnings.totalOrders}</p>
              </div>

              <div className="earnings-card">
                <div className="earnings-icon"><Wallet /></div>
                <h3>Average Order Value</h3>
                <p className="earnings-value">${earnings.averageOrderValue.toFixed(2)}</p>
              </div>

              <div className="earnings-card">
                <div className="earnings-icon"><Download /></div>
                <h3>Available for Withdrawal</h3>
                <p className="earnings-value">${(earnings.totalEarnings - earnings.withdrawnAmount).toFixed(2)}</p>
              </div>
            </div>

            <div className="withdraw-section">
              <h3>Withdraw Earnings</h3>
              <input
                type="number"
                placeholder="Enter amount to withdraw"
                className="withdraw-input"
              />
              <button className="btn btn-primary">Withdraw</button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
