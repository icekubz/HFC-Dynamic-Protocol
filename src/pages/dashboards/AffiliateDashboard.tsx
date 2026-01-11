import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getUserPackage, getUserTreePosition, getDownlineCount } from '../../services/binaryTreeService';
import Layout from '../../components/Layout';
import { Users, TrendingUp, Wallet, Network, Package } from 'lucide-react';
import './Dashboard.css';

export default function AffiliateDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCommissions: 0,
    referrals: 0,
    earnings: 0,
    pendingPayouts: 0,
    leftLeg: 0,
    rightLeg: 0,
    leftVolume: 0,
    rightVolume: 0,
  });
  const [packageName, setPackageName] = useState<string>('None');
  const [hasPackage, setHasPackage] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const [commissionData, treePosition, downlineCount, userPackage] = await Promise.all([
        supabase
          .from('commission_transactions')
          .select('amount, status')
          .eq('affiliate_id', user?.id),
        getUserTreePosition(user?.id || ''),
        getDownlineCount(user?.id || ''),
        getUserPackage(user?.id || ''),
      ]);

      const totalCommissions = commissionData.data?.length || 0;
      const earned = (commissionData.data || [])
        .filter(c => c.status === 'paid' || c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      const pending = (commissionData.data || [])
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      setStats({
        totalCommissions,
        referrals: totalCommissions,
        earnings: earned,
        pendingPayouts: pending,
        leftLeg: downlineCount.left,
        rightLeg: downlineCount.right,
        leftVolume: treePosition?.left_sales_volume || 0,
        rightVolume: treePosition?.right_sales_volume || 0,
      });

      if (userPackage) {
        setPackageName(userPackage.name);
        setHasPackage(true);
      } else {
        setHasPackage(false);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const statCards = [
    {
      title: 'Current Package',
      value: packageName,
      icon: <Package />,
      color: 'blue',
    },
    {
      title: 'Left Leg',
      value: `${stats.leftLeg} / $${stats.leftVolume.toFixed(0)}`,
      icon: <Network />,
      color: 'green',
    },
    {
      title: 'Right Leg',
      value: `${stats.rightLeg} / $${stats.rightVolume.toFixed(0)}`,
      icon: <Network />,
      color: 'green',
    },
    {
      title: 'Total Earnings',
      value: `$${stats.earnings.toFixed(2)}`,
      icon: <TrendingUp />,
      color: 'orange',
    },
  ];

  return (
    <Layout title="Affiliate Dashboard">
      {!hasPackage && (
        <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid #f59e0b' }}>
          <strong>Get Started:</strong> You need to select an affiliate package to start earning commissions.
          <button onClick={() => navigate('/affiliate/packages')} className="btn btn-primary" style={{ marginLeft: '1rem' }}>
            Choose Package
          </button>
        </div>
      )}

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
          <h3>Affiliate Package</h3>
          <p>{hasPackage ? `Current plan: ${packageName}` : 'Choose your commission plan'}</p>
          <button onClick={() => navigate('/affiliate/packages')} className="btn btn-primary">
            {hasPackage ? 'Upgrade Package' : 'Select Package'}
          </button>
        </div>

        <div className="card">
          <h3>Generate Affiliate Links</h3>
          <p>Create unique referral links for any product</p>
          <button onClick={() => navigate('/affiliate/links')} className="btn btn-primary">
            Manage Links
          </button>
        </div>

        <div className="card">
          <h3>Binary Tree Network</h3>
          <p>View your binary tree structure and downline</p>
          <button onClick={() => navigate('/affiliate/tree')} className="btn btn-primary">
            View Tree
          </button>
        </div>

        <div className="card">
          <h3>Commission History</h3>
          <p>View detailed commission transactions</p>
          <button onClick={() => navigate('/affiliate/commissions')} className="btn btn-primary">
            View History
          </button>
        </div>
      </div>
    </Layout>
  );
}
