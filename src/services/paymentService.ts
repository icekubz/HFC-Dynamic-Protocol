import { supabase } from '../utils/supabase';
import { calculateHFCCommissions } from './hfcCommissionService';

export async function createPaymentIntent(amount: number, orderId: string) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/create-payment-intent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'usd',
          metadata: { order_id: orderId },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Payment creation failed');
    }

    return data;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}

export async function createOrder(
  userId: string,
  items: Array<{ productId: string; quantity: number; price: number }>,
  totalAmount: number,
  paymentIntentId: string
): Promise<string | null> {
  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: userId,
        total_amount: totalAmount,
        payment_status: 'paid',
        order_type: 'product',
        stripe_payment_intent_id: paymentIntentId,
      })
      .select('id')
      .single();

    if (orderError) throw orderError;

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

    if (itemsError) throw itemsError;

    let totalCV = 0;
    for (const item of items) {
      const { data: product } = await supabase
        .from('products')
        .select('cv_value')
        .eq('id', item.productId)
        .maybeSingle();

      if (product?.cv_value) {
        totalCV += product.cv_value * item.quantity;
      }
    }

    if (totalCV > 0) {
      await calculateHFCCommissions(order.id, userId, totalCV);
    }

    return order.id;
  } catch (error) {
    console.error('Error creating order:', error);
    return null;
  }
}

export async function confirmPayment(paymentIntentId: string) {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_STRIPE_PUBLIC_KEY}`,
        },
      }
    );

    return await response.json();
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error;
  }
}
