import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { Percent, Save, FileEdit as Edit2 } from 'lucide-react';
import '../dashboards/Dashboard.css';

interface TokenomicsSettings {
  mint_rate: number;
  withdrawal_burn_rate: number;
  burn_fund_fiat: number;
}

export default function CommissionManagement() {
  const [tokenomics, setTokenomics] = useState<TokenomicsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    mint_rate: 10.0,
    withdrawal_burn_rate: 5.0,
  });

  useEffect(() => {
    fetchTokenomics();
  }, []);

  const fetchTokenomics = async () => {
    try {
      const { data } = await supabase
        .from('tee_tokenomics')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setTokenomics({
          mint_rate: parseFloat(data.mint_rate),
          withdrawal_burn_rate: parseFloat(data.withdrawal_burn_rate),
          burn_fund_fiat: parseFloat(data.burn_fund_fiat),
        });
        setFormData({
          mint_rate: parseFloat(data.mint_rate),
          withdrawal_burn_rate: parseFloat(data.withdrawal_burn_rate),
        });
      }
    } catch (err) {
      console.error('Error fetching tokenomics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: settings } = await supabase
        .from('tee_tokenomics')
        .select('id')
        .limit(1)
        .single();

      if (settings) {
        await supabase
          .from('tee_tokenomics')
          .update({
            mint_rate: formData.mint_rate,
            withdrawal_burn_rate: formData.withdrawal_burn_rate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);

        alert('Commission settings updated successfully');
        setIsEditing(false);
        fetchTokenomics();
      }
    } catch (err) {
      console.error('Error saving tokenomics:', err);
      alert('Failed to save commission settings');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (tokenomics) {
      setFormData({
        mint_rate: tokenomics.mint_rate,
        withdrawal_burn_rate: tokenomics.withdrawal_burn_rate,
      });
    }
  };

  return (
    <Layout title="Commission Management">
      <div className="management-container">
        <div className="management-header">
          <h2><Percent /> Commission Management</h2>
          <p>Configure TEE platform commission structure</p>
        </div>

        {loading ? (
          <p>Loading configuration...</p>
        ) : (
          <div className="commission-management">
            <div className="commission-structure">
              <div className="structure-section">
                <h3>Affiliate Commission Breakdown</h3>
                <div className="commission-items">
                  <div className="commission-item">
                    <div className="item-label">Self Commission</div>
                    <div className="item-value">10%</div>
                    <div className="item-description">10% of personal CV ingested</div>
                  </div>
                  <div className="commission-item">
                    <div className="item-label">Direct Commission</div>
                    <div className="item-value">15%</div>
                    <div className="item-description">15% of direct referral CV</div>
                  </div>
                  <div className="commission-item">
                    <div className="item-label">Passive Commission</div>
                    <div className="item-value">50% ÷ Depth</div>
                    <div className="item-description">50% of downline CV divided by max(5, actual depth)</div>
                  </div>
                  <div className="commission-item">
                    <div className="item-label">Platform Fees</div>
                    <div className="item-value">25%</div>
                    <div className="item-description">12.5% burn fund + 12.5% net profit</div>
                  </div>
                </div>
              </div>

              <div className="structure-section">
                <h3>Tokenomics Configuration</h3>
                {isEditing ? (
                  <div className="settings-form">
                    <div className="form-group">
                      <label>Mint Rate (tokens per CV)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.mint_rate}
                        onChange={(e) => setFormData({ ...formData, mint_rate: parseFloat(e.target.value) })}
                      />
                      <small>Number of tokens minted for each CV ingested</small>
                    </div>

                    <div className="form-group">
                      <label>Withdrawal Burn Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.withdrawal_burn_rate}
                        onChange={(e) => setFormData({ ...formData, withdrawal_burn_rate: parseFloat(e.target.value) })}
                      />
                      <small>Percentage of withdrawal amount to burn and add to burn fund</small>
                    </div>

                    <div className="form-actions">
                      <button onClick={handleSave} className="btn btn-primary">
                        <Save size={16} /> Save Settings
                      </button>
                      <button onClick={handleCancel} className="btn btn-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="tokenomics-display">
                    <div className="tokenomics-item">
                      <span className="label">Mint Rate:</span>
                      <span className="value">{tokenomics?.mint_rate.toFixed(2)} tokens per CV</span>
                    </div>
                    <div className="tokenomics-item">
                      <span className="label">Withdrawal Burn Rate:</span>
                      <span className="value">{tokenomics?.withdrawal_burn_rate.toFixed(2)}%</span>
                    </div>
                    <div className="tokenomics-item">
                      <span className="label">Burn Fund (Fiat):</span>
                      <span className="value">${tokenomics?.burn_fund_fiat.toFixed(2)}</span>
                    </div>
                    <button onClick={() => setIsEditing(true)} className="btn btn-primary">
                      <Edit2 size={16} /> Edit Settings
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
