import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { DollarSign, Link as LinkIcon, Coins, TrendingUp, Download, Copy, Users } from 'lucide-react';
import './Dashboard.css';

interface AffiliateData {
  id: string;
  email: string;
  full_name: string;
  referral_code: string;
}

interface WalletData {
  balance_self: number;
  balance_direct: number;
  balance_passive: number;
  total_earned: number;
  total_withdrawn: number;
  hfc_token_balance: number;
}

interface TreePosition {
  position: string;
  level: number;
  parent_id: string | null;
}

export default function TEEAffiliateDashboard() {
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [treePosition, setTreePosition] = useState<TreePosition | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchAffiliateData();
  }, []);

  const fetchAffiliateData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: affiliateData } = await supabase
        .from('tee_affiliates')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (affiliateData) {
        setAffiliate(affiliateData);

        const { data: walletData } = await supabase
          .from('tee_wallets')
          .select('*')
          .eq('affiliate_id', affiliateData.id)
          .maybeSingle();

        if (walletData) {
          setWallet({
            balance_self: parseFloat(walletData.balance_self) || 0,
            balance_direct: parseFloat(walletData.balance_direct) || 0,
            balance_passive: parseFloat(walletData.balance_passive) || 0,
            total_earned: parseFloat(walletData.total_earned) || 0,
            total_withdrawn: parseFloat(walletData.total_withdrawn) || 0,
            hfc_token_balance: parseFloat(walletData.hfc_token_balance) || 0
          });
        }

        const { data: treeData } = await supabase
          .from('tee_binary_tree')
          .select('position, level, parent_id')
          .eq('affiliate_id', affiliateData.id)
          .maybeSingle();

        if (treeData) {
          setTreePosition(treeData);
        }
      }
    } catch (error) {
      console.error('Error fetching affiliate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (!affiliate) return;
    const referralLink = `${window.location.origin}/register?ref=${affiliate.referral_code}`;
    navigator.clipboard.writeText(referralLink);
    alert('Referral link copied to clipboard!');
  };

  const processWithdrawal = async () => {
    if (!affiliate || !withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Please enter a valid withdrawal amount');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    const totalBalance = (wallet?.balance_self || 0) + (wallet?.balance_direct || 0) + (wallet?.balance_passive || 0);

    if (amount > totalBalance) {
      alert(`Insufficient balance. Available: $${totalBalance.toFixed(2)}`);
      return;
    }

    if (!confirm(`Withdraw $${amount.toFixed(2)}?\n\nNote: A dynamic burn fee will be applied.`)) {
      return;
    }

    setProcessing(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/tee-withdraw`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          affiliateId: affiliate.id,
          amountRequested: amount
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Withdrawal successful!\n\nRequested: $${result.amount_requested.toFixed(2)}\nBurn Fee: $${result.burn_fee.toFixed(2)}\nNet Paid: $${result.amount_paid.toFixed(2)}\nTokens Burned: ${result.tokens_burned.toFixed(2)} HFC`);
        setWithdrawAmount('');
        fetchAffiliateData();
      } else {
        alert(`Withdrawal failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      alert('Failed to process withdrawal');
    } finally {
      setProcessing(false);
    }
  };

  const totalBalance = (wallet?.balance_self || 0) + (wallet?.balance_direct || 0) + (wallet?.balance_passive || 0);

  if (loading) {
    return (
      <Layout title="Affiliate Portal">
        <div className="loading">Loading...</div>
      </Layout>
    );
  }

  if (!affiliate) {
    return (
      <Layout title="Affiliate Portal">
        <div className="card">
          <h3>Not Registered</h3>
          <p>You are not registered as an affiliate yet.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Affiliate Portal - TEE">
      <div className="dashboard-header">
        <div>
          <h1>Welcome, {affiliate.full_name}</h1>
          <p style={{ color: '#666', marginTop: '5px' }}>{affiliate.email}</p>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#4CAF50' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Self Commission</div>
            <div className="stat-value">${wallet?.balance_self.toFixed(2)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#2196F3' }}>
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Direct Commission</div>
            <div className="stat-value">${wallet?.balance_direct.toFixed(2)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FF9800' }}>
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Passive Commission</div>
            <div className="stat-value">${wallet?.balance_passive.toFixed(2)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#9C27B0' }}>
            <Coins size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">HFC Token Balance</div>
            <div className="stat-value">{wallet?.hfc_token_balance.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3><LinkIcon size={20} /> API Referral Link</h3>
          <div style={{ marginTop: '20px' }}>
            <label>Your Referral Code</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <input
                type="text"
                value={affiliate.referral_code}
                readOnly
                style={{ flex: 1, background: '#f5f5f5' }}
              />
              <button className="btn btn-secondary" onClick={copyReferralLink}>
                <Copy size={16} />
                Copy Link
              </button>
            </div>
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '8px' }}>
              Share this link to earn commissions from referrals
            </small>
          </div>

          <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Tree Position</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
              <div>
                <strong>Position:</strong> {treePosition?.position || 'N/A'}
              </div>
              <div>
                <strong>Level:</strong> {treePosition?.level || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3><Download size={20} /> Withdraw Fiat</h3>
          <div style={{ marginTop: '20px' }}>
            <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Available Balance:</span>
                <strong>${totalBalance.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666' }}>
                <span>Total Earned:</span>
                <span>${wallet?.total_earned.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666' }}>
                <span>Total Withdrawn:</span>
                <span>${wallet?.total_withdrawn.toFixed(2)}</span>
              </div>
            </div>

            <label>Withdrawal Amount ($)</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount"
                step="0.01"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={processWithdrawal}
                disabled={processing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
              >
                {processing ? 'Processing...' : 'Withdraw'}
              </button>
            </div>
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '8px' }}>
              A dynamic burn fee will be deducted from your withdrawal
            </small>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Earnings Breakdown</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Commission Type</th>
                <th>Balance</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Self Commission (10%)</strong></td>
                <td>${wallet?.balance_self.toFixed(2)}</td>
                <td>Earned from your personal purchases</td>
              </tr>
              <tr>
                <td><strong>Direct Commission (15%)</strong></td>
                <td>${wallet?.balance_direct.toFixed(2)}</td>
                <td>Earned from direct referrals' purchases</td>
              </tr>
              <tr>
                <td><strong>Passive Commission (50%)</strong></td>
                <td>${wallet?.balance_passive.toFixed(2)}</td>
                <td>Earned from downline network (divided by depth)</td>
              </tr>
              <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                <td>Total Available</td>
                <td>${totalBalance.toFixed(2)}</td>
                <td>Ready for withdrawal</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
