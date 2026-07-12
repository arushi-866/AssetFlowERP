import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fallbackDepartments = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Engineering' },
    { id: '11111111-1111-1111-1111-111111111112', name: 'Facilities' },
    { id: '11111111-1111-1111-1111-111111111113', name: 'Operations' },
  ];

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await fetch('http://localhost:5001/api/auth/departments');
        if (res.ok) {
          setDepartments(await res.json());
        } else {
          setDepartments(fallbackDepartments);
        }
      } catch {
        setDepartments(fallbackDepartments);
      }
    };
    fetchDepts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(name, email, password, departmentId || null);
        setSuccess('Account created successfully as an Employee! Please log in.');
        setIsLogin(true);
        setName('');
        setDepartmentId('');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <LayoutDashboard size={32} style={{ color: 'var(--accent-primary)' }} />
          <span>Asset<span>Flow</span></span>
        </div>
        <p className="auth-subtitle">
          {isLogin ? 'Sign in to access your ERP dashboard' : 'Create an employee account to get started'}
        </p>

        {error && (
          <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 20 }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="Aditi Rao"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Department</label>
              <select
                className="form-control"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">Select Department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 10 }}>
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
          {isLogin ? (
            <>
              New here?{' '}
              <button 
                onClick={() => setIsLogin(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Create an employee account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button 
                onClick={() => setIsLogin(true)} 
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default Login;
