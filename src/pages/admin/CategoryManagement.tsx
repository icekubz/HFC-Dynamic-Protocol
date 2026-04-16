import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { Folder, Plus, Trash2, FileEdit as Edit2 } from 'lucide-react';
import '../dashboards/Dashboard.css';

interface Category {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: false });

      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('categories')
        .insert([formData]);

      if (!error) {
        setFormData({ name: '', description: '' });
        setShowForm(false);
        fetchCategories();
        alert('Category added successfully');
      }
    } catch (err) {
      console.error('Error adding category:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure?')) {
      try {
        await supabase.from('categories').delete().eq('id', id);
        fetchCategories();
        alert('Category deleted');
      } catch (err) {
        console.error('Error deleting category:', err);
      }
    }
  };

  return (
    <Layout title="Category Management">
      <div className="management-container">
        <div className="management-header">
          <h2><Folder /> Category Management</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            <Plus size={16} /> Add Category
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAddCategory} className="form-box">
            <input
              type="text"
              placeholder="Category name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <p>Loading categories...</p>
        ) : (
          <div className="table-container">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td>{cat.name}</td>
                    <td>{cat.description}</td>
                    <td>{new Date(cat.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-small btn-secondary"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(cat.id)} className="btn-small btn-danger"><Trash2 size={16} /></button>
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
