import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOptionalSocket } from '../context/SocketContext';
import { LayoutDashboard } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // No hardcoded fallback departments — prefer empty list so invalid IDs aren't sent
  const fallbackDepartments: any[] = [];

  const socket = useOptionalSocket();
  const kpiTrigger = socket?.kpiTrigger;

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

  useEffect(() => {
    fetchDepts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh department list when KPI updates are broadcast (e.g., department created/updated)
  useEffect(() => {
    if (typeof kpiTrigger === 'number' && kpiTrigger > 0) {
      fetchDepts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiTrigger]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(name, email, password, departmentId || null);
        setSuccess('Account created successfully as an Employee! Please log in.');
        setMode('login');
        setName('');
        setDepartmentId('');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('http://localhost:5001/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to send password reset link');
      }
      setSuccess(data.message || 'If an account exists, a password reset token was sent.');
      if (data.token) {
        setResetToken(data.token);
        setMode('reset');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to send password reset link');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError('New password and confirm password must match.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5001/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to reset password');
      }
      setSuccess(data.message || 'Password reset successful. Please sign in.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setResetToken('');
    } catch (err: any) {
      setError(err.message || 'Unable to reset password');
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
          {mode === 'login' && 'Sign in to access your ERP dashboard'}
          {mode === 'signup' && 'Create an employee account to get started'}
          {mode === 'forgot' && 'Enter your email to receive a password reset token'}
          {mode === 'reset' && 'Reset your password using the token we issued'}
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

        <form onSubmit={mode === 'forgot' ? handleForgotPassword : mode === 'reset' ? handleResetPassword : handleSubmit}>
          {mode === 'signup' && (
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

          {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
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
          )}

          {mode === 'reset' && (
            <>
              <div className="form-group">
                <label className="form-label">Reset Token</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter reset token"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          {mode === 'signup' && (
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
              {departments.length === 0 && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>No departments available.</span>
                  <button type="button" className="btn" onClick={fetchDepts} style={{ padding: '4px 8px', fontSize: 12 }}>Retry</button>
                </div>
              )}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 10 }}>
            {mode === 'login' && 'Sign In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot' && 'Send Reset Token'}
            {mode === 'reset' && 'Reset Password'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
          {mode === 'login' && (
            <>
              <button
                onClick={() => setMode('forgot')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Forgot password?
              </button>
              <span style={{ margin: '0 8px' }}>•</span>
              <button
                onClick={() => setMode('signup')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Create an employee account
              </button>
            </>
          )}

          {mode === 'signup' && (
            <>
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Sign In
              </button>
            </>
          )}

          {mode === 'forgot' && (
            <>
              Remembered your password?{' '}
              <button
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Sign In
              </button>
            </>
          )}

          {mode === 'reset' && (
            <>
              Want to go back?{' '}
              <button
                onClick={() => setMode('login')}
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
