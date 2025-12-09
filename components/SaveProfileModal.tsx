
import React, { useState } from 'react';
import { UserCheck, X, ShieldCheck, Sparkles, Fingerprint, Loader, LogIn, AlertTriangle } from 'lucide-react';
import { signInWithGoogle } from '../services/firebase';

interface SaveProfileModalProps {
  onSave: () => void;
  onClose: () => void;
  onMockLogin?: () => void;
}

const SaveProfileModal: React.FC<SaveProfileModalProps> = ({ onSave, onClose, onMockLogin }) => {
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

        // AUTO-FALLBACK FOR PREVIEW ENVIRONMENTS (e.g. AI Studio, StackBlitz)
        // If domain isn't authorized in Firebase, we allow a local "Mock" login so the user isn't stuck.
        if (msg.includes("unauthorized-domain") || msg.includes("domain not authorized") || code === "auth/unauthorized-domain") {
             console.warn("Preview environment detected (Domain unauthorized). Enabling Preview Mode.");
             if (onMockLogin) {
                 await onMockLogin(); 
                 // Do NOT set error, treat as success
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
                    <UserCheck size={36} className="text-teal-600" />
                 </div>
                 <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center">
                    <Fingerprint size={14} className="text-white" />
                 </div>
            </div>

            <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-3">Create Account</h2>
            
            <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-6">
                Save your skin analysis, sync data across devices, and unlock full cloud backup.
            </p>

            <div className="space-y-3 mb-8 text-left">
                <div className="flex items-center gap-3 p-4 bg-teal-50/50 rounded-2xl border border-teal-100/50">
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                        <ShieldCheck size={14} className="text-teal-600" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-teal-900 block mb-0.5">Secure Backup</span>
                        <span className="text-[10px] text-teal-700 font-medium leading-none">Your data follows you everywhere.</span>
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
                        <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </>
                )}
            </button>
            
            <button onClick={onClose} disabled={loading} className="mt-6 text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors">
                Maybe later
            </button>
        </div>
      </div>
    </div>
  );
};

export default SaveProfileModal;
