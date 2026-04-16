import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { Percent, Save, FileEdit as Edit2, CheckCircle } from 'lucide-react';
import { CommissionVerifier } from '../../services/commissionVerifier';
import '../dashboards/Dashboard.css';

interface CommissionRateConfig {
  id: string;
  self_commission_rate: number;
  direct_commission_rate: number;
  passive_commission_rate: number;
  platform_commission_rate: number;
  passive_divisor: number;
  is_active: boolean;
}

export default function CommissionManagement() {
  const [rates, setRates] = useState<CommissionRateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    self_commission_rate: 10.0,
    direct_commission_rate: 15.0,
    passive_commission_rate: 50.0,
    platform_commission_rate: 25.0,
    passive_divisor: 5,
  });
  const [verification, setVerification] = useState<any>(null);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const { data } = await supabase
        .from('tee_commission_rates')
        .select('*')
        .eq('is_active', true)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setRates(data);
        setFormData({
          self_commission_rate: parseFloat(data.self_commission_rate),
          direct_commission_rate: parseFloat(data.direct_commission_rate),
          passive_commission_rate: parseFloat(data.passive_commission_rate),
          platform_commission_rate: parseFloat(data.platform_commission_rate),
          passive_divisor: data.passive_divisor,
        });
        simulateVerification(data);
      }
    } catch (err) {
      console.error('Error fetching rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const simulateVerification = (config: any) => {
    const ratesObj = {
      selfRate: parseFloat(config.self_commission_rate),
      directRate: parseFloat(config.direct_commission_rate),
      passiveRate: parseFloat(config.passive_commission_rate),
      platformRate: parseFloat(config.platform_commission_rate),
      passiveDivisor: config.passive_divisor,
    };

    const mockCalcs = [
      {
        affiliateId: 'affiliate_1',
        selfCommission: 100,
        directCommission: 150,
        passiveCommission: 250,
        totalCommission: 500,
        ratesApplied: ratesObj,
        calculationBreakdown: { personalCV: 1000, directReferralCV: 1000, downlineCV: 5000, maxDepth: 3, divisorUsed: 5 }
      }
    ];

    const report = CommissionVerifier.verify(10000, ratesObj, mockCalcs);
    setVerification(report);
  };

  const handleSave = async () => {
    try {
      const totalRate = formData.self_commission_rate + formData.direct_commission_rate + formData.passive_commission_rate + formData.platform_commission_rate;

      if (Math.abs(totalRate - 100) > 0.01) {
        alert(`Error: Total allocation rate is ${totalRate.toFixed(2)}%. Must equal 100%`);
        return;
      }

      if (rates?.id) {
        await supabase
          .from('tee_commission_rates')
          .update({
            self_commission_rate: formData.self_commission_rate,
            direct_commission_rate: formData.direct_commission_rate,
            passive_commission_rate: formData.passive_commission_rate,
            platform_commission_rate: formData.platform_commission_rate,
            passive_divisor: formData.passive_divisor,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rates.id);

        alert('Commission rates updated successfully');
        setIsEditing(false);
        fetchRates();
      }
    } catch (err) {
      console.error('Error saving rates:', err);
      alert('Failed to save commission rates');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (rates) {
      setFormData({
        self_commission_rate: parseFloat(rates.self_commission_rate),
        direct_commission_rate: parseFloat(rates.direct_commission_rate),
        passive_commission_rate: parseFloat(rates.passive_commission_rate),
        platform_commission_rate: parseFloat(rates.platform_commission_rate),
        passive_divisor: rates.passive_divisor,
      });
    }
  };

  const totalRate = formData.self_commission_rate + formData.direct_commission_rate + formData.passive_commission_rate + formData.platform_commission_rate;
  const isValidTotal = Math.abs(totalRate - 100) < 0.01;

  return (
    <Layout title="Commission Management">
      <div className="management-container">
        <div className="management-header">
          <h2><Percent /> Dynamic Commission Management</h2>
          <p>Configure TEE platform commission rates</p>
        </div>

        {loading ? (
          <p>Loading configuration...</p>
        ) : (
          <div className="commission-management">
            <div className="commission-structure">
              {isEditing ? (
                <div className="settings-form">
                  <h3>Edit Commission Rates</h3>

                  <div className="form-group">
                    <label>Self Commission Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.self_commission_rate}
                      onChange={(e) => setFormData({ ...formData, self_commission_rate: parseFloat(e.target.value) })}
                    />
                    <small>Commission on personal CV ingested</small>
                  </div>

                  <div className="form-group">
                    <label>Direct Commission Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.direct_commission_rate}
                      onChange={(e) => setFormData({ ...formData, direct_commission_rate: parseFloat(e.target.value) })}
                    />
                    <small>Commission on direct referral CV</small>
                  </div>

                  <div className="form-group">
                    <label>Passive Commission Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.passive_commission_rate}
                      onChange={(e) => setFormData({ ...formData, passive_commission_rate: parseFloat(e.target.value) })}
                    />
                    <small>Commission on downline CV (divided by depth)</small>
                  </div>

                  <div className="form-group">
                    <label>Platform Commission Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.platform_commission_rate}
                      onChange={(e) => setFormData({ ...formData, platform_commission_rate: parseFloat(e.target.value) })}
                    />
                    <small>Platform earning (50% burn fund, 50% net profit)</small>
                  </div>

                  <div className="form-group">
                    <label>Passive Divisor</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.passive_divisor}
                      onChange={(e) => setFormData({ ...formData, passive_divisor: parseInt(e.target.value) })}
                    />
                    <small>Minimum divisor for passive commission (max with actual depth)</small>
                  </div>

                  <div className="form-group">
                    <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: isValidTotal ? '#f0fdf4' : '#fef2f2' }}>
                      <strong>Total Allocation: {totalRate.toFixed(2)}%</strong>
                      {isValidTotal ? (
                        <p style={{ color: '#22c55e', margin: '4px 0 0 0' }}>✓ Valid - totals 100%</p>
                      ) : (
                        <p style={{ color: '#ef4444', margin: '4px 0 0 0' }}>✗ Invalid - must equal 100%</p>
                      )}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button onClick={handleSave} className="btn btn-primary" disabled={!isValidTotal}>
                      <Save size={16} /> Save Rates
                    </button>
                    <button onClick={handleCancel} className="btn btn-secondary">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="structure-section">
                    <h3>Current Commission Rates</h3>
                    <div className="commission-items">
                      <div className="commission-item">
                        <div className="item-label">Self Commission</div>
                        <div className="item-value">{rates?.self_commission_rate.toFixed(1)}%</div>
                        <div className="item-description">Personal CV</div>
                      </div>
                      <div className="commission-item">
                        <div className="item-label">Direct Commission</div>
                        <div className="item-value">{rates?.direct_commission_rate.toFixed(1)}%</div>
                        <div className="item-description">Direct referral CV</div>
                      </div>
                      <div className="commission-item">
                        <div className="item-label">Passive Commission</div>
                        <div className="item-value">{rates?.passive_commission_rate.toFixed(1)}%</div>
                        <div className="item-description">Downline CV ÷ {rates?.passive_divisor}</div>
                      </div>
                      <div className="commission-item">
                        <div className="item-label">Platform Fees</div>
                        <div className="item-value">{rates?.platform_commission_rate.toFixed(1)}%</div>
                        <div className="item-description">Burn fund & profit</div>
                      </div>
                    </div>
                    <button onClick={() => setIsEditing(true)} className="btn btn-primary">
                      <Edit2 size={16} /> Edit Rates
                    </button>
                  </div>

                  {verification && (
                    <div className="structure-section">
                      <h3><CheckCircle size={20} style={{ display: 'inline', marginRight: '8px' }} />Verification & Calculation</h3>
                      <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#666', maxHeight: '400px', overflowY: 'auto' }}>
                        {verification.details.map((detail: string, idx: number) => (
                          <div key={idx} style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: detail === '' ? '8px' : '0' }}>
                            {detail}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
