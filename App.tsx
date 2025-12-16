
import React, { useState, useEffect, useRef } from 'react';
import { 
  AppView, 
  UserProfile, 
  Product, 
  SkinMetrics, 
  SkinType 
} from './types';
import { loadUserData, saveUserData, syncLocalToCloud, clearLocalData } from './services/storageService';
import { trackEvent } from './services/analyticsService';
import { auth, signInAnonymously } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { startCheckout } from './services/stripeService';

// Components
import LandingPage from './components/LandingPage';
import Onboarding from './components/Onboarding';
import FaceScanner from './components/FaceScanner';
import SkinAnalysisReport from './components/SkinAnalysisReport';
import SmartShelf from './components/SmartShelf';
import ProductScanner from './components/ProductScanner';
import ProductSearch from './components/ProductSearch';
import ProfileSetup from './components/ProfileSetup';
import AIAssistant from './components/AIAssistant';
import BuyingAssistant from './components/BuyingAssistant';
import PremiumRoutineBuilder from './components/PremiumRoutineBuilder';
import SaveProfileModal, { AuthTrigger } from './components/SaveProfileModal';
import SmartNotification, { NotificationType } from './components/SmartNotification';
import BetaOfferModal from './components/BetaOfferModal';
import AdminDashboard from './components/AdminDashboard'; 

// Icons
import { ScanFace, LayoutGrid, User, Search, Home } from 'lucide-react';

const ADMIN_EMAILS = ['admin@skinos.ai', 'raf@admin.com'];

