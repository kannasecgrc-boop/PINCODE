import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SearchIcon, MapPinIcon, SparklesIcon, ArrowRightIcon, GlobeIcon, ListBulletIcon, RefreshIcon } from './components/Icons';
import Footer from './components/Footer';
import MarkdownText from './components/MarkdownText';
import GroundingSources from './components/GroundingSources';
import { searchPostcodes, getLocationSuggestions, getQuickSuggestions } from './services/geminiService';
import { SearchState, SearchResult } from './types';
import { APP_TITLE, SUGGESTED_QUERIES, COMMON_COUNTRIES } from './constants';

const App: React.FC = () => {
  const [state, setState] = useState<SearchState>({
    query: '',
    loading: false,
    result: null,
    error: null,
  });

  const [searchMode, setSearchMode] = useState<'quick' | 'detailed'>('quick');
  
  // Detailed form state
  const [detailedForm, setDetailedForm] = useState({
    country: '',
    state: '',
    city: '', // This represents District/City
    area: '',
    mandal: '',
    village: '' // Represents Village or Postal Field
  });

  // Toggle between Area search and Mandal search
  const [subSearchMode, setSubSearchMode] = useState<'area' | 'mandal' | null>('area');

  // Lists for dropdowns
  const [suggestionLists, setSuggestionLists] = useState({
    states: [] as string[],
    cities: [] as string[],
    areas: [] as string[],
    mandals: [] as string[],
    villages: [] as string[]
  });

  // Quick Search Suggestions State
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const [showQuickSuggestions, setShowQuickSuggestions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Loading states for individual fields
  const [fieldLoading, setFieldLoading] = useState({
    states: false,
    cities: false,
    areas: false,
    mandals: false,
    villages: false
  });

  // Track if a search has been performed
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Quick Search Suggestion Logic ---
  useEffect(() => {
    // Only run in quick mode and if not currently searching main result
    if (searchMode !== 'quick' || hasSearched) return;

    if (state.query.length >= 3 && isTyping) {
        // Debounce API call
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        
        debounceTimerRef.current = setTimeout(async () => {
            const suggestions = await getQuickSuggestions(state.query);
            if (suggestions && suggestions.length > 0) {
                setQuickSuggestions(suggestions);
                setShowQuickSuggestions(true);
            } else {
                setShowQuickSuggestions(false);
            }
        }, 300); // Reduced to 300ms for faster feedback
    } else {
        setShowQuickSuggestions(false);
    }

    return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [state.query, searchMode, hasSearched, isTyping]);


  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setHasSearched(true);
    setShowQuickSuggestions(false); // Hide suggestions on search
    setState(prev => ({ ...prev, query: searchQuery, loading: true, error: null, result: null }));

    try {
      const result: SearchResult = await searchPostcodes(searchQuery);
      setState(prev => ({ ...prev, loading: false, result }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || "Something went wrong. Please try again."
      }));
    }
  }, []);

  const handleQuickInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsTyping(true);
      setState(prev => ({ ...prev, query: e.target.value }));
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(state.query);
  };

  const handleQuickSuggestionClick = (suggestion: string) => {
      setState(prev => ({ ...prev, query: suggestion }));
      setShowQuickSuggestions(false);
      setIsTyping(false);
      handleSearch(suggestion);
  };

  const handleDetailedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let structuredQuery = "";
    
    // Logic: Construct query based on active sub-mode
    if (subSearchMode === 'area') {
        if (!detailedForm.country || !detailedForm.state || !detailedForm.city || !detailedForm.area) return;
        structuredQuery = `Postal code for ${detailedForm.area}, ${detailedForm.city} District, ${detailedForm.state}, ${detailedForm.country}`;
    } else if (subSearchMode === 'mandal') {
        if (!detailedForm.country || !detailedForm.state || !detailedForm.city || !detailedForm.mandal || !detailedForm.village) return;
        structuredQuery = `Postal code for ${detailedForm.village}, ${detailedForm.mandal} Mandal/Tehsil, ${detailedForm.city} District, ${detailedForm.state}, ${detailedForm.country}`;
    } else {
        return;
    }

    // We set the main query state for display purposes in the result
    setState(prev => ({...prev, query: structuredQuery}));
    handleSearch(structuredQuery);
  };

  // --- Cascading Logic Handlers ---

  const handleCountryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const country = e.target.value;
    setDetailedForm({ country, state: '', city: '', area: '', mandal: '', village: '' });
    setSuggestionLists({ states: [], cities: [], areas: [], mandals: [], villages: [] });
    
    if (country) {
      setFieldLoading(prev => ({ ...prev, states: true }));
      const states = await getLocationSuggestions('state', { country });
      setSuggestionLists(prev => ({ ...prev, states }));
      setFieldLoading(prev => ({ ...prev, states: false }));
    }
  };

  const handleStateChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedState = e.target.value;
    setDetailedForm(prev => ({ ...prev, state: selectedState, city: '', area: '', mandal: '', village: '' }));
    setSuggestionLists(prev => ({ ...prev, cities: [], areas: [], mandals: [], villages: [] }));

    if (selectedState) {
      setFieldLoading(prev => ({ ...prev, cities: true }));
      const cities = await getLocationSuggestions('city', { country: detailedForm.country, state: selectedState });
      setSuggestionLists(prev => ({ ...prev, cities }));
      setFieldLoading(prev => ({ ...prev, cities: false }));
    }
  };

  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const city = e.target.value;
    setDetailedForm(prev => ({ ...prev, city, area: '', mandal: '', village: '' }));
    setSuggestionLists(prev => ({ ...prev, areas: [], mandals: [], villages: [] }));

    if (city) {
      // Pre-fetch both options if possible, or fetch on mode switch. 
      // For efficiency, let's fetch based on current sub-mode, but triggering the sub-mode switch also works.
      fetchSubLevelData(city, subSearchMode);
    }
  };

  const fetchSubLevelData = async (city: string, mode: 'area' | 'mandal' | null) => {
      if (!city || !mode) return;

      if (mode === 'area') {
        setFieldLoading(prev => ({ ...prev, areas: true }));
        const areas = await getLocationSuggestions('area', { country: detailedForm.country, state: detailedForm.state, city });
        setSuggestionLists(prev => ({ ...prev, areas }));
        setFieldLoading(prev => ({ ...prev, areas: false }));
      } else if (mode === 'mandal') {
        setFieldLoading(prev => ({ ...prev, mandals: true }));
        const mandals = await getLocationSuggestions('mandal', { country: detailedForm.country, state: detailedForm.state, city });
        setSuggestionLists(prev => ({ ...prev, mandals }));
        setFieldLoading(prev => ({ ...prev, mandals: false }));
      }
  };

  const handleSubModeChange = (mode: 'area' | 'mandal') => {
      setSubSearchMode(mode);
      // Clear downstream fields
      setDetailedForm(prev => ({ ...prev, area: '', mandal: '', village: '' }));
      if (detailedForm.city) {
          fetchSubLevelData(detailedForm.city, mode);
      }
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDetailedForm(prev => ({ ...prev, area: e.target.value }));
  };

  const handleMandalChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mandal = e.target.value;
    setDetailedForm(prev => ({ ...prev, mandal, village: '' }));
    setSuggestionLists(prev => ({ ...prev, villages: [] }));

    if (mandal) {
        setFieldLoading(prev => ({ ...prev, villages: true }));
        const villages = await getLocationSuggestions('village', { 
            country: detailedForm.country, 
            state: detailedForm.state, 
            city: detailedForm.city,
            mandal 
        });
        setSuggestionLists(prev => ({ ...prev, villages }));
        setFieldLoading(prev => ({ ...prev, villages: false }));
    }
  };

  const handleVillageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setDetailedForm(prev => ({ ...prev, village: e.target.value }));
  };


  const handleSuggestionClick = (suggestion: string) => {
    // Switch to quick mode for suggestions
    setSearchMode('quick');
    setState(prev => ({ ...prev, query: suggestion }));
    handleSearch(suggestion);
  };

  const resetSearch = () => {
    setHasSearched(false);
    setState(prev => ({ ...prev, result: null, error: null, query: '' }));
    setDetailedForm({ country: '', state: '', city: '', area: '', mandal: '', village: '' });
    setSuggestionLists({ states: [], cities: [], areas: [], mandals: [], villages: [] });
    // Default back to area on reset
    setSubSearchMode('area');
    setQuickSuggestions([]);
    setShowQuickSuggestions(false);
  };

  // Focus input on mount or mode switch
  useEffect(() => {
    if (!hasSearched && searchMode === 'quick' && inputRef.current) {
        inputRef.current.focus();
    }
  }, [hasSearched, searchMode]);

  // Validation Logic
  const isAreaValid = subSearchMode === 'area' && detailedForm.country && detailedForm.state && detailedForm.city && detailedForm.area;
  const isMandalValid = subSearchMode === 'mandal' && detailedForm.country && detailedForm.state && detailedForm.city && detailedForm.mandal && detailedForm.village;
  const isDetailedFormValid = isAreaValid || isMandalValid;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative overflow-x-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-100/50 to-slate-50 -z-10" />
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-200/20 rounded-full blur-3xl -z-10" />
      <div className="absolute top-[20%] left-[-10%] w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl -z-10" />

      {/* Main Content */}
      <main className={`flex-1 flex flex-col items-center transition-all duration-500 ease-out px-4 sm:px-6 w-full max-w-5xl mx-auto ${hasSearched ? 'pt-8 justify-start' : 'justify-center min-h-[80vh]'}`}>
        
        {/* Header Section */}
        <div className={`text-center transition-all duration-500 flex flex-col items-center ${hasSearched ? 'mb-6' : 'mb-10'}`}>
          {!hasSearched && (
            <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm mb-4">
              <MapPinIcon className="w-8 h-8 text-primary" />
            </div>
          )}
          <h1 className={`${hasSearched ? 'text-2xl md:text-3xl' : 'text-4xl md:text-5xl'} font-extrabold text-slate-900 tracking-tight mb-3 transition-all`}>
            {APP_TITLE}
          </h1>
          {!hasSearched && (
            <p className="text-slate-500 text-lg max-w-lg mx-auto">
              Find postal codes, zip codes, and pincodes for any location worldwide instantly.
            </p>
          )}
        </div>

        {/* Search Interfaces - Only show if NO results yet */}
        {!hasSearched && (
          <div className="w-full max-w-2xl mb-12 animate-in fade-in zoom-in-95 duration-300">
            
            {/* Mode Toggle */}
            <div className="flex p-1 bg-slate-200/50 rounded-xl w-fit mx-auto mb-6">
              <button
                onClick={() => setSearchMode('quick')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchMode === 'quick' 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <GlobeIcon className="w-4 h-4" />
                Quick Search
              </button>
              <button
                onClick={() => setSearchMode('detailed')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchMode === 'detailed' 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ListBulletIcon className="w-4 h-4" />
                Detailed Search
              </button>
            </div>

            {/* QUICK SEARCH FORM */}
            {searchMode === 'quick' && (
              <form onSubmit={handleQuickSubmit} className="relative group z-20">
                <div className={`absolute inset-0 bg-blue-500/20 rounded-2xl blur-lg transition-opacity duration-300 ${state.loading ? 'opacity-100' : 'opacity-0 group-hover:opacity-75'}`} />
                <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all">
                  <div className="pl-4 sm:pl-6 text-slate-400">
                    {state.loading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    ) : (
                        <SearchIcon className="w-6 h-6" />
                    )}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={state.query}
                    onChange={handleQuickInput}
                    placeholder="Ex: New York, 10001, Bangalore South..."
                    className="w-full h-14 sm:h-16 px-4 sm:px-6 text-lg text-slate-800 placeholder:text-slate-400 outline-none bg-transparent rounded-2xl"
                    disabled={state.loading}
                    autoComplete="off"
                  />
                  <button 
                    type="submit"
                    disabled={state.loading || !state.query.trim()}
                    className="mr-2 px-4 py-2 sm:px-6 sm:py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span>Search</span>
                    <ArrowRightIcon className="w-4 h-4 hidden sm:block" />
                  </button>
                </div>
                
                {/* Autocomplete Dropdown */}
                {showQuickSuggestions && quickSuggestions.length > 0 && (
                   <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                      <ul>
                          {quickSuggestions.map((suggestion, idx) => (
                              <li key={idx}>
                                  <button
                                      type="button"
                                      onClick={() => handleQuickSuggestionClick(suggestion)}
                                      className="w-full text-left px-6 py-3 hover:bg-slate-50 text-slate-700 hover:text-primary transition-colors flex items-center gap-2"
                                  >
                                      <SearchIcon className="w-4 h-4 text-slate-400" />
                                      {suggestion}
                                  </button>
                              </li>
                          ))}
                      </ul>
                   </div>
                )}
              </form>
            )}

            {/* DETAILED SEARCH FORM - SEQUENTIAL */}
            {searchMode === 'detailed' && (
              <form onSubmit={handleDetailedSubmit} className="relative bg-white p-6 rounded-2xl shadow-xl border border-slate-200 z-10">
                 
                 <div className="space-y-4">
                    {/* Common Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Country - Level 1 */}
                        <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Country</label>
                        <select 
                            value={detailedForm.country}
                            onChange={handleCountryChange}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none"
                            style={{backgroundImage: 'none'}} 
                        >
                            <option value="">Select Country</option>
                            {COMMON_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        </div>

                        {/* State - Level 2 */}
                        <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1 flex justify-between">
                            <span>State / Province</span>
                            {fieldLoading.states && <span className="text-primary animate-pulse">Loading...</span>}
                        </label>
                        <select 
                            value={detailedForm.state}
                            onChange={handleStateChange}
                            disabled={!detailedForm.country || fieldLoading.states}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">{detailedForm.country ? "Select State" : "Select Country First"}</option>
                            {suggestionLists.states.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        </div>

                        {/* City - Level 3 */}
                        <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1 flex justify-between">
                            <span>District / City</span>
                            {fieldLoading.cities && <span className="text-primary animate-pulse">Loading...</span>}
                        </label>
                        <select 
                            value={detailedForm.city}
                            onChange={handleCityChange}
                            disabled={!detailedForm.state || fieldLoading.cities}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">{detailedForm.state ? "Select City" : "Select State First"}</option>
                            {suggestionLists.cities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        </div>
                    </div>

                    {/* Sub-Search Mode Toggle (Only visible after City selected) */}
                    <div className={`transition-all duration-300 overflow-hidden ${detailedForm.city ? 'max-h-20 opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                        <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                            <span className="text-sm font-medium text-slate-500 px-3 mb-2 sm:mb-0">Search By:</span>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => handleSubModeChange('area')}
                                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        subSearchMode === 'area'
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' 
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Area / Locality
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSubModeChange('mandal')}
                                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        subSearchMode === 'mandal'
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' 
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Mandal / Tehsil
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Conditional Fields based on Toggle */}
                    <div className={`transition-all duration-300 ${detailedForm.city ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        
                        {/* Option A: Area */}
                        {subSearchMode === 'area' && (
                             <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1 flex justify-between">
                                    <span>Area / Locality</span>
                                    {fieldLoading.areas && <span className="text-primary animate-pulse">Loading...</span>}
                                </label>
                                <select 
                                    value={detailedForm.area}
                                    onChange={handleAreaChange}
                                    disabled={!detailedForm.city || fieldLoading.areas}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">{detailedForm.city ? "Select Area" : "Select District First"}</option>
                                    {suggestionLists.areas.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                             </div>
                        )}

                        {/* Option B: Mandal & Village */}
                        {subSearchMode === 'mandal' && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                {/* Mandal */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1 flex justify-between">
                                        <span>Mandal / Tehsil</span>
                                        {fieldLoading.mandals && <span className="text-primary animate-pulse">Loading...</span>}
                                    </label>
                                    <select 
                                        value={detailedForm.mandal}
                                        onChange={handleMandalChange}
                                        disabled={!detailedForm.city || fieldLoading.mandals}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">{detailedForm.city ? "Select Mandal/Tehsil" : "Select District First"}</option>
                                        {suggestionLists.mandals.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                {/* Village / Postal */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1 flex justify-between">
                                        <span>Village / Locality</span>
                                        {fieldLoading.villages && <span className="text-primary animate-pulse">Loading...</span>}
                                    </label>
                                    <select 
                                        value={detailedForm.village}
                                        onChange={handleVillageChange}
                                        disabled={!detailedForm.mandal || fieldLoading.villages}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">{detailedForm.mandal ? "Select Village/PO" : "Select Mandal First"}</option>
                                        {suggestionLists.villages.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                             </div>
                        )}
                    </div>
                 </div>

                 {/* Submit Button - Only visible when valid */}
                 {isDetailedFormValid && (
                     <div className="animate-in fade-in zoom-in-95 duration-300 mt-6">
                        <button 
                            type="submit"
                            disabled={state.loading}
                            className="w-full py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {state.loading ? (
                                <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                <span>Searching...</span>
                                </>
                            ) : (
                                <>
                                <span>Find Pincode</span>
                                <ArrowRightIcon className="w-5 h-5" />
                                </>
                            )}
                        </button>
                     </div>
                 )}
                 {!isDetailedFormValid && detailedForm.city && (
                    <div className="text-center text-sm text-slate-400 py-4 italic animate-in fade-in duration-500">
                        {subSearchMode === 'area' ? "Please select an Area to search." : "Please select both Mandal and Village to search."}
                    </div>
                 )}
              </form>
            )}

            {/* Suggestions - Only show if haven't searched yet */}
            {searchMode === 'quick' && !showQuickSuggestions && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="text-sm text-slate-400 py-1">Try:</span>
                {SUGGESTED_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestionClick(q)}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:border-primary hover:text-primary transition-colors shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {hasSearched && (
          <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {state.error ? (
              <div className="p-6 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-center">
                <p className="font-medium">{state.error}</p>
                <button 
                  onClick={() => handleSearch(state.query)}
                  className="mt-3 text-sm underline hover:text-red-800"
                >
                  Try again
                </button>
                <div className="mt-6 pt-6 border-t border-red-200">
                     <button onClick={resetSearch} className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium">Start New Search</button>
                </div>
              </div>
            ) : state.result ? (
              <>
                 {/* Results Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden mb-8">
                  {/* Result Header */}
                  <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <SparklesIcon className="w-5 h-5 text-indigo-500" />
                      <span className="font-semibold text-sm uppercase tracking-wide">AI Result for: <span className="text-slate-900 normal-case">"{state.query}"</span></span>
                    </div>
                  </div>
                  
                  {/* Result Content */}
                  <div className="p-6 sm:p-8">
                    <MarkdownText content={state.result.text} />
                    
                    {/* Grounding / Sources */}
                    {state.result.groundingMetadata && (
                        <GroundingSources chunks={state.result.groundingMetadata.groundingChunks || []} />
                    )}
                  </div>
                </div>

                {/* New Search Button (Footer of results) */}
                <div className="flex justify-center">
                    <button 
                        onClick={resetSearch}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-300 rounded-full shadow-sm text-slate-700 hover:border-primary hover:text-primary transition-all font-medium"
                    >
                        <RefreshIcon className="w-4 h-4" />
                        Start New Search
                    </button>
                </div>
              </>
            ) : (
                /* Loading Skeleton */
                <div className="w-full bg-white rounded-2xl border border-slate-200 p-8 space-y-4 shadow-sm opacity-50">
                    <div className="h-4 bg-slate-200 rounded w-1/4 animate-pulse mb-6"></div>
                    <div className="h-3 bg-slate-200 rounded w-full animate-pulse"></div>
                    <div className="h-3 bg-slate-200 rounded w-5/6 animate-pulse"></div>
                    <div className="h-3 bg-slate-200 rounded w-4/6 animate-pulse"></div>
                </div>
            )}
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
};

export default App;