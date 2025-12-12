import React, { useState, useEffect } from 'react';
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
import Onboarding from './components/Onboarding';
import FaceScanner from './components/FaceScanner';
import SkinAnalysisReport from './components/SkinAnalysisReport';
import SmartShelf from './components/SmartShelf';
import ProductScanner from './components/ProductScanner';
import ProductSearch from './components/ProductSearch';
import ProfileSetup from './components/ProfileSetup';
import AIAssistant from './components/AIAssistant';
import SaveProfileModal from './components/SaveProfileModal';
import SmartNotification, { NotificationType } from './components/SmartNotification';

// Icons
import { ScanFace, LayoutGrid, User, Search, Home } from 'lucide-react';

const App: React.FC = () => {
  // --- STATE ---
  const [currentView, setCurrentView] = useState<AppView>(AppView.ONBOARDING);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [shelf, setShelf] = useState<Product[]>([]);
  
  // Modals & Overlays
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [notification, setNotification] = useState<{ type: NotificationType, title: string, desc: string, action: string, onAction: () => void } | null>(null);
  const [aiQuery, setAiQuery] = useState<string | null>(null);

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
        setCurrentView(AppView.ONBOARDING);
      }
    };
    init();

    const unsubscribe = auth ? onAuthStateChanged(auth, async (user) => {
        if (user) {
            await syncLocalToCloud();
            const data = await loadUserData();
            if (data.user) {
                setUserProfile(data.user);
                setShelf(data.shelf);
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

  const handleProductFound = (product: Product) => {
      if (!userProfile) return;
      const newShelf = [...shelf, product];
      persistState(userProfile, newShelf);
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
      setCurrentView(AppView.ONBOARDING);
  }

  // --- RENDER HELPERS ---
  const renderNavBar = () => {
      if ([AppView.ONBOARDING, AppView.FACE_SCANNER, AppView.PRODUCT_SCANNER, AppView.PRODUCT_SEARCH].includes(currentView)) return null;

      const navItemClass = (view: AppView) => 
        `flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 ${currentView === view ? 'text-teal-600 bg-teal-50 scale-105' : 'text-zinc-400 hover:text-zinc-600'}`;

      const handleNavClick = (view: AppView) => {
          // RESTRICTION: Only logged-in users can search or scan products
          if ((view === AppView.PRODUCT_SEARCH || view === AppView.PRODUCT_SCANNER) && userProfile?.isAnonymous) {
              setNotification({
                  type: 'GENERIC',
                  title: 'Member Exclusive',
                  desc: 'Create an account to add products.',
                  action: 'Join',
                  onAction: () => setShowSaveModal(true)
              });
              setShowSaveModal(true);
              return;
          }
          setCurrentView(view);
      };

      return (
          <div className="fixed bottom-6 left-6 right-6 h-20 bg-white/90 backdrop-blur-xl border border-zinc-200/50 rounded-[2rem] shadow-2xl flex items-center justify-around z-30 max-w-md mx-auto">
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
      // Fallback for corrupted state
      if (!userProfile && currentView !== AppView.ONBOARDING) {
          return <Onboarding onComplete={handleOnboardingComplete} onSignIn={() => setShowSaveModal(true)} />;
      }

      switch (currentView) {
          case AppView.ONBOARDING:
              return <Onboarding onComplete={handleOnboardingComplete} onSignIn={() => setShowSaveModal(true)} />;
          
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
                    onLoginRequired={() => setShowSaveModal(true)}
                  />
              ) : null;

          case AppView.SMART_SHELF:
              return userProfile ? (
                  <SmartShelf 
                    products={shelf} 
                    userProfile={userProfile}
                    onRemoveProduct={handleRemoveProduct}
                    onUpdateProduct={handleUpdateProduct}
                    onScanNew={() => setCurrentView(AppView.PRODUCT_SCANNER)}
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

          case AppView.PROFILE_SETUP:
              return userProfile ? (
                  <ProfileSetup 
                    user={userProfile} 
                    shelf={shelf}
                    onComplete={handleProfileUpdate}
                    onBack={() => setCurrentView(AppView.DASHBOARD)}
                    onReset={handleResetApp}
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

        {showSaveModal && (
            <SaveProfileModal 
                mode={userProfile?.isAnonymous ? 'SAVE' : 'LOGIN'}
                onClose={() => setShowSaveModal(false)}
                onSave={() => {}}
                onMockLogin={() => setShowSaveModal(false)}
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