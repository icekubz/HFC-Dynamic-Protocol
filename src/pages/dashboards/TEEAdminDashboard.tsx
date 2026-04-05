import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { DollarSign, TrendingUp, Flame, Coins, Settings, Play } from 'lucide-react';
import './Dashboard.css';

interface WalletSystemSettings {
  mint_rate: number;
  withdrawal_burn_rate: number;
  total_minted: number;
  total_burned: number;
  circulating_supply: number;
  burn_fund_fiat: number;
}

interface PlatformLedger {
  period: string;
  total_cv_ingested: number;
  total_commissions_paid: number;
  platform_earning: number;
  burn_fund_allocated: number;
  platform_net_profit: number;
}

export default function TEEAdminDashboard() {
  const [walletSystem, setWalletSystem] = useState<WalletSystemSettings | null>(null);
  const [ledgers, setLedgers] = useState<PlatformLedger[]>([]);
  const [newMintRate, setNewMintRate] = useState('');
  const [newBurnRate, setNewBurnRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: walletSystemData } = await supabase
        .from('tee_tokenomics')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (walletSystemData) {
        setWalletSystem({
          mint_rate: parseFloat(walletSystemData.mint_rate),
          withdrawal_burn_rate: parseFloat(walletSystemData.withdrawal_burn_rate),
          total_minted: parseFloat(walletSystemData.total_minted),
          total_burned: parseFloat(walletSystemData.total_burned),
          circulating_supply: parseFloat(walletSystemData.circulating_supply),
          burn_fund_fiat: parseFloat(walletSystemData.burn_fund_fiat)
        });
        setNewMintRate(walletSystemData.mint_rate);
        setNewBurnRate(walletSystemData.withdrawal_burn_rate);
      }

      const { data: ledgerData } = await supabase
        .from('tee_platform_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(12);

      if (ledgerData) {
        setLedgers(ledgerData.map(l => ({
          period: l.period,
          total_cv_ingested: parseFloat(l.total_cv_ingested),
          total_commissions_paid: parseFloat(l.total_commissions_paid),
          platform_earning: parseFloat(l.platform_earning),
          burn_fund_allocated: parseFloat(l.burn_fund_allocated),
          platform_net_profit: parseFloat(l.platform_net_profit)
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMintRate = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: walletSystemData } = await supabase
        .from('tee_tokenomics')
        .select('id')
        .limit(1)
        .single();

      if (walletSystemData) {
        await supabase
          .from('tee_tokenomics')
          .update({
            mint_rate: parseFloat(newMintRate),
            updated_by: user.user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', walletSystemData.id);

        alert('Mint rate updated successfully!');
        fetchData();
      }
    } catch (error) {
      console.error('Error updating mint rate:', error);
      alert('Failed to update mint rate');
    }
  };

  const updateBurnRate = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: walletSystemData } = await supabase
        .from('tee_tokenomics')
        .select('id')
        .limit(1)
        .single();

      if (walletSystemData) {
        await supabase
          .from('tee_tokenomics')
          .update({
            withdrawal_burn_rate: parseFloat(newBurnRate),
            updated_by: user.user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', walletSystemData.id);

        alert('Withdrawal burn rate updated successfully!');
        fetchData();
      }
    } catch (error) {
      console.error('Error updating burn rate:', error);
      alert('Failed to update burn rate');
    }
  };

  const runMonthlyBatch = async () => {
    if (!confirm('Are you sure you want to run the monthly commission batch? This will process all unprocessed orders.')) {
      return;
    }

    setProcessing(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/tee-engine-run-batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const result = await response.json();

      if (result.success) {
        alert(`Batch processing completed!\n\nBatch ID: ${result.batch_id}\nTotal CV: $${result.total_cv.toFixed(2)}\nCommissions Paid: $${result.total_commissions_paid.toFixed(2)}\nPlatform Earning: $${result.platform_earning.toFixed(2)}`);
        fetchData();
      } else {
        alert(`Batch processing failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error running batch:', error);
      alert('Failed to run batch processing');
    } finally {
      setProcessing(false);
    }
  };

  const totalRevenue = ledgers.reduce((sum, l) => sum + l.total_cv_ingested, 0);
  const totalCommissions = ledgers.reduce((sum, l) => sum + l.total_commissions_paid, 0);
  const totalProfit = ledgers.reduce((sum, l) => sum + l.platform_net_profit, 0);

  if (loading) {
    return (
      <Layout title="TEE Admin Dashboard">
        <div className="loading">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout title="TEE Admin Dashboard - Thy Essential Engine">
      <div className="dashboard-header">
        <h1>CEO Control Panel</h1>
        <button
          className="btn btn-primary"
          onClick={runMonthlyBatch}
          disabled={processing}
        >
          <Play size={20} />
          {processing ? 'Processing...' : 'Run Monthly Batch'}
        </button>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3><Settings size={20} /> Dynamic Settings</h3>
          <div style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label>Mint Rate (tokens per $1 CV)</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <input
                  type="number"
                  value={newMintRate}
                  onChange={(e) => setNewMintRate(e.target.value)}
                  step="0.1"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={updateMintRate}>
                  Update
                </button>
              </div>
              <small style={{ color: '#666', fontSize: '12px' }}>
                Current: {walletSystem?.mint_rate} HFC per $1
              </small>
            </div>

            <div>
              <label>Withdrawal Burn Rate (%)</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <input
                  type="number"
                  value={newBurnRate}
                  onChange={(e) => setNewBurnRate(e.target.value)}
                  step="0.1"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={updateBurnRate}>
                  Update
                </button>
              </div>
              <small style={{ color: '#666', fontSize: '12px' }}>
                Current: {walletSystem?.withdrawal_burn_rate}% fee
              </small>
            </div>
          </div>
        </div>

        <div className="card">
          <h3><Flame size={20} /> Internal Wallet System</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">Total Minted</div>
              <div className="stat-value">{walletSystem?.total_minted.toFixed(2)} HFC</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Total Burned</div>
              <div className="stat-value">{walletSystem?.total_burned.toFixed(2)} HFC</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Circulating Supply</div>
              <div className="stat-value">{walletSystem?.circulating_supply.toFixed(2)} HFC</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Burn Fund (Fiat)</div>
              <div className="stat-value">${walletSystem?.burn_fund_fiat.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#4CAF50' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Revenue Ingested</div>
            <div className="stat-value">${totalRevenue.toFixed(2)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#2196F3' }}>
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Commissions Paid</div>
            <div className="stat-value">${totalCommissions.toFixed(2)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FF9800' }}>
            <Flame size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Burn Fund</div>
            <div className="stat-value">${walletSystem?.burn_fund_fiat.toFixed(2)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#9C27B0' }}>
            <Coins size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Platform Net Profit</div>
            <div className="stat-value">${totalProfit.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Financial Ledger (Last 12 Periods)</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Total CV Ingested</th>
                <th>Commissions Paid (75%)</th>
                <th>Platform Earning (25%)</th>
                <th>Burn Fund (12.5%)</th>
                <th>Net Profit (12.5%)</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                    No ledger entries yet. Run a batch to generate data.
                  </td>
                </tr>
              ) : (
                ledgers.map((ledger) => (
                  <tr key={ledger.period}>
                    <td>{ledger.period}</td>
                    <td>${ledger.total_cv_ingested.toFixed(2)}</td>
                    <td>${ledger.total_commissions_paid.toFixed(2)}</td>
                    <td>${ledger.platform_earning.toFixed(2)}</td>
                    <td>${ledger.burn_fund_allocated.toFixed(2)}</td>
                    <td>${ledger.platform_net_profit.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
