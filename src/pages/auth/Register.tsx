import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { Mail, Lock, User, AlertCircle, Loader } from 'lucide-react';
import './auth.css';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [roles, setRoles] = useState<string[]>(['consumer']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roleOptions = ['consumer', 'vendor', 'affiliate'];

  const toggleRole = (role: string) => {
    setRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            full_name: fullName,
          });

        if (profileError) {
          setError(profileError.message);
          return;
        }

        const { count: userCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true });

        const isFirstUser = userCount === 1;
        const userRoles = isFirstUser ? [...roles, 'admin'] : roles;

        const rolesData = userRoles.map(role => ({
          user_id: authData.user.id,
          role,
          status: 'active',
        }));

        const { error: rolesError } = await supabase
          .from('user_roles')
          .insert(rolesData);

        if (rolesError) {
          setError(rolesError.message);
          return;
        }

        navigate('/login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Join Us</h1>
          <p>Create your account to get started</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle className="alert-icon" />
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-wrapper">
              <User className="input-icon" />
              <input
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon" />
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Select Your Roles</label>
            <div className="roles-grid">
              {roleOptions.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`role-btn ${roles.includes(role) ? 'active' : ''}`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader className="spinner-small" />
                Creating account...
              </>
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <a href="/login">Sign in</a>
        </div>
      </div>
    </div>
  );
}
