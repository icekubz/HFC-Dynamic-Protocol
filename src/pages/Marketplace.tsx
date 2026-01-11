import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Product } from '../types';
import Layout from '../components/Layout';
import Checkout from '../components/Checkout';
import { ShoppingCart, Loader } from 'lucide-react';
import './Marketplace.css';

export default function Marketplace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Product[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart([...cart, product]);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const total = cart.reduce((sum, p) => sum + p.price, 0);

  return (
    <Layout title="Marketplace">
      <div className="marketplace-header">
        <button
          className="btn btn-primary cart-btn"
          onClick={() => setShowCart(!showCart)}
        >
          <ShoppingCart />
          Cart ({cart.length})
        </button>
      </div>

      <div className="marketplace-layout">
        <div className="products-section">
          {loading ? (
            <div className="loading">
              <Loader className="spinner" />
            </div>
          ) : (
            <div className="grid cols-3">
              {products.map((product) => (
                <div key={product.id} className="product-card">
                  {product.image_url && (
                    <img src={product.image_url} alt={product.name} />
                  )}
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <p className="product-desc">{product.description}</p>
                    <div className="product-footer">
                      <span className="price">${product.price.toFixed(2)}</span>
                      <button
                        className="btn btn-secondary"
                        onClick={() => addToCart(product)}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showCart && (
          <div className="cart-sidebar">
            <h3>Shopping Cart</h3>
            <div className="cart-items">
              {cart.length === 0 ? (
                <p className="empty-cart">Your cart is empty</p>
              ) : (
                cart.map((product, index) => (
                  <div key={index} className="cart-item">
                    <div>
                      <div className="cart-item-name">{product.name}</div>
                      <div className="cart-item-price">${product.price.toFixed(2)}</div>
                    </div>
                    <button
                      className="btn-remove"
                      onClick={() => removeFromCart(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="cart-total">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCheckout(true)}
                >
                  Checkout
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showCheckout && (
        <Checkout
          items={cart}
          total={total}
          onSuccess={() => {
            setShowCheckout(false);
            setCart([]);
            alert('Order placed successfully!');
          }}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </Layout>
  );
}
