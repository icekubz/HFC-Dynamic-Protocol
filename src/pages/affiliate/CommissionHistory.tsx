import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { History, TrendingUp } from 'lucide-react';
import './PackageSelection.css';

interface CommissionRecord {
  id: string;
  amount: number;
  type: string;
  created_at: string;
  description: string;
}

export default function CommissionHistory() {
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEarned: 0,
    thisMonth: 0,
    pending: 0,
  });

  useEffect(() => {
    fetchCommissions();
  }, []);

  const fetchCommissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('commission_history')
        .select('*')
        .eq('affiliate_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        const totalEarned = data.reduce((sum, c) => sum + (c.amount || 0), 0);
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonth = data
          .filter((c) => new Date(c.created_at) >= monthStart)
          .reduce((sum, c) => sum + (c.amount || 0), 0);

        setCommissions(data);
        setStats({
          totalEarned,
          thisMonth,
          pending: totalEarned * 0.1,
        });
      }
    } catch (err) {
      console.error('Error fetching commissions:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Commission History">
      <div className="management-container">
        <div className="management-header">
          <h2><History /> Commission History</h2>
          <p>Track all your earned commissions</p>
        </div>

        {loading ? (
          <p>Loading history...</p>
        ) : (
          <>
            <div className="commission-stats">
              <div className="stat-box">
                <h4><TrendingUp size={16} /> Total Earned</h4>
                <p className="amount">${stats.totalEarned.toFixed(2)}</p>
              </div>
              <div className="stat-box">
                <h4>This Month</h4>
                <p className="amount">${stats.thisMonth.toFixed(2)}</p>
              </div>
              <div className="stat-box">
                <h4>Pending Payout</h4>
                <p className="amount">${stats.pending.toFixed(2)}</p>
              </div>
            </div>

            {commissions.length === 0 ? (
              <p>No commission history</p>
            ) : (
              <div className="table-container">
                <table className="management-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Description</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((commission) => (
                      <tr key={commission.id}>
                        <td>{commission.type}</td>
                        <td className="amount-cell">${commission.amount.toFixed(2)}</td>
                        <td>{commission.description}</td>
                        <td>{new Date(commission.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
