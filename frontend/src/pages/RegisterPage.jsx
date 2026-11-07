import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
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
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    }
  };

  return (
    <div className="app-shell">
      <div className="auth-panel">
        <h1>Create account</h1>
        <p className="muted">Set up your BrandGuard AI access.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label>Name</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="password-wrap">
              <input id="register-password" type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} minLength="10" required />
              <button className="password-toggle monkey-toggle" type="button" aria-controls="register-password" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}><span aria-hidden="true">{showPassword ? '🐵' : '🙈'}</span></button>
            </div>
            <small className="muted">Public registration creates a content creator account. Administrators assign roles.</small>
          </div>
          {error && <div className="status rejected">{error}</div>}
          <button className="primary-btn" type="submit">Register</button>
        </form>
        <div className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}
