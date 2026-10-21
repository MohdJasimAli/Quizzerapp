import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Code2,
  Lock,
  Mail,
  Shield,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login, isAuthenticated, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // If already authenticated, redirect
  React.useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') navigate('/admin/dashboard', { replace: true });
      else if (user.role === 'teacher') navigate('/teacher/dashboard', { replace: true });
      else navigate('/student/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const data = await login(email, password);
      toast.success(`Welcome back, ${data.user.name}!`);
      if (data.user.role === 'admin') navigate('/admin/dashboard');
      else if (data.user.role === 'teacher') navigate('/teacher/dashboard');
      else navigate('/student/dashboard');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Authentication failed');
      toast.error('Login failed. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick 1-click preset logins for evaluation
  const setCredentials = (eMail, pWord) => {
    setEmail(eMail);
    setPassword(pWord);
    setErrorMsg('');
  };

  return (
    <div className="min-h-[90vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 items-center justify-center shadow-xl shadow-indigo-600/30 mb-4">
            <Code2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            KAIROS <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">TEST</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
            Kairos Club &bull; Online Examination & Assessment Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500"></div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@kairos.edu"
                  required
                  className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 mt-6 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Student Registration Link */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              New Student?{' '}
              <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition">
                Create a student account &rarr;
              </Link>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Faculty / Teacher accounts are issued directly by the Administrator.
            </p>
          </div>

          {/* Quick Demo Logins for Pair Programming / Evaluation */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Quick Demo Accounts (1-Click Fill)</span>
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCredentials('admin@kairos.edu', 'Admin@12345')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800 text-left transition flex items-center gap-2 text-slate-300"
              >
                <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">Admin</span>
              </button>

              <button
                type="button"
                onClick={() => setCredentials('teacher@kairos.edu', 'Teacher@12345')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800 text-left transition flex items-center gap-2 text-slate-300"
              >
                <GraduationCap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">Teacher</span>
              </button>

              <button
                type="button"
                onClick={() => setCredentials('student1@kairos.edu', 'Student@12345')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800 text-left transition flex items-center gap-2 text-slate-300"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                <span className="truncate">Student 1 (Alex)</span>
              </button>

              <button
                type="button"
                onClick={() => setCredentials('student2@kairos.edu', 'Student@12345')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800 text-left transition flex items-center gap-2 text-slate-300"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                <span className="truncate">Student 2 (Sophia)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
