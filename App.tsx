import React, { useState, useEffect } from 'react';
import { UserProfile, AppView, Product, SkinMetrics, SkinType } from './types';
import FaceScanner from './components/FaceScanner';
import ProductScanner from './components/ProductScanner';
import ProductSearch from './components/ProductSearch';
import SmartShelf from './components/SmartShelf';
import SkinAnalysisReport from './components/SkinAnalysisReport';
import Onboarding from './components/Onboarding';
import GuideOverlay from './components/GuideOverlay';
import SaveProfileModal from './components/SaveProfileModal';
import ProfileSetup from './components/ProfileSetup';
import AIAssistant from './components/AIAssistant';
import { getBuyingDecision, findBetterAlternatives, SearchResult, analyzeProductFromSearch, generatePersonalizedHolyGrails } from './services/geminiService';
import { auth } from './services/firebase';
import { loadUserData, saveUserData, syncLocalToCloud, clearLocalData } from './services/storageService';
import { LayoutGrid, ScanBarcode, User, Sparkles, HelpCircle, ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle as QuestionIcon, ThumbsUp, ArrowRightLeft, ThumbsDown, FlaskConical, ShoppingBag, X, Zap, WifiOff, Camera, Search, Globe, ChevronRight, CheckCircle2, Droplet, Sun, Layers, Brush, TrendingUp, PiggyBank, ArrowRight, Loader } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

