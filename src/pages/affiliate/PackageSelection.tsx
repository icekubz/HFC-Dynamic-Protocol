import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAllPackages, subscribeToPackage, getUserPackage, AffiliatePackage } from '../../services/binaryTreeService';
import Layout from '../../components/Layout';
import { Check, Zap } from 'lucide-react';
import './PackageSelection.css';

export default function PackageSelection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<AffiliatePackage[]>([]);
  const [currentPackage, setCurrentPackage] = useState<AffiliatePackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [allPackages, userPackage] = await Promise.all([
        getAllPackages(),
        getUserPackage(user?.id || ''),
      ]);

      setPackages(allPackages);
      setCurrentPackage(userPackage);
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (packageId: string) => {
    if (!user) return;

    setSubscribing(true);
    try {
      await subscribeToPackage(user.id, packageId);
      navigate('/affiliate');
    } catch (error) {
      console.error('Error subscribing to package:', error);
      alert('Failed to subscribe to package. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Affiliate Packages">
        <div className="loading-container">Loading packages...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Choose Your Affiliate Package">
      <div className="packages-container">
        <div className="packages-header">
          <h2>Select Your Commission Plan</h2>
          <p>Choose the package that fits your business goals. Higher packages unlock deeper commission levels and better rates.</p>
        </div>

        <div className="packages-grid">
          {packages.map((pkg) => {
            const isCurrent = currentPackage?.id === pkg.id;
            const isUpgrade = currentPackage && pkg.price > currentPackage.price;

            return (
              <div key={pkg.id} className={`package-card ${isCurrent ? 'current' : ''}`}>
                {isCurrent && (
                  <div className="package-badge">Current Plan</div>
                )}

                <div className="package-header">
                  <h3>{pkg.name}</h3>
                  <div className="package-price">
                    <span className="price-amount">${pkg.price}</span>
                    <span className="price-period">one-time</span>
                  </div>
                </div>

                <div className="package-features">
                  <div className="feature">
                    <Check size={20} />
                    <span>Up to <strong>{pkg.max_tree_depth}</strong> levels deep</span>
                  </div>
                  <div className="feature">
                    <Check size={20} />
                    <span><strong>{pkg.direct_commission_rate}%</strong> direct commission</span>
                  </div>
                  <div className="feature">
                    <Check size={20} />
                    <span><strong>{pkg.level_2_commission_rate}%</strong> level 2 commission</span>
                  </div>
                  <div className="feature">
                    <Check size={20} />
                    <span><strong>{pkg.level_3_commission_rate}%</strong> level 3+ commission</span>
                  </div>
                  <div className="feature">
                    <Check size={20} />
                    <span><strong>{pkg.matching_bonus_rate}%</strong> matching bonus</span>
                  </div>
                  <div className="feature">
                    <Zap size={20} />
                    <span>Binary tree structure ({pkg.max_width} legs)</span>
                  </div>
                </div>

                <button
                  className={`btn ${isCurrent ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => handleSubscribe(pkg.id)}
                  disabled={isCurrent || subscribing}
                >
                  {isCurrent ? 'Active' : isUpgrade ? 'Upgrade' : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="packages-info">
          <h3>How Binary Tree Commissions Work</h3>
          <div className="info-grid">
            <div className="info-card">
              <h4>Binary Structure</h4>
              <p>Build your network with 2 legs (left and right). New affiliates automatically fill available positions.</p>
            </div>
            <div className="info-card">
              <h4>Level Commissions</h4>
              <p>Earn commissions from your direct referrals and their downline based on your package level.</p>
            </div>
            <div className="info-card">
              <h4>Matching Bonus</h4>
              <p>Earn extra bonuses when both your left and right legs generate sales (weaker leg matched).</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
