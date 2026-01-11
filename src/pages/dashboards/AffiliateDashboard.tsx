import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';
import Layout from '../../components/Layout';
import { Users, TrendingUp, Wallet, Share2 } from 'lucide-react';
import './Dashboard.css';

export default function AffiliateDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCommissions: 0,
    referrals: 0,
    earnings: 0,
    pendingPayouts: 0,
  });

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const { data: commissionData } = await supabase
        .from('commissions')
        .select('amount, status')
        .eq('user_id', user?.id)
        .eq('commission_type', 'affiliate_referral');

      const totalCommissions = commissionData?.length || 0;
      const earned = (commissionData || [])
        .filter(c => c.status === 'earned')
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      const pending = (commissionData || [])
        .filter(c => c.status === 'pending_payout')
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      setStats({
        totalCommissions,
        referrals: totalCommissions,
        earnings: earned,
        pendingPayouts: pending,
      });
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const statCards = [
    {
      title: 'Total Referrals',
      value: stats.referrals,
      icon: <Users />,
      color: 'blue',
    },
    {
      title: 'Commissions Earned',
      value: `$${stats.earnings.toFixed(2)}`,
      icon: <TrendingUp />,
      color: 'green',
    },
    {
      title: 'Pending Payouts',
      value: `$${stats.pendingPayouts.toFixed(2)}`,
      icon: <Wallet />,
      color: 'purple',
    },
  ];

  return (
    <Layout title="Affiliate Dashboard">
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
          <h3>Generate Affiliate Links</h3>
          <p>Create unique referral links for any product</p>
          <button onClick={() => navigate('/affiliate/links')} className="btn btn-primary">
            Manage Links
          </button>
        </div>

        <div className="card">
          <h3>Commission Structure</h3>
          <p>Earn 5-15% on each referral sale using HFC dynamics</p>
          <button onClick={() => navigate('/affiliate/commissions')} className="btn btn-primary">
            View Details
          </button>
        </div>

        <div className="card">
          <h3>Track Referrals</h3>
          <p>Monitor your referral performance</p>
          <button onClick={() => navigate('/affiliate/analytics')} className="btn btn-primary">
            View Analytics
          </button>
        </div>

        <div className="card">
          <h3>Request Payout</h3>
          <p>Withdraw your earnings</p>
          <button onClick={() => navigate('/affiliate/payouts')} className="btn btn-secondary">
            Request Payout
          </button>
        </div>
      </div>
    </Layout>
  );
}
