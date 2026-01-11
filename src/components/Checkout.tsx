import { useState } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../hooks/useAuth';
import { createPaymentIntent } from '../services/paymentService';
import { calculateAndCreateCommissions } from '../services/commissionService';
import { CreditCard, Loader, AlertCircle } from 'lucide-react';
import './Checkout.css';

interface CheckoutProps {
  items: any[];
  total: number;
  onSuccess: () => void;
  onClose: () => void;
}

export default function Checkout({ items, total, onSuccess, onClose }: CheckoutProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '4242 4242 4242 4242',
    expiry: '12/25',
    cvc: '123',
  });

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user?.id,
          total_amount: total,
          status: 'processing',
          payment_status: 'processing',
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      const orderId = orderData.id;

      const orderItems = items.map(item => ({
        order_id: orderId,
        product_id: item.id,
        vendor_id: item.vendor_id,
        quantity: 1,
        price_at_purchase: item.price,
        subtotal: item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      const { client_secret } = await createPaymentIntent(total, orderId);

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          stripe_payment_intent_id: client_secret.split('_secret_')[0],
          payment_status: 'paid',
          status: 'completed',
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      const { data: insertedItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (insertedItems) {
        await calculateAndCreateCommissions(orderId, insertedItems);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-modal">
      <div className="checkout-content">
        <div className="checkout-header">
          <h2>Complete Your Purchase</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle className="alert-icon" />
            {error}
          </div>
        )}

        <div className="order-summary">
          <h3>Order Summary</h3>
          <div className="order-items">
            {items.map((item, idx) => (
              <div key={idx} className="order-item">
                <span>{item.name}</span>
                <span>${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="order-total">
            <strong>Total: ${total.toFixed(2)}</strong>
          </div>
        </div>

        <form onSubmit={handleCheckout} className="checkout-form">
          <div className="form-group">
            <label>Card Number</label>
            <div className="input-wrapper">
              <CreditCard className="input-icon" />
              <input
                type="text"
                value={cardDetails.cardNumber}
                onChange={(e) => setCardDetails({...cardDetails, cardNumber: e.target.value})}
                placeholder="Card number"
                disabled
              />
            </div>
            <small>Demo: Use 4242 4242 4242 4242</small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Expiry</label>
              <input
                type="text"
                value={cardDetails.expiry}
                onChange={(e) => setCardDetails({...cardDetails, expiry: e.target.value})}
                placeholder="MM/YY"
                disabled
              />
            </div>
            <div className="form-group">
              <label>CVC</label>
              <input
                type="text"
                value={cardDetails.cvc}
                onChange={(e) => setCardDetails({...cardDetails, cvc: e.target.value})}
                placeholder="CVC"
                disabled
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary checkout-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader className="spinner-small" />
                Processing...
              </>
            ) : (
              `Pay $${total.toFixed(2)}`
            )}
          </button>
        </form>

        <p className="checkout-info">
          This is a demo in sandbox mode. No real charges will be made.
        </p>
      </div>
    </div>
  );
}