// --- VISUAL HIGHLIGHT COMPONENT ---
const PulseRing = ({ color = 'teal' }: { color?: 'teal' | 'indigo' }) => (
    <>
        <span className={`absolute -inset-1 rounded-[1.4rem] border-2 ${color === 'teal' ? 'border-teal-400' : 'border-indigo-400'} opacity-30 animate-ping pointer-events-none duration-1000`} />
        <span className={`absolute -inset-1 rounded-[1.4rem] border ${color === 'teal' ? 'border-teal-500' : 'border-indigo-500'} opacity-100 pointer-events-none shadow-[0_0_15px_rgba(20,184,166,0.5)]`} />
    </>
);

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  isHighlighted?: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, isHighlighted }) => (
  <button 
      onClick={onClick}
      className={`w-12 h-12 rounded-[1rem] flex items-center justify-center transition-all duration-300 relative ${
        active 
          ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/10 scale-105' 
          : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'
      }`}
  >
      {isHighlighted && <PulseRing color="teal" />}
      {icon}
  </button>
);

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.ONBOARDING);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tempUserData, setTempUserData] = useState<{name: string, age: number, skinType: SkinType} | null>(null);
  const [shelf, setShelf] = useState<Product[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Alternatives Search State
  const [alternatives, setAlternatives] = useState<SearchResult[]>([]);
  const [isSearchingAlternatives, setIsSearchingAlternatives] = useState(false);
  const [isAnalyzingAlternative, setIsAnalyzingAlternative] = useState(false);
  
  // Holy Grail Cache (Background Search)
  const [holyGrailCache, setHolyGrailCache] = useState<Record<string, SearchResult>>({});
  const [enticement, setEnticement] = useState<{ type: 'UPGRADE' | 'VALUE' | 'VALIDATED', product: SearchResult } | null>(null);

  // AI Chat State
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiTriggerQuery, setAiTriggerQuery] = useState<string | null>(null);
  
  // New Guidance State
  const [guideStep, setGuideStep] = useState<'ANALYSIS' | 'SCAN' | 'SHELF' | null>(null);
  const [showSaveProfileModal, setShowSaveProfileModal] = useState(false);
  const [saveModalMode, setSaveModalMode] = useState<'LOGIN' | 'SAVE'>('SAVE');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // Add Product Menu State
  const [showAddProductMenu, setShowAddProductMenu] = useState(false);

  // --- INITIAL DATA LOAD & AUTH LISTENER ---
  useEffect(() => {
    const initApp = async () => {
        // Load initial data (Local or Cloud if already authed)
        const { user: loadedUser, shelf: loadedShelf } = await loadUserData();
        
        if (loadedUser) {
             // Ensure backwards compatibility
             if (loadedUser.isAnonymous === undefined) loadedUser.isAnonymous = false;
             if (!loadedUser.scanHistory) loadedUser.scanHistory = [loadedUser.biometrics];
             
             setUser(loadedUser);
             setShelf(loadedShelf);
             setView(AppView.DASHBOARD);
             
             // Trigger background search if we have user data but no cache
             triggerBackgroundSearch(loadedUser);
        }
        setIsLoading(false);
    };

    initApp();

    // Setup Auth Listener
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // User just logged in
                console.log("User logged in:", currentUser.email);
                await syncLocalToCloud(); // Push guest data if new account
                const { user: cloudUser, shelf: cloudShelf } = await loadUserData(); // Re-fetch final state
                if (cloudUser) {
                     setUser(cloudUser);
                     setShelf(cloudShelf);
                     setView(AppView.DASHBOARD);
                     setIsPreviewMode(false);
                     setShowSaveProfileModal(false);
                     triggerBackgroundSearch(cloudUser);
                }
            } else {
                // User logged out
                console.log("User logged out");
            }
        });
        return () => unsubscribe();
    }
  }, []);

  const triggerBackgroundSearch = (u: UserProfile) => {
      // Only run if cache is empty to avoid spamming API
      if (Object.keys(holyGrailCache).length === 0) {
          console.log("Triggering Background Holy Grail Search...");
          generatePersonalizedHolyGrails(u).then(results => {
              console.log("Holy Grail Cache Updated", results);
              setHolyGrailCache(results);
          }).catch(err => console.error("Background search failed", err));
      }
  };

  // --- INTERACTIVE GUIDE SEQUENCER ---
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Sequence Logic: Analysis (5s) -> Scan (5s) -> Shelf (5s) -> Off
    if (guideStep === 'ANALYSIS') {
        timer = setTimeout(() => {
            setGuideStep('SCAN');
        }, 5000);
    } else if (guideStep === 'SCAN') {
        timer = setTimeout(() => {
            setGuideStep('SHELF');
        }, 5000);
    } else if (guideStep === 'SHELF') {
        timer = setTimeout(() => {
            setGuideStep(null);
        }, 5000);
    }
    return () => clearTimeout(timer);
  }, [guideStep]);

  const startGuide = (isManual = false) => {
      // If not manually triggered, check if user has already seen the guide
      const hasSeen = localStorage.getItem('skinos_guide_seen_v2');
      if (!isManual && hasSeen) return;

      // Reset first to allow re-triggering if clicked rapidly
      setGuideStep(null);
      setTimeout(() => setGuideStep('ANALYSIS'), 100);

      // Mark as seen
      if (!isManual) {
          localStorage.setItem('skinos_guide_seen_v2', 'true');
      }
  };

  const advanceGuideStep = () => {
      if (guideStep === 'ANALYSIS') setGuideStep('SCAN');
      else if (guideStep === 'SCAN') setGuideStep('SHELF');
      else setGuideStep(null);
  };

  const stopGuide = () => {
      setGuideStep(null);
  };

  const resetApp = () => {
      clearLocalData();
      setUser(null);
      setShelf([]);
      setTempUserData(null);
      setGuideStep(null);
      setIsPreviewMode(false);
      setView(AppView.ONBOARDING);
      setHolyGrailCache({}); // Clear cache
  };

  const handleOnboardingComplete = (data: { name: string; age: number; skinType: SkinType }) => {
    setTempUserData(data);
    setView(AppView.FACE_SCANNER);
  };

  const handleScanComplete = (metrics: SkinMetrics, image: string) => {
    if (!tempUserData && !user) return; 

    const baseData = user ? { name: user.name, age: user.age, skinType: user.skinType } : tempUserData!;
    // If we have an auth user, they are not anonymous. If guest, they are anonymous.
    const isAnonymous = user ? user.isAnonymous : !auth?.currentUser && !isPreviewMode;
    const history = user?.scanHistory || [];

    const newUser: UserProfile = {
      ...baseData,
      hasScannedFace: true,
      biometrics: metrics,
      scanHistory: [...history, metrics], 
      faceImage: image,
      isAnonymous
    };
    
    setUser(newUser);
    saveUserData(newUser, shelf); // Save to Storage Service
    setView(AppView.DASHBOARD);
    
    // Refresh Holy Grail Cache with new metrics
    setHolyGrailCache({}); // Reset old cache
    triggerBackgroundSearch(newUser);
  };

  const handleProductFound = (product: Product) => {
    setLastScannedProduct(product);
    setAlternatives([]); // Reset alternatives
    setEnticement(null); // Reset enticement
    
    // Check against Holy Grail Cache for smart enticement
    const type = product.type;
    // Map product type to cache keys
    let cacheKey = type;
    if (type === 'SERUM' || type === 'TREATMENT') cacheKey = 'TREATMENT';

    const holyGrail = holyGrailCache[cacheKey];
    
    if (holyGrail) {
        const productScore = product.suitabilityScore;
        const grailScore = holyGrail.score || 95;
        const productPrice = product.estimatedPrice || 0;
        const grailPrice = holyGrail.price || 100;

        if (productScore < grailScore - 5) {
            // Significant upgrade available
            setEnticement({ type: 'UPGRADE', product: holyGrail });
        } else if (grailPrice < productPrice - 15) {
            // Cheaper alternative available with high score
            setEnticement({ type: 'VALUE', product: holyGrail });
        } else {
             // Validate choice
             setEnticement({ type: 'VALIDATED', product: holyGrail });
        }
    }

    setShowProductModal(true);
    setView(AppView.SMART_SHELF); 
  };

  const addToShelf = () => {
    if (lastScannedProduct && user) {
      const newShelf = [...shelf, lastScannedProduct];
      setShelf(newShelf);
      saveUserData(user, newShelf); // Save to Storage Service
      setShowProductModal(false);
      setLastScannedProduct(null);
      setAlternatives([]);
    }
  };

  const removeFromShelf = (id: string) => {
    if (user) {
        const newShelf = shelf.filter(p => p.id !== id);
        setShelf(newShelf);
        saveUserData(user, newShelf); // Save to Storage Service
    }
  };
  
  const handleUpdateProduct = (updatedProduct: Product) => {
    if (user) {
        const newShelf = shelf.map(p => p.id === updatedProduct.id ? updatedProduct : p);
        setShelf(newShelf);
        saveUserData(user, newShelf);
    }
  };

  const handleCloseSaveProfile = () => {
      setShowSaveProfileModal(false);
  }

  const handleMockLogin = () => {
      if (user) {
          console.log("Activating Preview/Offline Mode");
          setIsPreviewMode(true);
          const updatedUser = { ...user, isAnonymous: false };
          setUser(updatedUser);
          saveUserData(updatedUser, shelf);
          setShowSaveProfileModal(false);
      } else if (saveModalMode === 'LOGIN') {
          // If we are in login mode but no user exists (from onboarding), allow mock login
          // Create dummy user for preview
          console.log("Activating Preview/Offline Mode (New User)");
          setIsPreviewMode(true);
          const mockUser: UserProfile = {
              name: "Preview User",
              age: 25,
              skinType: SkinType.NORMAL,
              hasScannedFace: false,
              biometrics: {
                  overallScore: 85, acneActive: 90, acneScars: 90, poreSize: 85, blackheads: 85,
                  wrinkleFine: 90, wrinkleDeep: 95, sagging: 90, pigmentation: 85, redness: 85,
                  texture: 85, hydration: 80, oiliness: 80, darkCircles: 80, timestamp: Date.now()
              },
              isAnonymous: false
          };
          setUser(mockUser);
          setShelf([]);
          setView(AppView.DASHBOARD);
          setShowSaveProfileModal(false);
          triggerBackgroundSearch(mockUser);
      }
  };
  
  const openAddProductMenu = () => {
      setShowAddProductMenu(true);
  }

  const handleFindAlternatives = async () => {
      if (!lastScannedProduct || !user) return;
      setIsSearchingAlternatives(true);
      try {
          const results = await findBetterAlternatives(lastScannedProduct.type, user);
          setAlternatives(results);
      } catch (e) {
          console.error("Failed to find alternatives", e);
      } finally {
          setIsSearchingAlternatives(false);
      }
  }

  const handleSelectAlternative = async (alt: SearchResult) => {
      if (!user) return;
      setIsAnalyzingAlternative(true);
      try {
          // Analyze the selected alternative as a new product
          // Pass the 'score' from the search result to maintain consistency in the rating
          const newProduct = await analyzeProductFromSearch(alt.name, user.biometrics, alt.score);
          // Replace current view with the new product
          handleProductFound(newProduct);
      } catch (e) {
          console.error("Failed to analyze alternative", e);
      } finally {
          setIsAnalyzingAlternative(false);
      }
  }

  const getProductIcon = (type: string) => {
      switch(type) {
          case 'CLEANSER': return <Droplet size={18} />;
          case 'SPF': return <Sun size={18} />;
          case 'SERUM': return <Zap size={18} />;
          case 'MOISTURIZER': return <FlaskConical size={18} />;
          case 'FOUNDATION': return <Brush size={18} />;
          case 'PRIMER': return <Layers size={18} />;
          default: return <Sparkles size={18} />;
      }
  }

  // Splash Screen
  if (isLoading) {
      return (
          <div className="h-screen w-full bg-white flex flex-col items-center justify-center">
              <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-[2rem] bg-teal-600 text-white flex items-center justify-center shadow-2xl shadow-teal-200">
                      <Sparkles className="animate-pulse" size={32} strokeWidth={1.5} />
                  </div>
                  <div className="absolute inset-0 bg-teal-600 rounded-[2rem] animate-ping opacity-20"></div>
              </div>
              <h1 className="text-sm font-bold tracking-[0.25em] uppercase text-zinc-900">SkinOS</h1>
              <p className="text-xs text-zinc-400 mt-2 font-medium">Initializing Database...</p>
          </div>
      )
  }

  const renderView = () => {
    switch (view) {
      case AppView.ONBOARDING:
        return <Onboarding 
            onComplete={handleOnboardingComplete} 
            onSignIn={() => {
                setSaveModalMode('LOGIN');
                setShowSaveProfileModal(true);
            }} 
        />;

      case AppView.FACE_SCANNER:
        return <FaceScanner 
            key="face-scanner" 
            onScanComplete={handleScanComplete} 
            scanHistory={user?.scanHistory || []} 
            onCancel={() => {
                if (user) {
                    setView(AppView.DASHBOARD);
                } else {
                    setView(AppView.ONBOARDING);
                }
            }}
        />;
      
      case AppView.PRODUCT_SCANNER:
        return user ? (
          <ProductScanner 
            userProfile={user} 
            onProductFound={handleProductFound} 
            onCancel={() => setView(AppView.DASHBOARD)} 
          />
        ) : null;
        
      case AppView.PRODUCT_SEARCH:
        return user ? (
          <ProductSearch 
             userProfile={user}
             onProductFound={handleProductFound}
             onCancel={() => setView(AppView.DASHBOARD)}
          />
        ) : null;

      case AppView.SMART_SHELF:
        return user ? (
            <div className="pt-28 min-h-screen bg-white animate-in fade-in">
                 <SmartShelf 
                    products={shelf} 
                    onRemoveProduct={removeFromShelf} 
                    onScanNew={openAddProductMenu}
                    onUpdateProduct={handleUpdateProduct}
                    userProfile={user}
                />
            </div>
        ) : null;

      case AppView.PROFILE_SETUP:
        return user ? (
          <div className="pt-0 min-h-screen bg-white animate-in fade-in">
             <ProfileSetup 
                user={user} 
                shelf={shelf}
                onComplete={(updatedUser) => {
                    setUser(updatedUser);
                    saveUserData(updatedUser, shelf);
                }} 
                onBack={() => setView(AppView.DASHBOARD)} 
                onReset={resetApp}
             />
          </div>
        ) : null;

      case AppView.DASHBOARD:
      default:
        return user ? (
          <div className="pt-28 pb-32 min-h-screen bg-white animate-in fade-in duration-700">
             {/* Clean Modern Header */}
             <header className="fixed top-0 left-0 right-0 z-30 px-6 pt-12 pb-4 bg-white/90 backdrop-blur-xl border-b border-zinc-50 flex justify-between items-center h-28 transition-all">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-zinc-400 text-[10px] font-bold tracking-widest uppercase">
                          {user.isAnonymous ? 'Hello' : 'Welcome back'}
                        </p>
                        <button 
                            onClick={() => startGuide(true)}
                            className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                        >
                            <HelpCircle size={12} />
                        </button>
                    </div>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight">{user.name}</h1>
                </div>
                
                {/* AVATAR / PROFILE BUTTON */}
                <button 
                    className={`relative w-12 h-12 rounded-[1rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center font-bold text-teal-600 shadow-sm cursor-pointer group hover:bg-zinc-100 transition-colors z-30 active:scale-95`}
                    onClick={() => {
                        if (user.isAnonymous) {
                             setSaveModalMode('SAVE');
                             setShowSaveProfileModal(true);
                        } else {
                            setView(AppView.PROFILE_SETUP);
                        }
                    }}
                >
                    {user.name.charAt(0)}
                    {user.isAnonymous && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                </button>
             </header>

             <div className="px-6 space-y-12">
                {isPreviewMode && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-3 animate-in slide-in-from-top-4">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                            <WifiOff size={14} className="text-amber-600" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-amber-800 block">Preview Mode Active</span>
                            <span className="text-xs text-amber-600 font-medium leading-none">Changes saved locally (Domain unauthorized for cloud).</span>
                        </div>
                    </div>
                )}

                <SkinAnalysisReport 
                    userProfile={user}
                    shelf={shelf}
                    onRescan={() => {
                        if (user.isAnonymous) {
                             setSaveModalMode('SAVE');
                             setShowSaveProfileModal(true);
                        } else {
                            setTempUserData({ name: user.name, age: user.age, skinType: user.skinType });
                            setView(AppView.FACE_SCANNER);
                        }
                    }}
                    onConsultAI={(query) => {
                        setAiTriggerQuery(query);
                        setIsAiChatOpen(true);
                    }}
                    onViewProgress={() => setView(AppView.PROFILE_SETUP)}
                />
             </div>
          </div>
        ) : null;
    }
  };

  // --- SHOPPING ASSISTANT RENDERER ---
  const renderBuyingDecision = () => {
      if (!lastScannedProduct || !user) return null;

      const { verdict, audit, shelfConflicts, existingSameType, comparison } = getBuyingDecision(lastScannedProduct, shelf, user);
      
      // Sleek Theme Generator
      const getTheme = (color: string) => {
          switch(color) {
              case 'emerald': return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: ShieldCheck };
              case 'rose': return { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: AlertTriangle };
              case 'amber': return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: AlertOctagon };
              default: return { text: 'text-zinc-600', bg: 'bg-zinc-50', border: 'border-zinc-200', icon: HelpCircle };
          }
      }
      const theme = getTheme(verdict.color);
      
      const sortedBenefits = [...lastScannedProduct.benefits].sort((a, b) => {
          const scoreA = user.biometrics[a.target as keyof SkinMetrics] as number || 100;
          const scoreB = user.biometrics[b.target as keyof SkinMetrics] as number || 100;
          return scoreA - scoreB;
      });

      const isLowScore = audit.adjustedScore < 50;
      const isCaution = audit.warnings.length > 0 && !isLowScore;
      const showFindBetter = audit.adjustedScore < 75;

      return (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900/60 backdrop-blur-md animate-in slide-in-from-bottom-full duration-500">
            <div className="mt-auto bg-white rounded-t-[2.5rem] overflow-hidden flex flex-col max-h-[92vh] shadow-2xl relative">
                
                {/* 1. Header with Close */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-50 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-[1rem] bg-zinc-50 flex items-center justify-center text-zinc-500 border border-zinc-100">
                             {getProductIcon(lastScannedProduct.type)}
                         </div>
                         <div>
                             <h2 className="text-sm font-black text-zinc-900 leading-tight line-clamp-1 max-w-[200px]">{lastScannedProduct.name}</h2>
                             <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{lastScannedProduct.brand}</p>
                         </div>
                    </div>
                    <button onClick={() => { setShowProductModal(false); setLastScannedProduct(null); setAlternatives([]); setEnticement(null); }} className="w-9 h-9 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:bg-zinc-100 transition-colors hover:text-zinc-900">
                        <X size={18} />
                    </button>
                </div>

                {/* 2. Scrollable Content */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8 bg-white relative pb-32">
                    
                    {/* SLEEK HERO SCORE SECTION */}
                    <div className="flex flex-col items-center justify-center py-2 text-center animate-in zoom-in-95 duration-500">
                         <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${theme.bg} ${theme.text} ${theme.border} border text-[10px] font-bold uppercase tracking-widest mb-4`}>
                             <theme.icon size={12} /> {verdict.title}
                         </div>
                         
                         <h1 className={`text-8xl font-black tracking-tighter mb-2 ${theme.text} opacity-90`}>
                            {audit.adjustedScore}
                         </h1>
                         
                         <p className="text-zinc-500 font-medium text-sm max-w-[260px] leading-relaxed mx-auto">
                            {verdict.description}
                         </p>
                    </div>

                    {/* SMART ENTICEMENT SECTION (Background Search Result) */}
                    {enticement && (
                        <div className="animate-in slide-in-from-bottom-4 duration-700">
                            {enticement.type === 'UPGRADE' ? (
                                <button 
                                    onClick={() => handleSelectAlternative(enticement.product)}
                                    disabled={isAnalyzingAlternative}
                                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-[1.5rem] p-5 shadow-lg shadow-indigo-200 text-left relative overflow-hidden group hover:scale-[1.01] transition-transform disabled:opacity-80 disabled:cursor-not-allowed"
                                >
                                    <div className="absolute top-0 right-0 p-3 opacity-20">
                                        <Sparkles size={64} className="text-white rotate-12" />
                                    </div>
                                    <div className="relative z-10 text-white">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 bg-white/20 rounded text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm">Better Match Found</span>
                                            {enticement.product.score && <span className="text-[10px] font-bold text-indigo-100">{enticement.product.score}% Score</span>}
                                        </div>
                                        <h3 className="text-lg font-black leading-tight mb-0.5">{enticement.product.name}</h3>
                                        <p className="text-xs text-indigo-100 font-medium mb-3">{enticement.product.brand}</p>
                                        
                                        <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white text-indigo-600 px-3 py-1.5 rounded-full">
                                            {isAnalyzingAlternative ? (
                                                <>
                                                    <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                                    Analyzing Formula...
                                                </>
                                            ) : (
                                                <>
                                                    View Upgrade <ArrowRight size={12} />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ) : enticement.type === 'VALUE' ? (
                                <button 
                                    onClick={() => handleSelectAlternative(enticement.product)}
                                    disabled={isAnalyzingAlternative}
                                    className="w-full bg-emerald-50 border border-emerald-100 rounded-[1.5rem] p-5 text-left relative overflow-hidden group hover:border-emerald-200 transition-colors disabled:opacity-80"
                                >
                                     <div className="flex justify-between items-start">
                                         <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <PiggyBank size={14} className="text-emerald-600" />
                                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Smart Save</span>
                                            </div>
                                            <p className="text-sm font-medium text-emerald-900 leading-snug mb-1">
                                                Similar performance for less.
                                            </p>
                                            <p className="text-xs text-emerald-600 font-bold">
                                                {enticement.product.name} (~RM {enticement.product.price})
                                            </p>
                                            
                                            {isAnalyzingAlternative && (
                                                <div className="mt-2 inline-flex items-center gap-2 text-[10px] font-bold text-emerald-600">
                                                    <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                                    Analyzing...
                                                </div>
                                            )}
                                         </div>
                                         <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-emerald-500 shadow-sm">
                                             <TrendingUp size={16} />
                                         </div>
                                     </div>
                                </button>
                            ) : null}
                        </div>
                    )}

                    {/* FIND BETTER ALTERNATIVES (Manual Trigger) */}
                    {showFindBetter && !enticement && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                             <button 
                                onClick={handleFindAlternatives}
                                disabled={isSearchingAlternatives || alternatives.length > 0}
                                className="w-full py-4 rounded-2xl bg-white border border-indigo-200 text-indigo-600 font-bold text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 relative overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                             >
                                 {isSearchingAlternatives ? (
                                     <>
                                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        Searching...
                                     </>
                                 ) : alternatives.length > 0 ? (
                                     <>
                                        <Sparkles size={16} /> Top Picks Found
                                     </>
                                 ) : (
                                     <>
                                        <Globe size={16} /> Find Better Match
                                     </>
                                 )}
                             </button>
                             
                             {(alternatives.length > 0 || isAnalyzingAlternative) && (
                                 <div className="mt-4 space-y-3">
                                     {isAnalyzingAlternative && (
                                          <div className="p-4 rounded-2xl bg-zinc-50 flex items-center justify-center gap-3">
                                              <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                                              <span className="text-xs font-bold text-zinc-600">Analyzing...</span>
                                          </div>
                                     )}
                                     {alternatives.map((alt, i) => (
                                         <button 
                                            key={i}
                                            onClick={() => handleSelectAlternative(alt)}
                                            className="w-full text-left bg-white p-4 rounded-[1.5rem] border border-zinc-100 hover:border-indigo-200 hover:shadow-md transition-all group flex justify-between items-center"
                                         >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold text-xs border border-indigo-100">
                                                    #{i+1}
                                                </div>
                                                <div>
                                                    <h5 className="font-bold text-sm text-zinc-900 leading-tight mb-0.5">{alt.name}</h5>
                                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{alt.brand}</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-zinc-300 group-hover:text-indigo-500" />
                                         </button>
                                     ))}
                                 </div>
                             )}
                        </div>
                    )}

                    {/* ANALYSIS DETAILS */}
                    <div className="space-y-6">
                        {/* 1. SAFETY ALERT (Clean Card) */}
                        {audit.warnings.length > 0 && (
                            <div className="bg-white rounded-[1.5rem] p-5 border border-zinc-100 relative overflow-hidden">
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${isCaution ? 'bg-amber-400' : 'bg-rose-400'}`} />
                                <h4 className={`text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${isCaution ? 'text-amber-700' : 'text-rose-700'}`}>
                                    <AlertTriangle size={14} /> Safety Check
                                </h4>
                                <ul className="space-y-3">
                                    {audit.warnings.map((w, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm font-medium text-zinc-700">
                                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${isCaution ? 'bg-amber-400' : 'bg-rose-400'}`} />
                                            <span className="leading-relaxed">{w.reason}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* 2. BENEFITS (Clean List) */}
                        <div className="bg-white rounded-[1.5rem] p-5 border border-zinc-100">
                             <div className="flex justify-between items-center mb-4">
                                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                                    <FlaskConical size={14} className="text-teal-500" /> Key Actives
                                </h4>
                                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded uppercase">Verified</span>
                             </div>
                             
                             <div className="space-y-4">
                                {sortedBenefits.slice(0, 3).map((benefit, i) => {
                                    const userScore = user.biometrics[benefit.target as keyof SkinMetrics] as number || 0;
                                    const isRelevant = userScore < 70;
                                    
                                    if (isLowScore && !isRelevant) return null;

                                    return (
                                        <div key={i} className="flex gap-4 items-start">
                                            <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${isRelevant ? 'bg-teal-50 text-teal-600' : 'bg-zinc-50 text-zinc-400'}`}>
                                                <Zap size={14} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-bold text-zinc-900">{benefit.ingredient}</span>
                                                    {isRelevant && <span className="text-[9px] font-bold text-teal-600 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded uppercase">Targeted</span>}
                                                </div>
                                                <p className="text-xs text-zinc-500 leading-relaxed">{benefit.description}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                                {sortedBenefits.length === 0 && (
                                    <p className="text-xs text-zinc-400 font-medium italic pl-1">No major active ingredients detected.</p>
                                )}
                             </div>
                        </div>

                        {/* 3. SHELF CONTEXT */}
                        {shelfConflicts.length > 0 && (
                            <div className="bg-white rounded-[1.5rem] p-5 border border-zinc-100 relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />
                                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <AlertOctagon size={14} /> Routine Conflict
                                </h4>
                                <p className="text-xs text-zinc-600 font-medium leading-relaxed pl-6">
                                    {shelfConflicts[0]}
                                </p>
                            </div>
                        )}
                        
                        {existingSameType.length > 0 && shelfConflicts.length === 0 && (
                            <div className="bg-zinc-50 rounded-[1.5rem] p-5 border border-zinc-100">
                                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <ArrowRightLeft size={14} /> Comparison
                                </h4>
                                <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                                    {comparison.result === 'BETTER' 
                                        ? `Scores higher than your current ${existingSameType[0].name}.` 
                                        : comparison.result === 'WORSE'
                                        ? `Your current ${existingSameType[0].name} is a better match.`
                                        : `Similar performance to your current product.`}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* INGREDIENTS LIST */}
                    <div className="pt-4 border-t border-zinc-50">
                        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 pl-1">Full Ingredients</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {lastScannedProduct.ingredients.length > 0 ? (
                                lastScannedProduct.ingredients.map((ing, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-white border border-zinc-100 text-zinc-500 text-[10px] font-bold rounded-lg uppercase tracking-wide">
                                        {ing}
                                    </span>
                                ))
                            ) : (
                                <p className="text-xs text-zinc-400 italic">Ingredient list not available.</p>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* 3. Footer Actions (Clean) */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/95 backdrop-blur-xl border-t border-zinc-100 z-30">
                    <div className="grid grid-cols-2 gap-4">
                         <button 
                            onClick={() => { setShowProductModal(false); setLastScannedProduct(null); setAlternatives([]); setEnticement(null); }}
                            className="py-4 rounded-[1.2rem] border border-zinc-200 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
                         >
                            Discard
                         </button>
                         <button 
                            onClick={addToShelf}
                            className="py-4 rounded-[1.2rem] bg-zinc-900 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-zinc-900/10 hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                         >
                            <ShoppingBag size={16} /> Add to Shelf
                         </button>
                    </div>
                </div>

            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen text-zinc-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      {renderView()}

      {/* OVERLAYS */}
      <GuideOverlay step={guideStep} onDismiss={stopGuide} onNext={advanceGuideStep} />

      {showSaveProfileModal && (
          <SaveProfileModal 
            onSave={async () => {
                // Handled in SaveProfileModal now
            }} 
            onClose={handleCloseSaveProfile} 
            onMockLogin={handleMockLogin}
            mode={saveModalMode}
          />
      )}
      
      {/* AI ASSISTANT (Accessible from anywhere) */}
      {user && view !== AppView.ONBOARDING && view !== AppView.FACE_SCANNER && view !== AppView.PRODUCT_SCANNER && view !== AppView.PRODUCT_SEARCH && (
         <AIAssistant 
            user={user} 
            shelf={shelf} 
            isOpen={isAiChatOpen} 
            onOpen={() => setIsAiChatOpen(true)}
            onClose={() => setIsAiChatOpen(false)}
            triggerQuery={aiTriggerQuery}
         />
      )}

      {/* Add Product Menu (Scan vs Search) */}
      {showAddProductMenu && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowAddProductMenu(false)}>
              <div className="bg-white rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom-full duration-300" onClick={e => e.stopPropagation()}>
                  <div className="w-12 h-1 bg-zinc-200 rounded-full mx-auto mb-8"></div>
                  <h3 className="text-xl font-black text-zinc-900 tracking-tight mb-2 text-center">Product Match</h3>
                  <p className="text-center text-zinc-500 text-sm font-medium mb-8">Analyze ingredients for compatibility.</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <button 
                          onClick={() => { setShowAddProductMenu(false); setView(AppView.PRODUCT_SCANNER); }}
                          className="flex flex-col items-center justify-center gap-3 p-6 bg-zinc-50 border border-zinc-100 rounded-[2rem] hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-all group active:scale-[0.98]"
                      >
                          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-zinc-900 group-hover:bg-teal-500 group-hover:text-white transition-colors shadow-sm">
                              <Camera size={24} />
                          </div>
                          <span className="text-sm font-bold">Scan Label</span>
                      </button>

                      <button 
                          onClick={() => { setShowAddProductMenu(false); setView(AppView.PRODUCT_SEARCH); }}
                          className="flex flex-col items-center justify-center gap-3 p-6 bg-zinc-50 border border-zinc-100 rounded-[2rem] hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all group active:scale-[0.98]"
                      >
                          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-zinc-900 group-hover:bg-indigo-500 group-hover:text-white transition-colors shadow-sm">
                              <Globe size={24} />
                          </div>
                          <span className="text-sm font-bold">Search Online</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* FLOATING DOCK NAVIGATION */}
      {view !== AppView.ONBOARDING && view !== AppView.FACE_SCANNER && view !== AppView.PRODUCT_SCANNER && view !== AppView.PRODUCT_SEARCH && view !== AppView.PROFILE_SETUP && (
        <div className="fixed bottom-8 left-0 right-0 z-40 flex justify-center pointer-events-none">
            <nav className="floating-nav pointer-events-auto rounded-[2rem] h-20 px-6 flex gap-8 items-center shadow-2xl">
                <NavButton 
                    active={view === AppView.DASHBOARD} 
                    onClick={() => setView(AppView.DASHBOARD)} 
                    icon={<User size={20} strokeWidth={view === AppView.DASHBOARD ? 3 : 2} />}
                    isHighlighted={guideStep === 'ANALYSIS'}
                />

                <button 
                    onClick={openAddProductMenu}
                    className={`w-16 h-16 bg-teal-600 rounded-[1.8rem] flex items-center justify-center text-white shadow-xl shadow-teal-600/40 transform transition-all duration-300 hover:scale-110 active:scale-95 border-4 border-white relative ${guideStep === 'SCAN' ? 'ring-4 ring-teal-400/50' : ''}`}
                >
                    {guideStep === 'SCAN' && <PulseRing color="teal" />}
                    <ScanBarcode size={28} strokeWidth={2.5} />
                </button>

                <NavButton 
                    active={view === AppView.SMART_SHELF} 
                    onClick={() => setView(AppView.SMART_SHELF)} 
                    icon={<LayoutGrid size={20} strokeWidth={view === AppView.SMART_SHELF ? 3 : 2} />}
                    isHighlighted={guideStep === 'SHELF'} 
                />
            </nav>
        </div>
      )}

      {showProductModal && renderBuyingDecision()}
    </div>
  );
};

export default App;