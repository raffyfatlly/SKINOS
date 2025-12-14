
import React, { useState } from 'react';
import { Search, X, Loader, AlertCircle } from 'lucide-react';
import { Product, UserProfile } from '../types';
import { analyzeProductFromSearch, searchProducts } from '../services/geminiService';

interface SearchResult {
    name: string;
    brand: string;
    score: number;
}

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
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsSearching(true);
        setError(null);
        
        try {
            const products = await searchProducts(query);
            
            // Map to SearchResult interface
            const mappedResults: SearchResult[] = products.map(p => ({
                name: p.name,
                brand: p.brand,
                score: 0 // Default score, triggers full analysis
            }));

            setResults(mappedResults);
        } catch (e) {
            console.error(e);
            // Fallback if search fails
            setResults([
                { name: query, brand: "Generic", score: 0 },
            ]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectProduct = async (item: SearchResult) => {
        setIsAnalyzing(true);
        setError(null);
        
        try {
          // Pass score AND brand to ensure accuracy
          const product = await analyzeProductFromSearch(item.name, userProfile.biometrics, item.score > 0 ? item.score : undefined, item.brand);
          onProductFound(product);
        } catch (err) {
          console.error(err);
          setError("Failed to analyze product details. Please try scanning the label instead.");
          setIsAnalyzing(false);
        }
      };

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
            <div className="p-6 border-b border-zinc-100 flex items-center gap-4">
                <button onClick={onCancel} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-600">
                    <X size={24} />
                </button>
                <div className="flex-1 relative">
                    <input 
                        className="w-full bg-zinc-100 rounded-full pl-10 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        placeholder="Search INCI Decoder..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        autoFocus
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {isSearching || isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-4">
                        <Loader className="animate-spin" size={32} />
                        <p className="text-xs font-bold uppercase tracking-widest">{isAnalyzing ? "Analyzing Ingredients..." : "Searching INCI Decoder..."}</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-64 text-rose-500 gap-4 text-center">
                        <AlertCircle size={32} />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {results.map((res, i) => (
                            <button 
                                key={i}
                                onClick={() => handleSelectProduct(res)}
                                className="w-full p-4 text-left border border-zinc-100 rounded-2xl hover:bg-zinc-50 active:scale-[0.99] transition-all"
                            >
                                <div className="font-bold text-zinc-900">{res.name}</div>
                                <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{res.brand}</div>
                            </button>
                        ))}
                        {results.length === 0 && query && !isSearching && (
                             <button 
                                onClick={() => handleSelectProduct({ name: query, brand: "Generic", score: 0 })}
                                className="w-full p-4 text-left border border-dashed border-zinc-300 rounded-2xl hover:bg-zinc-50 text-zinc-500 font-medium text-sm"
                            >
                                Analyze "{query}"
                            </button>
                        )}
                        {results.length === 0 && !query && (
                            <div className="text-center text-zinc-400 mt-20">
                                <Search size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-sm font-medium">Type a product name to search</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductSearch;
