import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Product } from '../types';
import Layout from '../components/Layout';
import Checkout from '../components/Checkout';
import { ShoppingCart, Loader, Search, Filter } from 'lucide-react';
import './Marketplace.css';

interface Category {
  id: string;
  name: string;
}

export default function Marketplace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Product[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, searchTerm]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('is_active', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    setCategories(data || []);
  };

  const filterProducts = () => {
    let filtered = products;

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredProducts(filtered);
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
        <div className="search-bar">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search for products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <button
          className="btn btn-primary cart-btn"
          onClick={() => setShowCart(!showCart)}
        >
          <ShoppingCart />
          Cart ({cart.length})
        </button>
      </div>

      <div className="marketplace-layout">
        <aside className="filters-sidebar">
          <h3><Filter size={20} /> Filters</h3>
          <div className="filter-section">
            <h4>Categories</h4>
            <div className="filter-options">
              <button
                className={`filter-option ${!selectedCategory ? 'active' : ''}`}
                onClick={() => setSelectedCategory('')}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`filter-option ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="products-section">
          {loading ? (
            <div className="loading">
              <Loader className="spinner" />
            </div>
          ) : (
            <>
              <div className="products-header">
                <h2>{filteredProducts.length} Products</h2>
              </div>
              <div className="grid cols-3">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="product-card">
                    <div className="product-image">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} />
                      ) : (
                        <div className="no-image">No Image</div>
                      )}
                    </div>
                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <p className="product-desc">{product.description}</p>
                      <div className="product-footer">
                        <span className="price">${product.price.toFixed(2)}</span>
                        <button
                          className="btn btn-secondary"
                          onClick={() => addToCart(product)}
                          disabled={product.stock_quantity === 0}
                        >
                          {product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredProducts.length === 0 && (
                <div className="no-products">
                  <p>No products found</p>
                </div>
              )}
            </>
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
