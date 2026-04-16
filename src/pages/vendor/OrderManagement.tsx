import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { Package, Eye, CheckCircle } from 'lucide-react';
import './ProductManagement.css';

interface VendorOrder {
  id: string;
  order_number: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
  buyer_email: string;
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
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
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });

      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Order Management">
      <div className="management-container">
        <div className="management-header">
          <h2><Package /> Order Management</h2>
          <p>View and manage your orders</p>
        </div>

        {loading ? (
          <p>Loading orders...</p>
        ) : orders.length === 0 ? (
          <p>No orders yet</p>
        ) : (
          <div className="table-container">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Buyer</th>
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
                    <td>{order.buyer_email}</td>
                    <td>${order.total_amount.toFixed(2)}</td>
                    <td>
                      <span className={`status-badge ${order.payment_status}`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td>{new Date(order.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-small btn-primary"><Eye size={16} /></button>
                      {order.payment_status === 'pending' && (
                        <button className="btn-small btn-success"><CheckCircle size={16} /></button>
                      )}
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
