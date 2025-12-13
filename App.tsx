
import React, { useState, useEffect, useRef } from 'react';
import { 
  AppView, 
  UserProfile, 
  Product, 
  SkinMetrics, 
  SkinType 
} from './types';
import { loadUserData, saveUserData, syncLocalToCloud, clearLocalData } from './services/storageService';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

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

// Icons
import { ScanFace, LayoutGrid, User, Search, Home, Loader } from 'lucide-react';

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
  
  // Modals & Overlays
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  
  // Auth Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalTrigger, setSaveModalTrigger] = useState<AuthTrigger>('GENERIC');

  const [notification, setNotification] = useState<{ type: NotificationType, title: string, description: string, actionLabel: string, onAction: () => void } | null>(null);
  const [aiQuery, setAiQuery] = useState<string | null>(null);

  // Update ref whenever view changes
  useEffect(() => { viewRef.current = currentView; }, [currentView]);

  // --- HELPER: OPEN AUTH MODAL WITH CONTEXT ---
  const openAuth = (trigger: AuthTrigger) => {
      setSaveModalTrigger(trigger);
      setShowSaveModal(true);
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      const data = await loadUserData();
      if (data.user) {
        setUserProfile(data.user);
        setShelf(data.shelf);
        if (data.user.hasScannedFace) {
            setCurrentView(AppView.DASHBOARD);
        } else {
            setCurrentView(AppView.FACE_SCANNER);
        }
      } else {
        // No user data found -> Show Landing Page
        setCurrentView(AppView.LANDING);
      }
    };
    init();

    const unsubscribe = auth ? onAuthStateChanged(auth, async (user) => {
        if (user) {
            // DETECT LOGIN FLOW: If we are currently on Landing/Onboarding, show loading
            // This prevents "stuck" UI while we fetch cloud data
            const isLoginFlow = viewRef.current === AppView.LANDING || viewRef.current === AppView.ONBOARDING;
            
            if (isLoginFlow) {
                 setIsGlobalLoading(true);
            }

            try {
                await syncLocalToCloud();
                const data = await loadUserData();
                if (data.user) {
                    setUserProfile(data.user);
                    setShelf(data.shelf);
                    
                    // Force navigation if we were in the login flow
                    if (isLoginFlow) {
                        setCurrentView(data.user.hasScannedFace ? AppView.DASHBOARD : AppView.FACE_SCANNER);
                    }
                }
            } catch (e) {
                console.error("Auth Sync Error", e);
            } finally {
                // Small delay to ensure smooth visual transition
                setTimeout(() => {
                    setIsGlobalLoading(false);
                    setShowSaveModal(false); 
                }, 500);
            }
        }
    }) : () => {};

    return () => unsubscribe();
  }, []);

  // --- PERSISTENCE HELPER ---
  const persistState = (newUser: UserProfile, newShelf: Product[]) => {
      setUserProfile(newUser);
      setShelf(newShelf);
      saveUserData(newUser, newShelf);
  };

  // --- HANDLERS ---
  const handleOnboardingComplete = (data: { name: string; age: number; skinType: SkinType }) => {
      const newUser: UserProfile = {
          name: data.name,
          age: data.age,
          skinType: data.skinType,
          hasScannedFace: false,
          biometrics: {} as any, 
          isAnonymous: true
      };
      setUserProfile(newUser);
      setCurrentView(AppView.FACE_SCANNER);
  };

  const handleFaceScanComplete = (metrics: SkinMetrics, image: string) => {
      if (!userProfile) return;

      const updatedUser: UserProfile = {
          ...userProfile,
          hasScannedFace: true,
          biometrics: metrics,
          faceImage: image,
          scanHistory: [...(userProfile.scanHistory || []), metrics]
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

  // --- RENDER HELPERS ---
  const renderNavBar = () => {
      if (isGlobalLoading) return null; // Hide nav during loading
      if ([AppView.LANDING, AppView.ONBOARDING, AppView.FACE_SCANNER, AppView.PRODUCT_SCANNER, AppView.PRODUCT_SEARCH, AppView.BUYING_ASSISTANT, AppView.ROUTINE_BUILDER].includes(currentView)) return null;

      const navItemClass = (view: AppView) => 
        `flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 ${currentView === view ? 'text-teal-600 bg-teal-50 scale-105' : 'text-zinc-400 hover:text-zinc-600'}`;

      const handleNavClick = (view: AppView) => {
          // RESTRICTION: Only logged-in users can search or scan products
          if ((view === AppView.PRODUCT_SEARCH || view === AppView.PRODUCT_SCANNER) && userProfile?.isAnonymous) {
              openAuth('SCAN_PRODUCT');
              return;
          }
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
              return <Onboarding onComplete={handleOnboardingComplete} onSignIn={() => openAuth('GENERIC')} />;
          
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
                        if (userProfile.isAnonymous) {
                            openAuth('SCAN_PRODUCT');
                        } else {
                            setCurrentView(AppView.PRODUCT_SCANNER);
                        }
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
                  />
              ) : null;

          case AppView.ROUTINE_BUILDER:
              return userProfile ? (
                  <PremiumRoutineBuilder 
                      user={userProfile}
                      onBack={() => setCurrentView(AppView.DASHBOARD)}
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
                  />
              ) : null;

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
