
import React, { useState } from 'react';
import { X, ShieldCheck, Cloud, UserCheck, Mail, Lock, ArrowRight, AlertTriangle, Loader } from 'lucide-react';
import { signInWithGoogle, registerWithEmail, loginWithEmail } from '../services/firebase';

interface SaveProfileModalProps {
  onSave: () => void;
  onClose: () => void;
  onMockLogin?: () => void;
  mode: 'LOGIN' | 'SAVE';
}

// Google Logo Component
const GoogleLogo = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const SaveProfileModal: React.FC<SaveProfileModalProps> = ({ onSave, onClose, onMockLogin, mode }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Toggle between "Save Profile" (Signup) and "Login" states inside the modal
  const [isLoginView, setIsLoginView] = useState(mode === 'LOGIN');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
        await signInWithGoogle();
        setTimeout(() => onClose(), 500); 
    } catch (e: any) {
        handleAuthError(e);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      try {
          if (isLoginView) {
              await loginWithEmail(email, password);
          } else {
              if (password !== confirmPassword) {
                  throw new Error("Passwords do not match.");
              }
              // Generate display name from email (part before @, capitalized)
              const namePart = email.split('@')[0];
              const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
              
              await registerWithEmail(displayName, email, password);
          }
          setTimeout(() => onClose(), 500);
      } catch (e: any) {
          handleAuthError(e);
      }
  };

  const handleAuthError = (e: any) => {
    console.error(e);
    const msg = (e.message || "").toLowerCase();
    const code = e.code || "";

    // AUTO-FALLBACK FOR PREVIEW ENVIRONMENTS
    if (msg.includes("unauthorized-domain") || msg.includes("domain not authorized") || code === "auth/unauthorized-domain") {
            console.warn("Preview environment detected (Domain unauthorized). Enabling Preview Mode.");
            if (onMockLogin) {
                onMockLogin(); 
                return;
            }
    }

    if (code === "auth/email-already-in-use") {
        setError("Email already exists. Try logging in.");
    } else if (code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setError("Invalid email or password.");
    } else if (code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
    } else if (msg.includes("firebase not configured")) {
            setError("Database not connected. Check services/firebase.ts config.");
    } else if (msg.includes("google sign-in is not enabled")) {
            setError("Please enable Google Sign-In in your Firebase Console.");
    } else {
            setError(e.message || "Authentication failed.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 relative animate-in zoom-in-95 shadow-2xl overflow-hidden border border-white/50">
        
        {/* Decorative Background Elements - Teal Theme */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-teal-50 rounded-full -mr-12 -mt-12 blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-50 rounded-full -ml-10 -mb-10 blur-2xl opacity-60"></div>

        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-zinc-50 rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors z-50 active:scale-95">
          <X size={20} />
        </button>

        <div className="relative z-10 text-center pt-2">
            <div className="relative w-20 h-20 mx-auto mb-6">
                 <div className="absolute inset-0 bg-teal-100/50 rounded-full animate-pulse"></div>
                 <div className="relative w-full h-full bg-gradient-to-tr from-teal-50 to-white rounded-full flex items-center justify-center shadow-lg shadow-teal-100 border border-teal-100">
                    {isLoginView ? (
                        <UserCheck size={32} className="text-teal-600" />
                    ) : (
                        <Cloud size={32} className="text-teal-600" />
                    )}
                 </div>
            </div>

            <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-2">
                {isLoginView ? "Welcome Back" : "Save Skin Profile"}
            </h2>
            
            <p className="text-xs text-zinc-500 font-medium leading-relaxed mb-6">
                {isLoginView 
                    ? "Access your synced shelf and scan history."
                    : "Create an account to save your analysis and track progress."
                }
            </p>

            {error && (
                <div className="mb-4 bg-rose-50 p-3 rounded-xl flex gap-3 items-start text-left border border-rose-100 animate-in slide-in-from-top-2">
                    <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700 font-medium leading-snug">{error}</p>
                </div>
            )}

            {/* EMAIL FORM */}
            <form onSubmit={handleEmailAuth} className="space-y-3 mb-6">
                <div className="relative group">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-teal-600 transition-colors" />
                    <input 
                        type="email" 
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all"
                        required
                    />
                </div>
                <div className="relative group">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-teal-600 transition-colors" />
                    <input 
                        type="password" 
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all"
                        required
                        minLength={6}
                    />
                </div>
                
                {!isLoginView && (
                    <div className="relative group">
                        <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-teal-600 transition-colors" />
                        <input 
                            type="password" 
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all"
                            required
                            minLength={6}
                        />
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-teal-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    {loading ? <Loader size={16} className="animate-spin" /> : (
                        <>
                            {isLoginView ? "Sign In" : "Save Profile"} <ArrowRight size={14} />
                        </>
                    )}
                </button>
            </form>

            <div className="relative flex py-2 items-center mb-6">
                <div className="flex-grow border-t border-zinc-100"></div>
                <span className="flex-shrink-0 mx-4 text-zinc-300 text-[10px] font-bold uppercase tracking-widest">Or continue with</span>
                <div className="flex-grow border-t border-zinc-100"></div>
            </div>

            <button 
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-zinc-50 text-zinc-700 font-bold text-xs uppercase tracking-widest border border-zinc-200 hover:bg-zinc-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1 group disabled:opacity-70"
            >
                {loading ? <Loader size={16} className="animate-spin" /> : (
                    <>
                        <GoogleLogo />
                        Google
                    </>
                )}
            </button>
            
            <div className="mt-6 text-center">
                <button 
                    onClick={() => {
                        setIsLoginView(!isLoginView);
                        setError(null);
                        setConfirmPassword('');
                        setPassword('');
                    }} 
                    disabled={loading} 
                    className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors font-medium"
                >
                    {isLoginView ? (
                        <>Don't have an account? <span className="font-bold text-teal-600 underline">Sign Up</span></>
                    ) : (
                        <>Already have an account? <span className="font-bold text-teal-600 underline">Log In</span></>
                    )}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SaveProfileModal;
