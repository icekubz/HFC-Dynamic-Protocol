import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';
import Layout from '../../components/Layout';
import { Copy, ExternalLink, TrendingUp } from 'lucide-react';
import './AffiliateLinks.css';

interface AffiliateLink {
  id: string;
  link_code: string;
  clicks: number;
  conversions: number;
  product_id: string;
  products: {
    name: string;
    price: number;
  };
}

export default function AffiliateLinks() {
  const { user } = useAuth();
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [copiedLink, setCopiedLink] = useState('');

  useEffect(() => {
    fetchLinks();
    fetchProducts();
  }, [user?.id]);

  const fetchLinks = async () => {
    const { data } = await supabase
      .from('affiliate_links')
      .select('*, products(name, price)')
      .eq('affiliate_id', user?.id)
      .order('created_at', { ascending: false });

    setLinks(data || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');

    setProducts(data || []);
  };

  const generateLink = async () => {
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    const linkCode = Math.random().toString(36).substring(2, 15);

    const { error } = await supabase
      .from('affiliate_links')
      .insert({
        affiliate_id: user?.id,
        product_id: selectedProduct,
        link_code: linkCode,
      });

    if (error) {
      alert('Error generating link: ' + error.message);
      return;
    }

    fetchLinks();
    setSelectedProduct('');
  };

  const copyLink = (linkCode: string) => {
    const fullLink = `${window.location.origin}/marketplace?ref=${linkCode}`;
    navigator.clipboard.writeText(fullLink);
    setCopiedLink(linkCode);
    setTimeout(() => setCopiedLink(''), 2000);
  };

  return (
    <Layout title="Affiliate Links">
      <div className="affiliate-links-page">
        <div className="generate-section">
          <h2>Generate Affiliate Link</h2>
          <div className="generate-form">
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="product-select"
            >
              <option value="">Select a product...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - ${product.price}
                </option>
              ))}
            </select>
            <button onClick={generateLink} className="btn btn-primary">
              Generate Link
            </button>
          </div>
        </div>

        <div className="links-section">
          <h2>My Affiliate Links</h2>
          {links.length === 0 ? (
            <div className="empty-state">
              <p>No affiliate links yet. Generate your first link above!</p>
            </div>
          ) : (
            <div className="links-grid">
              {links.map((link) => (
                <div key={link.id} className="link-card">
                  <div className="link-header">
                    <h3>{link.products.name}</h3>
                    <span className="link-price">${link.products.price}</span>
                  </div>
                  <div className="link-url">
                    <code>
                      {window.location.origin}/marketplace?ref={link.link_code}
                    </code>
                    <button
                      onClick={() => copyLink(link.link_code)}
                      className="btn-icon"
                      title="Copy link"
                    >
                      {copiedLink === link.link_code ? (
                        <span className="copied">Copied!</span>
                      ) : (
                        <Copy size={18} />
                      )}
                    </button>
                  </div>
                  <div className="link-stats">
                    <div className="stat">
                      <ExternalLink size={16} />
                      <span>{link.clicks} clicks</span>
                    </div>
                    <div className="stat">
                      <TrendingUp size={16} />
                      <span>{link.conversions} conversions</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
