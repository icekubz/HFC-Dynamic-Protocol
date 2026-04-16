import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { Percent, Save } from 'lucide-react';
import '../dashboards/Dashboard.css';

interface CommissionConfig {
  id: string;
  affiliate_commission_rate: number;
  hfc_commission_rate: number;
  company_fee_rate: number;
  updated_at: string;
}

export default function CommissionManagement() {
  const [config, setConfig] = useState<CommissionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    affiliate_commission_rate: 0,
    hfc_commission_rate: 0,
    company_fee_rate: 0,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data } = await supabase
        .from('commission_config')
        .select('*')
        .maybeSingle();

      if (data) {
        setConfig(data);
        setFormData({
          affiliate_commission_rate: data.affiliate_commission_rate,
          hfc_commission_rate: data.hfc_commission_rate,
          company_fee_rate: data.company_fee_rate,
        });
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (config) {
        await supabase
          .from('commission_config')
          .update(formData)
          .eq('id', config.id);
      }
      alert('Commission settings saved');
      fetchConfig();
    } catch (err) {
      console.error('Error saving config:', err);
    }
  };

  return (
    <Layout title="Commission Management">
      <div className="management-container">
        <div className="management-header">
          <h2><Percent /> Commission Management</h2>
          <p>Configure commission rates and payouts</p>
        </div>

        {loading ? (
          <p>Loading configuration...</p>
        ) : (
          <div className="settings-form">
            <div className="form-group">
              <label>Affiliate Commission Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.affiliate_commission_rate}
                onChange={(e) => setFormData({ ...formData, affiliate_commission_rate: parseFloat(e.target.value) })}
              />
              <small>Percentage paid to affiliates from sales</small>
            </div>

            <div className="form-group">
              <label>HFC Commission Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.hfc_commission_rate}
                onChange={(e) => setFormData({ ...formData, hfc_commission_rate: parseFloat(e.target.value) })}
              />
              <small>Percentage paid for HFC system participation</small>
            </div>

            <div className="form-group">
              <label>Company Fee Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.company_fee_rate}
                onChange={(e) => setFormData({ ...formData, company_fee_rate: parseFloat(e.target.value) })}
              />
              <small>Company processing fee from each transaction</small>
            </div>

            <button onClick={handleSave} className="btn btn-primary">
              <Save size={16} /> Save Settings
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
