import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { ShoppingBag, Eye } from 'lucide-react';
import '../dashboards/Dashboard.css';

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
  items?: any[];
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Order History">
      <div className="management-container">
        <div className="management-header">
          <h2><ShoppingBag /> Your Orders</h2>
          <p>View your complete purchase history</p>
        </div>

        {loading ? (
          <p>Loading orders...</p>
        ) : orders.length === 0 ? (
          <p>No orders found</p>
        ) : (
          <div className="table-container">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.order_number}</td>
                    <td>${order.total_amount.toFixed(2)}</td>
                    <td>
                      <span className={`status-badge ${order.payment_status}`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td>{new Date(order.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-small btn-primary"><Eye size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
