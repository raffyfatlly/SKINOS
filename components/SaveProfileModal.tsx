
import React, { useState } from 'react';
import { X, ShieldCheck, Fingerprint, Loader, AlertTriangle, Cloud, LogIn, UserCheck } from 'lucide-react';
import { signInWithGoogle } from '../services/firebase';

interface SaveProfileModalProps {
  onSave: () => void;
  onClose: () => void;
  onMockLogin?: () => void;
  mode: 'LOGIN' | 'SAVE';
}

const SaveProfileModal: React.FC<SaveProfileModalProps> = ({ onSave, onClose, onMockLogin, mode }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
        await signInWithGoogle();
        // The onAuthStateChanged listener in App.tsx will handle the state update and close this modal/redirect
        setTimeout(() => onClose(), 500); 
    } catch (e: any) {
        console.error(e);
        const msg = (e.message || "").toLowerCase();
        const code = e.code || "";

        // AUTO-FALLBACK FOR PREVIEW ENVIRONMENTS
        if (msg.includes("unauthorized-domain") || msg.includes("domain not authorized") || code === "auth/unauthorized-domain") {
             console.warn("Preview environment detected (Domain unauthorized). Enabling Preview Mode.");
             if (onMockLogin) {
                 await onMockLogin(); 
                 return;
             }
        }

        if (msg.includes("firebase not configured")) {
             setError("Database not connected. Check services/firebase.ts config.");
        } else if (msg.includes("google sign-in is not enabled")) {
             setError("Please enable Google Sign-In in your Firebase Console.");
        } else {
             setError("Login failed. Please try again.");
        }
        setLoading(false);
    }
  };

  const isLogin = mode === 'LOGIN';

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
            <div className="relative w-24 h-24 mx-auto mb-6">
                 <div className="absolute inset-0 bg-teal-100/50 rounded-full animate-pulse"></div>
                 <div className="relative w-full h-full bg-gradient-to-tr from-teal-50 to-white rounded-full flex items-center justify-center shadow-lg shadow-teal-100 border border-teal-100">
                    {isLogin ? (
                        <UserCheck size={36} className="text-teal-600" />
                    ) : (
                        <Cloud size={36} className="text-teal-600" />
                    )}
                 </div>
                 {!isLogin && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center">
                        <Fingerprint size={14} className="text-white" />
                    </div>
                 )}
            </div>

            <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-3">
                {isLogin ? "Welcome Back" : "Save Skin Profile"}
            </h2>
            
            <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-6">
                {isLogin 
                    ? "Sign in to access your dashboard, synced shelf, and past skin analysis history."
                    : "Create an account to backup your analysis, save your shelf, and track progress over time."
                }
            </p>

            <div className="space-y-3 mb-8 text-left">
                <div className="flex items-center gap-3 p-4 bg-teal-50/50 rounded-2xl border border-teal-100/50">
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                        <ShieldCheck size={14} className="text-teal-600" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-teal-900 block mb-0.5">Secure Cloud Sync</span>
                        <span className="text-[10px] text-teal-700 font-medium leading-none">Your skin data follows you everywhere.</span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-4 bg-rose-50 p-3 rounded-xl flex gap-3 items-start text-left border border-rose-100">
                    <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700 font-medium leading-snug">{error}</p>
                </div>
            )}

            <button 
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-4 rounded-[1.5rem] bg-zinc-900 text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-zinc-900/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
            >
                {loading ? <Loader size={16} className="animate-spin" /> : (
                    <>
                        <LogIn size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
                        {isLogin ? "Sign In with Google" : "Continue with Google"}
                    </>
                )}
            </button>
            
            {!isLogin && (
                <button onClick={onClose} disabled={loading} className="mt-6 text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors">
                    Maybe later
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default SaveProfileModal;
