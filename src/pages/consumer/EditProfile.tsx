import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { User, Save } from 'lucide-react';
import '../dashboards/Dashboard.css';

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  address: string;
}

export default function EditProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          address: profile.address,
        })
        .eq('id', profile.id);

      if (!error) {
        alert('Profile updated successfully');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Edit Profile">
      <div className="management-container">
        <div className="management-header">
          <h2><User /> Edit Profile</h2>
        </div>

        {loading ? (
          <p>Loading profile...</p>
        ) : profile ? (
          <div className="settings-form">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={profile.email} disabled />
            </div>

            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Address</label>
              <textarea
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              />
            </div>

            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        ) : (
          <p>Profile not found</p>
        )}
      </div>
    </Layout>
  );
}
