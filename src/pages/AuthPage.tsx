import { FormEvent, useState } from 'react';
import { Eye, EyeOff, Building2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type AuthMode = 'login' | 'signup' | 'admin';

interface AuthPageProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSuccess: () => void;
}

export default function AuthPage({ mode, onModeChange, onSuccess }: AuthPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const isSignup = mode === 'signup';
  const isAdmin = mode === 'admin';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage({ type: 'error', text: 'Enter a valid email address.' });
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters and include a letter and number.' });
      return;
    }
    if (isSignup && !fullName.trim()) {
      setMessage({ type: 'error', text: 'Enter your full name.' });
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setBusy(true);
    const result = isSignup
      ? await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { full_name: fullName.trim() } } })
      : await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setBusy(false);
    if (result.error) {
      setMessage({ type: 'error', text: isSignup ? 'We could not create that account. Try another email or sign in.' : 'Email or password is incorrect.' });
      return;
    }
    if (isSignup) {
      await supabase.auth.signOut();
      setMessage({ type: 'success', text: 'Your account is ready. You can now sign in.' });
      onModeChange('login');
      return;
    }
    const userId = result.data.user?.id;
    if (!userId) {
      setMessage({ type: 'error', text: 'Your session could not be started. Please try again.' });
      return;
    }
    if (isAdmin) {
      const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', userId).maybeSingle();
      if (!profile || profile.role !== 'admin' || !profile.is_active) {
        await supabase.auth.signOut();
        setMessage({ type: 'error', text: 'This account is not authorized for administrator access.' });
        return;
      }
    }
    if (!rememberMe) sessionStorage.setItem('rupeeflow_session_only', '1');
    onSuccess();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl mx-auto flex items-center justify-center shadow-sm"><Building2 className="w-6 h-6 text-white" /></div>
          <h1 className="text-2xl font-bold text-slate-800 mt-4">RupeeFlow</h1>
          <p className="text-sm text-slate-500 mt-1">Unified Banking Intelligence</p>
        </div>
        <div className="rf-card p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            {isAdmin ? <ShieldCheck className="w-5 h-5 text-blue-600" /> : <Building2 className="w-5 h-5 text-blue-600" />}
            <div><h2 className="text-lg font-semibold text-slate-800">{isSignup ? 'Create your account' : isAdmin ? 'Administrator login' : 'Welcome back'}</h2><p className="text-xs text-slate-400">{isAdmin ? 'Restricted platform administration' : 'Secure access to your financial workspace'}</p></div>
          </div>
          {message && <div className={`rounded-lg px-3 py-2 text-sm mb-4 ${message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>{message.text}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && <label className="block"><span className="rf-label">Full name</span><input className="rf-input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" /></label>}
            <label className="block"><span className="rf-label">Email address</span><input className="rf-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            <label className="block"><span className="rf-label">Password</span><div className="relative"><input className="rf-input pr-10" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400" aria-label="Show password">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></label>
            {isSignup && <label className="block"><span className="rf-label">Confirm password</span><input className="rf-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></label>}
            {!isSignup && <div className="flex items-center justify-between text-xs"><label className="flex items-center gap-2 text-slate-500"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-slate-300 text-blue-600" /> Remember me</label><button type="button" onClick={() => setMessage({ type: 'success', text: 'Password reset is available through your verified account email.' })} className="text-blue-600 hover:text-blue-700">Forgot password?</button></div>}
            <button type="submit" disabled={busy} className="rf-btn-primary w-full justify-center py-2.5">{busy ? 'Please wait…' : isSignup ? 'Create account' : isAdmin ? 'Enter admin dashboard' : 'Sign in'}</button>
          </form>
          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-500">{isSignup ? <>Already have an account? <button onClick={() => onModeChange('login')} className="text-blue-600 font-medium">Sign in</button></> : <>New to RupeeFlow? <button onClick={() => onModeChange('signup')} className="text-blue-600 font-medium">Create an account</button></>}</div>
          {!isAdmin && <button onClick={() => onModeChange('admin')} className="w-full mt-3 text-xs text-slate-400 hover:text-blue-600">Administrator access</button>}
          {isAdmin && <button onClick={() => onModeChange('login')} className="w-full mt-3 text-xs text-slate-400 hover:text-blue-600">Back to user login</button>}
        </div>
      </div>
    </div>
  );
}
