import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { Users, Trash2, CheckCircle, XCircle } from 'lucide-react';
import '../dashboards/Dashboard.css';

interface User {
  id: string;
  email: string;
  full_name: string;
  user_role: string;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, email, full_name, user_role, created_at')
        .order('created_at', { ascending: false });

      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="User Management">
      <div className="management-container">
        <div className="management-header">
          <h2><Users /> User Management</h2>
          <p>Manage user roles and permissions</p>
        </div>

        {loading ? (
          <p>Loading users...</p>
        ) : (
          <div className="table-container">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.full_name}</td>
                    <td>
                      <span className={`role-badge ${user.user_role}`}>
                        {user.user_role}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-small btn-danger">
                        <Trash2 size={16} />
                      </button>
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
