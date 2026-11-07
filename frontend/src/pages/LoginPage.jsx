import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await login(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    }
  };

  return (
    <div className="app-shell">
      <div className="auth-panel">
        <h1>Welcome back</h1>
        <p className="muted">Sign in to BrandGuard AI.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="password-wrap">
              <input id="login-password" type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} required />
              <button className="password-toggle monkey-toggle" type="button" aria-controls="login-password" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}><span aria-hidden="true">{showPassword ? '🐵' : '🙈'}</span></button>
            </div>
          </div>
          {error && <div className="status rejected">{error}</div>}
          <button className="primary-btn" type="submit">Login</button>
        </form>
        <div className="auth-switch">
          Need an account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
