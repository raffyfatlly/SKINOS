import React, { useState, useEffect } from 'react';
import { Search, Loader, ChevronRight, AlertTriangle, X, ShoppingBag, Globe, Database, ScanLine } from 'lucide-react';
import { searchProducts, analyzeProductFromSearch, SearchResult } from '../services/geminiService';
import { Product, UserProfile } from '../types';

interface ProductSearchProps {
  userProfile: UserProfile;
  onProductFound: (product: Product) => void;
  onCancel: () => void;
}

const ProductSearch: React.FC<ProductSearchProps> = ({ userProfile, onProductFound, onCancel }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Loading Text States
  const [searchStatus, setSearchStatus] = useState("Searching...");
  const [analyzeStatus, setAnalyzeStatus] = useState("Analyzing Product...");
  
  const [error, setError] = useState<string | null>(null);

  // Cycle loading text during SEARCH
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSearching) {
        const messages = [
            "Connecting to Global Database...",
            "Filtering for Availability...",
            "Identifying Skincare Matches...",
            "Verifying Brand Authenticity...",
            "Finalizing Results..."
        ];
        let i = 0;
        setSearchStatus(messages[0]);
        interval = setInterval(() => {
            i = (i + 1) % messages.length;
            setSearchStatus(messages[i]);
        }, 2000);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  // Cycle loading text during ANALYSIS
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isAnalyzing) {
        const messages = [
            "Extracting Ingredient List...",
            "Checking Formulation Safety...",
            "Calculating Biometric Match...",
            "Cross-referencing Allergens...",
            "Generating Clinical Verdict..."
        ];
        let i = 0;
        setAnalyzeStatus(messages[0]);
        interval = setInterval(() => {
            i = (i + 1) % messages.length;
            setAnalyzeStatus(messages[i]);
        }, 2500);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      const found = await searchProducts(query);
      if (found.length === 0) {
        setError("No products found matching your query. Try a different name.");
      } else {
        setResults(found);
      }
    } catch (err) {
      console.error(err);
      setError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectProduct = async (item: SearchResult) => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Pass score if available to maintain consistency, though usually null for manual search
      const product = await analyzeProductFromSearch(item.name, userProfile.biometrics, item.score);
      onProductFound(product);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze product details. Please try scanning the label instead.");
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col font-sans">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 border-b border-zinc-100 flex items-center justify-between bg-white/95 backdrop-blur-xl sticky top-0 z-10">
        <h2 className="text-xl font-black text-zinc-900 tracking-tight">Find Product</h2>
        <button 
            onClick={onCancel}
            className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:bg-zinc-100 transition-colors"
        >
            <X size={20} />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-6 bg-zinc-50/50">
        <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search product name..."
                className="w-full bg-white border border-zinc-200 rounded-2xl py-4 pl-12 pr-4 text-base font-bold text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                autoFocus
            />
        </form>
        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-3 pl-2 flex items-center gap-2">
            <Globe size={12} /> Searching Watsons, Guardian & Sephora
        </p>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {isSearching ? (
             <div className="flex flex-col items-center justify-center pt-20 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 border-4 border-teal-500/20 rounded-full animate-ping"></div>
                    <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-lg font-black text-zinc-900 mb-2">Searching...</h3>
                <p className="text-xs font-bold text-teal-600 uppercase tracking-widest animate-pulse">{searchStatus}</p>
             </div>
        ) : error ? (
             <div className="p-6 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col items-center text-center">
                 <AlertTriangle size={32} className="text-rose-400 mb-3" />
                 <p className="text-sm font-bold text-rose-800">{error}</p>
             </div>
        ) : results.length > 0 ? (
             <div className="space-y-3">
                 {results.map((item, idx) => (
                     <button 
                        key={idx}
                        onClick={() => handleSelectProduct(item)}
                        disabled={isAnalyzing}
                        className="w-full text-left p-5 bg-white border border-zinc-100 rounded-[1.5rem] hover:border-teal-200 hover:shadow-lg transition-all group active:scale-[0.99] disabled:opacity-50"
                     >
                         <div className="flex justify-between items-center">
                             <div>
                                 <h4 className="font-bold text-zinc-900 text-sm mb-1 group-hover:text-teal-700 transition-colors">{item.name}</h4>
                                 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{item.brand}</span>
                             </div>
                             <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-teal-50 group-hover:text-teal-500 transition-colors">
                                 <ChevronRight size={18} />
                             </div>
                         </div>
                     </button>
                 ))}
             </div>
        ) : (
             <div className="flex flex-col items-center justify-center h-64 text-zinc-300">
                 <ShoppingBag size={48} className="mb-4 opacity-20" />
                 <p className="text-xs font-bold uppercase tracking-widest">No products searched yet</p>
             </div>
        )}
      </div>

      {/* Analyzing Overlay */}
      {isAnalyzing && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-20 flex flex-col items-center justify-center animate-in fade-in">
              <div className="relative mb-8">
                  <div className="w-20 h-20 border-4 border-zinc-100 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  <ScanLine size={24} className="absolute inset-0 m-auto text-teal-600 animate-pulse" />
              </div>
              <h3 className="text-xl font-black text-zinc-900 mb-2">{analyzeStatus}</h3>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Please Wait</p>
          </div>
      )}
    </div>
  );
};

export default ProductSearch;