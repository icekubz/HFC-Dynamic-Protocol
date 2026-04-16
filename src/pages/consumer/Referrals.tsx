import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { Users, Copy, CheckCircle } from 'lucide-react';
import '../dashboards/Dashboard.css';

interface Referral {
  id: string;
  referred_email: string;
  created_at: string;
  commission_earned: number;
}

export default function Referrals() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .maybeSingle();

      if (userData) {
        setReferralCode(userData.referral_code || '');
      }

      const { data: refData } = await supabase
        .from('affiliate_tracking')
        .select('*')
        .eq('referrer_id', user.id);

      setReferrals(refData || []);
    } catch (err) {
      console.error('Error fetching referrals:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout title="Referral Program">
      <div className="management-container">
        <div className="management-header">
          <h2><Users /> Referral Program</h2>
          <p>Earn commissions by referring friends</p>
        </div>

        {loading ? (
          <p>Loading referrals...</p>
        ) : (
          <>
            <div className="settings-form">
              <div className="form-group">
                <label>Your Referral Code</label>
                <div className="copy-group">
                  <input type="text" value={referralCode} disabled />
                  <button onClick={copyReferralLink} className="btn btn-primary">
                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </div>

            <h3>Your Referrals</h3>
            {referrals.length === 0 ? (
              <p>No referrals yet. Share your link to earn commissions!</p>
            ) : (
              <div className="table-container">
                <table className="management-table">
                  <thead>
                    <tr>
                      <th>Referred Email</th>
                      <th>Commission</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((ref) => (
                      <tr key={ref.id}>
                        <td>{ref.referred_email}</td>
                        <td>${ref.commission_earned.toFixed(2)}</td>
                        <td>{new Date(ref.created_at).toLocaleDateString()}</td>
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
