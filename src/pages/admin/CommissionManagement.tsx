import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { Percent, Save, FileEdit as Edit2 } from 'lucide-react';
import '../dashboards/Dashboard.css';

interface Package {
  id: string;
  name: string;
  direct_commission_rate: number;
  level_2_commission_rate: number;
  level_3_commission_rate: number;
  matching_bonus_rate: number;
}

export default function CommissionManagement() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    direct_commission_rate: 0,
    level_2_commission_rate: 0,
    level_3_commission_rate: 0,
    matching_bonus_rate: 0,
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data } = await supabase
        .from('affiliate_packages')
        .select('*')
        .order('created_at');

      setPackages(data || []);
    } catch (err) {
      console.error('Error fetching packages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (pkg: Package) => {
    setEditingId(pkg.id);
    setFormData({
      direct_commission_rate: pkg.direct_commission_rate,
      level_2_commission_rate: pkg.level_2_commission_rate,
      level_3_commission_rate: pkg.level_3_commission_rate,
      matching_bonus_rate: pkg.matching_bonus_rate,
    });
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await supabase
          .from('affiliate_packages')
          .update(formData)
          .eq('id', editingId);

        alert('Commission rates updated successfully');
        setEditingId(null);
        fetchPackages();
      }
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Failed to save commission rates');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      direct_commission_rate: 0,
      level_2_commission_rate: 0,
      level_3_commission_rate: 0,
      matching_bonus_rate: 0,
    });
  };

  return (
    <Layout title="Commission Management">
      <div className="management-container">
        <div className="management-header">
          <h2><Percent /> Commission Management</h2>
          <p>Configure commission rates for affiliate packages</p>
        </div>

        {loading ? (
          <p>Loading packages...</p>
        ) : (
          <div className="commission-management">
            {editingId ? (
              <div className="settings-form">
                <h3>Edit Commission Rates</h3>

                <div className="form-group">
                  <label>Direct Commission Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.direct_commission_rate}
                    onChange={(e) => setFormData({ ...formData, direct_commission_rate: parseFloat(e.target.value) })}
                  />
                  <small>Commission from direct referrals (Level 1)</small>
                </div>

                <div className="form-group">
                  <label>Level 2 Commission Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.level_2_commission_rate}
                    onChange={(e) => setFormData({ ...formData, level_2_commission_rate: parseFloat(e.target.value) })}
                  />
                  <small>Commission from Level 2 downline</small>
                </div>

                <div className="form-group">
                  <label>Level 3 Commission Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.level_3_commission_rate}
                    onChange={(e) => setFormData({ ...formData, level_3_commission_rate: parseFloat(e.target.value) })}
                  />
                  <small>Commission from Level 3 downline</small>
                </div>

                <div className="form-group">
                  <label>Matching Bonus Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.matching_bonus_rate}
                    onChange={(e) => setFormData({ ...formData, matching_bonus_rate: parseFloat(e.target.value) })}
                  />
                  <small>Matching bonus on downline performance</small>
                </div>

                <div className="form-actions">
                  <button onClick={handleSave} className="btn btn-primary">
                    <Save size={16} /> Save Changes
                  </button>
                  <button onClick={handleCancel} className="btn btn-secondary">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table className="management-table">
                  <thead>
                    <tr>
                      <th>Package Name</th>
                      <th>Direct Rate (%)</th>
                      <th>Level 2 Rate (%)</th>
                      <th>Level 3 Rate (%)</th>
                      <th>Matching Bonus (%)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => (
                      <tr key={pkg.id}>
                        <td>{pkg.name}</td>
                        <td>{pkg.direct_commission_rate.toFixed(2)}</td>
                        <td>{pkg.level_2_commission_rate.toFixed(2)}</td>
                        <td>{pkg.level_3_commission_rate.toFixed(2)}</td>
                        <td>{pkg.matching_bonus_rate.toFixed(2)}</td>
                        <td>
                          <button onClick={() => handleEdit(pkg)} className="btn-small btn-primary">
                            <Edit2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