const App: React.FC = () => {
  // --- STATE ---
  // Default to LANDING unless loaded data says otherwise
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [shelf, setShelf] = useState<Product[]>([]);
  
  // Loading State for smooth transitions
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const viewRef = useRef<AppView>(AppView.LANDING); // Ref to track view inside callbacks

  // Temporary state for the product currently being analyzed in Buying Assistant
  const [analyzedProduct, setAnalyzedProduct] = useState<Product | null>(null);
  
  // State for pre-filling onboarding data from Google Auth
  const [prefillName, setPrefillName] = useState<string>('');
  
  // Modals & Overlays
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  
  // Auth Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalTrigger, setSaveModalTrigger] = useState<AuthTrigger>('GENERIC');

  // Premium Offer Modal State
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const [notification, setNotification] = useState<{ type: NotificationType, title: string, description: string, actionLabel: string, onAction: () => void } | null>(null);
  const [aiQuery, setAiQuery] = useState<string | null>(null);

  // Update ref whenever view changes
  useEffect(() => { viewRef.current = currentView; }, [currentView]);

  // --- ANALYTICS TRACKING ---
  // Track Session Start
  useEffect(() => {
    trackEvent('VIEW', 'SESSION_START');
  }, []);

  // Track View Changes
  useEffect(() => {
    trackEvent('VIEW', currentView);
  }, [currentView]);

  // --- HELPER: OPEN AUTH MODAL WITH CONTEXT ---
  const openAuth = (trigger: AuthTrigger) => {
      setSaveModalTrigger(trigger);
      setShowSaveModal(true);
  };

  // --- HELPER: OPEN PREMIUM MODAL ---
  const handleUnlockPremium = () => {
      // Prompt anonymous users to sign up first
      if (userProfile?.isAnonymous) {
          openAuth('UNLOCK_DEAL');
          return;
      }
      setShowPremiumModal(true);
  };

  // --- PERSISTENCE HELPER ---
  const persistState = (newUser: UserProfile, newShelf: Product[]) => {
      setUserProfile(newUser);
      setShelf(newShelf);
      saveUserData(newUser, newShelf);
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      // 1. Check for Payment Success Flag in URL
      const urlParams = new URLSearchParams(window.location.search);
      const isPaymentSuccess = urlParams.get('payment') === 'success';

      const data = await loadUserData();
      
      let currentUser = data.user;

      // Handle Payment Success Logic
      if (isPaymentSuccess && currentUser) {
          currentUser = { ...currentUser, isPremium: true };
          // Save immediately
          saveUserData(currentUser, data.shelf);
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          setNotification({
             type: 'GENERIC',
             title: 'Premium Unlocked!',
             description: 'You now have unlimited access to all features.',
             actionLabel: 'Great',
             onAction: () => {}
          });
      }

      if (currentUser) {
        setUserProfile(currentUser);
        setShelf(data.shelf);
        
        // ADMIN CHECK
        if (currentUser.email && ADMIN_EMAILS.includes(currentUser.email)) {
            setCurrentView(AppView.ADMIN);
            return;
        }

        if (currentUser.hasScannedFace) {
            // If payment just happened, go to Dashboard or Routine
            setCurrentView(isPaymentSuccess ? AppView.DASHBOARD : AppView.DASHBOARD);
        } else {
            setCurrentView(AppView.FACE_SCANNER);
        }
      } else {
        // No user data found locally
        // NOTE: We do NOT force Login/Onboarding here yet.
        // We wait for Firebase Auth to initialize.
        setCurrentView(AppView.LANDING);
      }
    };
    init();

    const unsubscribe = auth ? onAuthStateChanged(auth, async (user) => {
        if (user) {
            // AUTH DETECTED (Either Login, Register, or Anonymous)
            
            const isLoginFlow = viewRef.current === AppView.LANDING || viewRef.current === AppView.ONBOARDING;
            
            // Only show loader if we are in a transition state
            if (isLoginFlow) {
                 // Don't block screen if it's just anonymous login
                 if (!user.isAnonymous) setIsGlobalLoading(true);
            }

            try {
                await syncLocalToCloud();
                
                // ADMIN REDIRECT ON LOGIN
                if (user.email && ADMIN_EMAILS.includes(user.email)) {
                    // Create minimal admin profile if not exists
                    setUserProfile({
                        name: 'Admin',
                        age: 99,
                        skinType: SkinType.NORMAL,
                        hasScannedFace: true,
                        biometrics: {} as any,
                        isAnonymous: false,
                        email: user.email || undefined
                    });
                    setCurrentView(AppView.ADMIN);
                    setIsGlobalLoading(false);
                    setShowSaveModal(false);
                    return;
                }

                const data = await loadUserData();
                
                if (data.user) {
                    // Scenario A: Existing User Data Found
                    
                    // SELF-HEALING: Patch email if missing
                    let loadedUser = data.user;
                    if (user.email && !loadedUser.email) {
                        loadedUser = { ...loadedUser, email: user.email };
                        saveUserData(loadedUser, data.shelf);
                    }
                    
                    // FIX: Ensure isAnonymous matches Auth state
                    // If auth is anonymous, profile must be anonymous.
                    // If auth is real, profile must NOT be anonymous.
                    if (loadedUser.isAnonymous !== user.isAnonymous) {
                        loadedUser = { ...loadedUser, isAnonymous: user.isAnonymous };
                        saveUserData(loadedUser, data.shelf);
                    }

                    setUserProfile(loadedUser);
                    setShelf(data.shelf);
                    
                    // Only redirect if we were waiting on the landing page/onboarding
                    if (isLoginFlow) {
                        setCurrentView(data.user.hasScannedFace ? AppView.DASHBOARD : AppView.FACE_SCANNER);
                    }
                } else {
                    // Scenario B: No Profile Data Yet (Fresh Anonymous or New Login)
                    
                    if (user.isAnonymous) {
                        // It's a fresh guest. Do NOTHING. Let them stay on Landing.
                        // We do NOT want to force them to Onboarding yet.
                        // But we DO want to ensure `userProfile` is null so UI stays correct.
                        setUserProfile(null);
                        // However, we now have a `user` (uid) so we can write to DB later.
                    } else {
                        // It's a Real User (Google/Email) but no profile -> Force Onboarding
                        if (isLoginFlow) {
                            if (user.displayName) setPrefillName(user.displayName);
                            setCurrentView(AppView.ONBOARDING);
                        }
                    }
                }
            } catch (e) {
                console.error("Auth Sync Error", e);
            } finally {
                setTimeout(() => {
                    setIsGlobalLoading(false);
                    setShowSaveModal(false); 
                }, 500);
            }
        } else {
            // NO USER - AUTO SIGN IN ANONYMOUSLY
            // This ensures every visitor gets a UID immediately for Analytics/DB access
            signInAnonymously().catch(err => console.error("Guest Auth Failed", err));
        }
    }) : () => {};

    return () => unsubscribe();
  }, []);


  // --- HANDLERS ---
  const handleOnboardingComplete = (data: { name: string; age: number; skinType: SkinType }) => {
      const authUser = auth?.currentUser;
      const isAnonymous = authUser ? authUser.isAnonymous : true;

      const newUser: UserProfile = {
          name: data.name,
          age: data.age,
          skinType: data.skinType,
          hasScannedFace: false,
          biometrics: {} as any, 
          isAnonymous: isAnonymous, 
          isPremium: false,
          email: authUser?.email || undefined
      };
      
      setUserProfile(newUser);
      trackEvent('CONVERSION', 'SIGNUP_COMPLETE');
      
      // Save to Cloud (now works for anonymous too!)
      saveUserData(newUser, shelf);

      setCurrentView(AppView.FACE_SCANNER);
  };

  const handleFaceScanComplete = (metrics: SkinMetrics, image: string) => {
      // Allow scan completion even if userProfile is null (e.g. strict anonymous flow)
      // If null, create a temporary one
      const currentProfile = userProfile || {
          name: "Guest",
          age: 25,
          skinType: SkinType.UNKNOWN,
          hasScannedFace: false,
          biometrics: {} as any,
          isAnonymous: true,
          isPremium: false
      };

      const updatedUser: UserProfile = {
          ...currentProfile,
          hasScannedFace: true,
          biometrics: metrics,
          faceImage: image,
          scanHistory: [...(currentProfile.scanHistory || []), metrics]
      };

      persistState(updatedUser, shelf);
      setCurrentView(AppView.DASHBOARD);
  };

  // Called by Scanner/Search when a product is found
  const handleProductFound = (product: Product) => {
      setAnalyzedProduct(product);
      setCurrentView(AppView.BUYING_ASSISTANT);
  };

  // Called by Buying Assistant to confirm adding to shelf
  const handleAddToShelf = () => {
      if (!userProfile || !analyzedProduct) return;
      trackEvent('ACTION', 'ADD_TO_SHELF', { productId: analyzedProduct.id, name: analyzedProduct.name });
      const newShelf = [...shelf, analyzedProduct];
      persistState(userProfile, newShelf);
      setAnalyzedProduct(null);
      setCurrentView(AppView.SMART_SHELF);
  };

  // Called by Buying Assistant to discard result
  const handleDiscardProduct = () => {
      setAnalyzedProduct(null);
      // Return to shelf or dashboard
      setCurrentView(AppView.SMART_SHELF); 
  };

  const handleRemoveProduct = (id: string) => {
      if (!userProfile) return;
      const newShelf = shelf.filter(p => p.id !== id);
      persistState(userProfile, newShelf);
  };

  const handleUpdateProduct = (updated: Product) => {
       if (!userProfile) return;
       const newShelf = shelf.map(p => p.id === updated.id ? updated : p);
       persistState(userProfile, newShelf);
  }

  const handleProfileUpdate = (updatedProfile: UserProfile) => {
      persistState(updatedProfile, shelf);
  };

  const handleResetApp = () => {
      clearLocalData();
      setUserProfile(null);
      setShelf([]);
      setCurrentView(AppView.LANDING);
  }

  // --- NEW: HANDLE CODE UNLOCK ---
  const handleCodeUnlock = () => {
      if (!userProfile) return;
      const updatedUser = { ...userProfile, isPremium: true };
      persistState(updatedUser, shelf);
      setShowPremiumModal(false);
      
      setNotification({
          type: 'GENERIC',
          title: 'Premium Unlocked!',
          description: 'Access code redeemed successfully.',
          actionLabel: 'Awesome',
          onAction: () => {}
      });
  };

  // --- RENDER HELPERS ---
  const renderNavBar = () => {
      if (isGlobalLoading) return null; // Hide nav during loading
      // Hide nav on Admin page
      if ([AppView.LANDING, AppView.ONBOARDING, AppView.FACE_SCANNER, AppView.PRODUCT_SCANNER, AppView.PRODUCT_SEARCH, AppView.BUYING_ASSISTANT, AppView.ROUTINE_BUILDER, AppView.ADMIN].includes(currentView)) return null;

      const navItemClass = (view: AppView) => 
        `flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 ${currentView === view ? 'text-teal-600 bg-teal-50 scale-105' : 'text-zinc-400 hover:text-zinc-600'}`;

      const handleNavClick = (view: AppView) => {
          // RESTRICTION: Only logged-in users can search or scan products
          // UPDATE: Anonymous users CAN scan now because they have a UID! 
          // But we might still want to prompt sign up for retention.
          // For now, allow it to reduce friction.
          setCurrentView(view);
      };

      return (
          <div className="fixed bottom-6 left-6 right-6 h-20 bg-white/90 backdrop-blur-xl border border-zinc-200/50 rounded-[2rem] shadow-2xl flex items-center justify-around z-30 max-w-md mx-auto animate-in slide-in-from-bottom-24 duration-700">
              <button onClick={() => handleNavClick(AppView.DASHBOARD)} className={navItemClass(AppView.DASHBOARD)}>
                  <Home size={22} strokeWidth={currentView === AppView.DASHBOARD ? 2.5 : 2} />
              </button>
              
              <button onClick={() => handleNavClick(AppView.SMART_SHELF)} className={navItemClass(AppView.SMART_SHELF)}>
                  <LayoutGrid size={22} strokeWidth={currentView === AppView.SMART_SHELF ? 2.5 : 2} />
              </button>

              <div className="relative -top-8">
                  <button 
                    onClick={() => handleNavClick(AppView.PRODUCT_SCANNER)}
                    className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-teal-600/30 hover:scale-110 transition-transform active:scale-95"
                  >
                      <ScanFace size={24} />
                  </button>
              </div>

              <button onClick={() => handleNavClick(AppView.PRODUCT_SEARCH)} className={navItemClass(AppView.PRODUCT_SEARCH)}>
                  <Search size={22} strokeWidth={currentView === AppView.PRODUCT_SEARCH ? 2.5 : 2} />
              </button>

              <button onClick={() => handleNavClick(AppView.PROFILE_SETUP)} className={navItemClass(AppView.PROFILE_SETUP)}>
                  <User size={22} strokeWidth={currentView === AppView.PROFILE_SETUP ? 2.5 : 2} />
              </button>
          </div>
      );
  };

  const renderView = () => {
      // Fallback for corrupted state (if user is null but we are deep in app)
      if (!userProfile && ![AppView.LANDING, AppView.ONBOARDING].includes(currentView)) {
          return <LandingPage onGetStarted={() => setCurrentView(AppView.ONBOARDING)} onLogin={() => openAuth('GENERIC')} />;
      }

      switch (currentView) {
          case AppView.LANDING:
              return <LandingPage onGetStarted={() => setCurrentView(AppView.ONBOARDING)} onLogin={() => openAuth('GENERIC')} />;

          case AppView.ONBOARDING:
              return <Onboarding onComplete={handleOnboardingComplete} onSignIn={() => openAuth('GENERIC')} initialName={prefillName} />;
          
          case AppView.FACE_SCANNER:
              return (
                  <FaceScanner 
                    onScanComplete={handleFaceScanComplete} 
                    scanHistory={userProfile?.scanHistory}
                    onCancel={userProfile?.hasScannedFace ? () => setCurrentView(AppView.DASHBOARD) : undefined} 
                  />
              );
          
          case AppView.DASHBOARD:
              return userProfile ? (
                  <SkinAnalysisReport 
                    userProfile={userProfile} 
                    shelf={shelf} 
                    onRescan={() => setCurrentView(AppView.FACE_SCANNER)}
                    onConsultAI={(q) => { setAiQuery(q); setShowAIAssistant(true); }}
                    onViewProgress={() => setCurrentView(AppView.PROFILE_SETUP)}
                    onOpenRoutineBuilder={() => setCurrentView(AppView.ROUTINE_BUILDER)}
                    onLoginRequired={(reason) => openAuth(reason as AuthTrigger)}
                    onUnlockPremium={handleUnlockPremium}
                  />
              ) : null;

          case AppView.SMART_SHELF:
              return userProfile ? (
                  <SmartShelf 
                    products={shelf} 
                    userProfile={userProfile}
                    onRemoveProduct={handleRemoveProduct}
                    onUpdateProduct={handleUpdateProduct}
                    onScanNew={() => {
                        // Allow anonymous scanning too
                        setCurrentView(AppView.PRODUCT_SCANNER);
                    }}
                  />
              ) : null;
          
          case AppView.PRODUCT_SCANNER:
              return userProfile ? (
                  <ProductScanner 
                    userProfile={userProfile} 
                    onProductFound={handleProductFound}
                    onCancel={() => setCurrentView(AppView.SMART_SHELF)}
                  />
              ) : null;

          case AppView.PRODUCT_SEARCH:
              return userProfile ? (
                  <ProductSearch
                    userProfile={userProfile}
                    onProductFound={handleProductFound}
                    onCancel={() => setCurrentView(AppView.SMART_SHELF)}
                  />
              ) : null;
          
          case AppView.BUYING_ASSISTANT:
              return (userProfile && analyzedProduct) ? (
                  <BuyingAssistant 
                    product={analyzedProduct}
                    user={userProfile}
                    shelf={shelf}
                    onAddToShelf={handleAddToShelf}
                    onDiscard={handleDiscardProduct}
                    onUnlockPremium={handleUnlockPremium}
                  />
              ) : null;

          case AppView.ROUTINE_BUILDER:
              return userProfile ? (
                  <PremiumRoutineBuilder 
                      user={userProfile}
                      onBack={() => setCurrentView(AppView.DASHBOARD)}
                      onUnlockPremium={handleUnlockPremium}
                  />
              ) : null;

          case AppView.PROFILE_SETUP:
              return userProfile ? (
                  <ProfileSetup 
                    user={userProfile} 
                    shelf={shelf}
                    onComplete={handleProfileUpdate}
                    onBack={() => setCurrentView(AppView.DASHBOARD)}
                    onReset={handleResetApp}
                    onLoginRequired={(reason) => openAuth(reason as AuthTrigger)}
                    // Pass Admin Props
                    isAdmin={userProfile.email && ADMIN_EMAILS.includes(userProfile.email)}
                    onOpenAdmin={() => setCurrentView(AppView.ADMIN)}
                  />
              ) : null;

          case AppView.ADMIN:
              return <AdminDashboard onBack={() => setCurrentView(AppView.DASHBOARD)} />;

          default:
              return null;
      }
  };

  return (
    <div className="bg-zinc-50 min-h-screen font-sans text-zinc-900 selection:bg-teal-100 pb-safe-offset-bottom">
        {renderView()}
        {renderNavBar()}

        {userProfile && (
            <AIAssistant 
                isOpen={showAIAssistant} 
                onClose={() => setShowAIAssistant(false)}
                onOpen={() => setShowAIAssistant(true)}
                user={userProfile}
                shelf={shelf}
                triggerQuery={aiQuery}
            />
        )}

        {/* Global Loading Overlay */}
        {isGlobalLoading && (
            <div className="fixed inset-0 z-[100] bg-zinc-900 flex flex-col items-center justify-center animate-in fade-in duration-300">
                <div className="relative">
                     <div className="w-20 h-20 bg-teal-500/20 rounded-full animate-ping absolute inset-0"></div>
                     <div className="w-20 h-20 bg-gradient-to-tr from-teal-500 to-emerald-600 rounded-full relative z-10 flex items-center justify-center shadow-2xl border border-white/10">
                         <ScanFace size={32} className="text-white animate-pulse" />
                     </div>
                </div>
                <h2 className="text-white font-black text-xl mt-8 tracking-tight">Syncing Profile...</h2>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Please wait</p>
            </div>
        )}

        {showSaveModal && !isGlobalLoading && (
            <SaveProfileModal 
                mode={userProfile?.isAnonymous ? 'SAVE' : 'LOGIN'}
                trigger={saveModalTrigger}
                onClose={() => setShowSaveModal(false)}
                onSave={() => {}}
                onMockLogin={() => {
                    // For preview environments where domain auth fails
                    setShowSaveModal(false);
                    // Force a reload of state as if logged in
                    if (userProfile?.isAnonymous) {
                         const updatedUser = { ...userProfile, isAnonymous: false };
                         persistState(updatedUser, shelf);
                         setNotification({
                            type: 'GENERIC',
                            title: 'Preview Mode',
                            description: 'Auth domain not configured. Profile saved locally.',
                            actionLabel: 'OK',
                            onAction: () => {}
                        });
                    } else {
                         // Mock Login from Landing
                         setIsGlobalLoading(true);
                         setTimeout(() => {
                             setIsGlobalLoading(false);
                             setCurrentView(AppView.ONBOARDING);
                         }, 1500);
                    }
                }}
            />
        )}

        {/* PREMIUM BETA OFFER MODAL */}
        {showPremiumModal && (
            <BetaOfferModal 
                onClose={() => setShowPremiumModal(false)}
                onConfirm={() => {
                    setShowPremiumModal(false);
                    startCheckout();
                }}
                onCodeSuccess={handleCodeUnlock}
            />
        )}

        {notification && (
            <SmartNotification 
                {...notification} 
                onAction={() => {
                    notification.onAction();
                    setNotification(null);
                }}
                onClose={() => setNotification(null)}
            />
        )}
    </div>
  );
};

export default App;
