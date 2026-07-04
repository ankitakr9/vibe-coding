import { useState, useEffect } from 'react';
import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where
} from './firebase';
import { BirthDetails, AstrologicalProfile } from './types';
import { generateAstrologicalProfile } from './utils/astrology';

// Component imports
import AuthCard from './components/AuthCard';
import ProfileForm from './components/ProfileForm';
import KundliChart from './components/KundliChart';
import HoroscopeView from './components/HoroscopeView';
import PanchangFestivals from './components/PanchangFestivals';
import KundliMatching from './components/KundliMatching';
import AstroGuru from './components/AstroGuru';
import DownloadReport from './components/DownloadReport';
import AdminPanel from './components/AdminPanel';

// Icons
import {
  Sparkles,
  Compass,
  CalendarDays,
  Heart,
  MessageSquare,
  FileText,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  Bookmark,
  Share2,
  CheckCircle2,
  Clock,
  Shield,
  Trash2,
  RefreshCw
} from 'lucide-react';

// Multilingual Dictionary (English, Hindi, Sanskrit)
const TRANSLATIONS = {
  en: {
    title: 'Vedic Jyotish',
    subtitle: 'AI-Powered Kundli & Horoscope',
    patrikaTab: 'My Patrika',
    horoscopesTab: 'Horoscopes',
    panchangTab: 'Panchang & Festivals',
    matchingTab: 'Guna Milan',
    guruTab: 'Ask Shastri AI',
    reportsTab: 'Reports',
    settingsTab: 'Admin & Privacy',
    logout: 'Logout Seeker',
    loginPrompt: 'Please access or create your seeker profile to synchronize your birth charts.',
    savePatrika: 'Save Kundli to Cloud',
    planetaryPositions: 'Planetary Alignments',
    activeYogas: 'Auspicious Yogas Present',
    activeDoshas: 'Active Doshas & Remedies',
    mahadashaTimeline: 'Mahadasha Period Timeline (Vimsottari)',
    luckyDetails: 'Lucky Particulars',
    remediesTitle: 'Personalized Astro Remedies',
    noProfileYet: 'Please configure your birth particulars to generate your Vedic chart.'
  },
  hi: {
    title: 'वैदिक ज्योतिष',
    subtitle: 'कृत्रिम बुद्धिमत्ता आधारित कुंडली एवं राशिफल',
    patrikaTab: 'मेरी पत्रिका',
    horoscopesTab: 'राशिफल',
    panchangTab: 'पंचांग और त्यौहार',
    matchingTab: 'गुण मिलान',
    guruTab: 'शास्त्री जी से पूछें',
    reportsTab: 'रिपोर्ट्स',
    settingsTab: 'प्रशासन और गोपनीयता',
    logout: 'लॉगआउट करें',
    loginPrompt: 'अपनी जन्म कुंडली को सिंक्रनाइज़ करने के लिए कृपया लॉगिन करें या पंजीकरण करें।',
    savePatrika: 'क्लाउड में कुंडली सहेजें',
    planetaryPositions: 'ग्रहों की स्थिति',
    activeYogas: 'सक्रिय शुभ योग',
    activeDoshas: 'सक्रिय दोष एवं उपाय',
    mahadashaTimeline: 'महादशा समयावधि (विंशोत्तरी)',
    luckyDetails: 'शुभ विवरण',
    remediesTitle: 'व्यक्तिगत ज्योतिषीय उपाय',
    noProfileYet: 'कृपया अपनी जन्म कुंडली उत्पन्न करने के लिए विवरण दर्ज करें।'
  },
  sa: {
    title: 'वैदिक ज्योतिषम्',
    subtitle: 'कृत्रिमप्रज्ञा आधारित कुंडली एवं शुभाशुभफलम्',
    patrikaTab: 'मम पत्रिका',
    horoscopesTab: 'राशिफलम्',
    panchangTab: 'पञ्चाङ्गम् तथा उत्सवाः',
    matchingTab: 'गुणमेलनम्',
    guruTab: 'शास्त्री महाशयेन सह सम्भाषणम्',
    reportsTab: 'विवरणपत्राणि',
    settingsTab: 'प्रशासनं तथा गोपनीयता',
    logout: 'निर्गमनम्',
    loginPrompt: 'भवतः जन्मपत्रिकां सिंक्रनाइज़ कर्तुं कृपया प्रवेशं करोतु वा पञ्जीकरणं करोतु।',
    savePatrika: 'मेघपटले पत्रिका सञ्चयः',
    planetaryPositions: 'ग्रहाणाम् संस्थितिः',
    activeYogas: 'शुभ योगाः',
    activeDoshas: 'सक्रिय दोषाः तथा परिहाराः',
    mahadashaTimeline: 'विंशोत्तरी महादशा कालचक्रम्',
    luckyDetails: 'शुभाः विशेषाः',
    remediesTitle: 'मङ्गल परिहाराः',
    noProfileYet: 'कृपया जन्मपत्रिकां निर्मातुं जन्मविवरणं प्रविशन्तु।'
  }
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Theme support
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'patrika' | 'horoscope' | 'panchang' | 'matching' | 'guru' | 'report' | 'settings'>('patrika');

  // Birth Profile & Calculations
  const [birthDetails, setBirthDetails] = useState<BirthDetails | null>(null);
  const [astrologicalProfile, setAstrologicalProfile] = useState<AstrologicalProfile | null>(null);

  // Saved profiles & Bookmarks loaded from cloud db
  const [savedProfiles, setSavedProfiles] = useState<BirthDetails[]>([]);
  const [bookmarkedPredictions, setBookmarkedPredictions] = useState<any[]>([]);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const [cloudSyncSuccess, setCloudSyncSuccess] = useState(false);

  // Monitor auth status
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        setIsGuest(false);
        loadUserDataFromCloud(firebaseUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // Set default guest profile details for demonstration if they just want a default view
  const loadGuestDefault = () => {
    setIsGuest(true);
    const guestDetails: BirthDetails = {
      fullName: 'Aarav Sharma',
      gender: 'male',
      dateOfBirth: '1995-12-15',
      timeOfBirth: '06:15',
      placeOfBirth: 'Varanasi, Uttar Pradesh, India',
      language: 'en'
    };
    setBirthDetails(guestDetails);
    setAstrologicalProfile(generateAstrologicalProfile(guestDetails));
  };

  // Load profile and bookmarks from Firestore
  const loadUserDataFromCloud = async (userId: string) => {
    if (!db) return;
    try {
      // 1. Get primary birth profile
      const profileDoc = await getDoc(doc(db, 'profiles', userId));
      if (profileDoc.exists()) {
        const data = profileDoc.data() as BirthDetails;
        setBirthDetails(data);
        setAstrologicalProfile(generateAstrologicalProfile(data));
      }

      // 2. Load saved directory profiles
      const q = query(collection(db, 'saved_charts'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const profilesList: BirthDetails[] = [];
      querySnapshot.forEach((doc) => {
        profilesList.push(doc.data().birthDetails as BirthDetails);
      });
      setSavedProfiles(profilesList);

      // 3. Load bookmarks
      const bq = query(collection(db, 'bookmarks'), where('userId', '==', userId));
      const bSnapshot = await getDocs(bq);
      const bookmarksList: any[] = [];
      bSnapshot.forEach((doc) => {
        bookmarksList.push(doc.data().bookmarkData);
      });
      setBookmarkedPredictions(bookmarksList);
    } catch (err) {
      console.error('Error loading cloud user data:', err);
    }
  };

  // Handle Birth Details Form Submit
  const handleProfileSubmit = async (details: BirthDetails) => {
    setBirthDetails(details);
    const calculatedProfile = generateAstrologicalProfile(details);
    setAstrologicalProfile(calculatedProfile);

    // If logged in, automatically save profile to Firestore
    if (user && db) {
      setSavingToCloud(true);
      try {
        await setDoc(doc(db, 'profiles', user.uid), details);
        
        // Also save to collective directory for Guna Milan quick selection
        const directoryRef = doc(db, 'saved_charts', `${user.uid}_${details.fullName.replace(/\s+/g, '_')}`);
        await setDoc(directoryRef, {
          userId: user.uid,
          birthDetails: details,
          createdAt: new Date().toISOString()
        });

        // Add to local state directory
        if (!savedProfiles.some(p => p.fullName === details.fullName)) {
          setSavedProfiles((prev) => [...prev, details]);
        }

        setCloudSyncSuccess(true);
        setTimeout(() => setCloudSyncSuccess(false), 3000);
      } catch (err) {
        console.error('Error syncing birth profile to cloud:', err);
      } finally {
        setSavingToCloud(false);
      }
    }
  };

  // Save/Unsave Bookmarks
  const handleBookmarkPrediction = async (prediction: any) => {
    setBookmarkedPredictions((prev) => {
      const exists = prev.some(b => b.id === prediction.id);
      let updated = [];
      if (exists) {
        updated = prev.filter(b => b.id !== prediction.id);
      } else {
        updated = [...prev, prediction];
      }

      // If logged in, update in Firestore
      if (user && db) {
        setDoc(doc(db, 'bookmarks', `${user.uid}_${prediction.id}`), {
          userId: user.uid,
          bookmarkData: prediction,
          createdAt: new Date().toISOString()
        }).catch(err => console.error('Error saving bookmark:', err));
      }

      return updated;
    });
  };

  // Admin delete mock/cloud profile handler
  const handleDeleteProfile = async (index: number) => {
    const profToDelete = savedProfiles[index];
    setSavedProfiles((prev) => prev.filter((_, idx) => idx !== index));
    
    if (user && db && profToDelete) {
      try {
        // delete code or call firebase service
        // For simplicity, let state update be fast and user-friendly.
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        setUser(null);
        setIsGuest(false);
        setBirthDetails(null);
        setAstrologicalProfile(null);
        setSavedProfiles([]);
        setBookmarkedPredictions([]);
      });
    }
  };

  // Determine language preference
  const lang = birthDetails?.language || 'en';
  const t = TRANSLATIONS[lang];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d12] flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full border-4 border-gold-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-gold-300 font-display uppercase tracking-widest">Consulting Star Alignments...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-[#0b0b0e] text-neutral-100' 
        : 'bg-gold-50/40 text-neutral-900'
    }`}>
      
      {/* Absolute ambient starry decoration (on dark theme only) */}
      {theme === 'dark' && (
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />
      )}

      {/* Main Container */}
      {!user && !isGuest ? (
        // WELCOME / GATEWAY SCREEN
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
          <div className="absolute top-8 right-8 flex items-center gap-2">
            <button
              id="btn-gate-theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-full border border-neutral-800 bg-[#13131a] text-gold-400 hover:text-gold-300 transition"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="text-center mb-8 max-w-lg space-y-2">
            <h1 className="text-4xl md:text-5xl font-display font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-saffron-500 via-gold-400 to-amber-300">
              VEDIC JYOTISH
            </h1>
            <p className="text-xs uppercase font-mono tracking-[0.25em] text-gold-500 font-semibold">
              The Absolute Cosmic Blueprint of Your Soul
            </p>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              Calculate standard Guna Milan, read personalized charts, and seek counseling from Acharya Shastri.
            </p>
          </div>

          <AuthCard
            onAuthSuccess={(firebaseUser) => setUser(firebaseUser)}
            onContinueAsGuest={loadGuestDefault}
          />
        </div>
      ) : (
        // DASHBOARD INTERFACE
        <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
          
          {/* Header */}
          <header className={`rounded-3xl border p-5 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${
            theme === 'dark' ? 'bg-[#13131a] border-gold-900/40' : 'bg-white border-gold-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-saffron-600 to-gold-400 flex items-center justify-center text-lg shadow-md shadow-saffron-900/10">
                ☸️
              </div>
              <div>
                <h1 className="text-lg font-display font-bold text-gold-100 tracking-wider flex items-center gap-1.5">
                  {t.title}
                  <span className="text-[10px] bg-saffron-500/10 border border-saffron-500/20 text-saffron-400 font-bold font-mono px-1.5 py-0.5 rounded uppercase">PRO</span>
                </h1>
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">{t.subtitle}</p>
              </div>
            </div>

            {/* Profile Context & Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Language Selector */}
              {birthDetails && (
                <div className="flex bg-[#1d1d26] p-0.5 rounded-lg border border-neutral-800 text-[10px] font-bold">
                  {(['en', 'hi', 'sa'] as const).map((l) => (
                    <button
                      key={l}
                      id={`btn-lang-toggle-${l}`}
                      onClick={() => handleProfileSubmit({ ...birthDetails, language: l })}
                      className={`px-2 py-1 rounded capitalize transition ${
                        lang === l ? 'bg-gold-500 text-neutral-950 font-black' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}

              {birthDetails && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1b1b24] rounded-xl border border-neutral-800">
                  <div className="text-sm">
                    {birthDetails.profilePicture === 'ganesha' && '🐘'}
                    {birthDetails.profilePicture === 'surya' && '☀️'}
                    {birthDetails.profilePicture === 'chandra' && '🌙'}
                    {birthDetails.profilePicture === 'lotus' && '🪷'}
                    {birthDetails.profilePicture === 'mandala' && '☸️'}
                    {birthDetails.profilePicture === 'trishul' && '🔱'}
                  </div>
                  <span className="text-xs font-semibold text-gold-200">{birthDetails.fullName}</span>
                </div>
              )}

              <button
                id="btn-main-theme-toggle"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 rounded-xl border border-neutral-800 bg-[#1b1b24] text-gold-400 hover:text-gold-300 transition"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                id="btn-logout-action"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-red-950/20 text-red-400 border border-red-900/30 hover:bg-red-950/40 rounded-xl transition font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t.logout}
              </button>
            </div>
          </header>

          {/* Quick Stats overview bar if profile is configured */}
          {astrologicalProfile && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#13131a] p-4 rounded-2xl border border-gold-900/15 flex flex-col justify-between">
                <span className="text-[10px] font-mono text-neutral-400">RASHI & NAKSHATRA</span>
                <p className="text-sm font-semibold text-gold-200 font-display mt-1">
                  {astrologicalProfile.rashi} • {astrologicalProfile.nakshatra}
                </p>
              </div>
              <div className="bg-[#13131a] p-4 rounded-2xl border border-gold-900/15 flex flex-col justify-between">
                <span className="text-[10px] font-mono text-neutral-400">LUCKY DETAILS</span>
                <p className="text-sm font-semibold text-gold-200 font-display mt-1">
                  Color: {astrologicalProfile.luckyColor}
                </p>
              </div>
              <div className="bg-[#13131a] p-4 rounded-2xl border border-gold-900/15 flex flex-col justify-between">
                <span className="text-[10px] font-mono text-neutral-400">LUCKY GEMSTONE</span>
                <p className="text-sm font-semibold text-gold-200 font-display mt-1">
                  {astrologicalProfile.luckyGemstone}
                </p>
              </div>
              <div className="bg-[#13131a] p-4 rounded-2xl border border-gold-900/15 flex flex-col justify-between">
                <span className="text-[10px] font-mono text-neutral-400">LUCKY NUMBER</span>
                <p className="text-sm font-semibold text-gold-200 font-display mt-1">
                  Number {astrologicalProfile.luckyNumber}
                </p>
              </div>
            </div>
          )}

          {/* Main Workspace: Side-by-side or tabs */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Left Nav menu + Birth Profile setup Form */}
            <div className="lg:col-span-1 space-y-6">
              {/* Tab selector */}
              <div className={`rounded-3xl border p-4 flex flex-col gap-1 transition-colors ${
                theme === 'dark' ? 'bg-[#13131a] border-gold-900/40' : 'bg-white border-gold-200'
              }`}>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-2 ml-1">Astrological Center</span>
                
                <button
                  id="tab-btn-patrika"
                  onClick={() => setActiveTab('patrika')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                    activeTab === 'patrika' 
                      ? 'bg-gradient-to-r from-saffron-600/15 to-gold-500/10 text-gold-300 border border-gold-500/30' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Compass className="w-4 h-4 text-saffron-500" />
                  {t.patrikaTab}
                </button>

                <button
                  id="tab-btn-horoscope"
                  onClick={() => setActiveTab('horoscope')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                    activeTab === 'horoscope' 
                      ? 'bg-gradient-to-r from-saffron-600/15 to-gold-500/10 text-gold-300 border border-gold-500/30' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <CalendarDays className="w-4 h-4 text-saffron-500" />
                  {t.horoscopesTab}
                </button>

                <button
                  id="tab-btn-panchang"
                  onClick={() => setActiveTab('panchang')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                    activeTab === 'panchang' 
                      ? 'bg-gradient-to-r from-saffron-600/15 to-gold-500/10 text-gold-300 border border-gold-500/30' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4 text-saffron-500" />
                  {t.panchangTab}
                </button>

                <button
                  id="tab-btn-matching"
                  onClick={() => setActiveTab('matching')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                    activeTab === 'matching' 
                      ? 'bg-gradient-to-r from-saffron-600/15 to-gold-500/10 text-gold-300 border border-gold-500/30' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Heart className="w-4 h-4 text-saffron-500" />
                  {t.matchingTab}
                </button>

                <button
                  id="tab-btn-guru"
                  onClick={() => setActiveTab('guru')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                    activeTab === 'guru' 
                      ? 'bg-gradient-to-r from-saffron-600/15 to-gold-500/10 text-gold-300 border border-gold-500/30' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-saffron-500" />
                  {t.guruTab}
                </button>

                <button
                  id="tab-btn-report"
                  onClick={() => setActiveTab('report')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                    activeTab === 'report' 
                      ? 'bg-gradient-to-r from-saffron-600/15 to-gold-500/10 text-gold-300 border border-gold-500/30' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4 text-saffron-500" />
                  {t.reportsTab}
                </button>

                <button
                  id="tab-btn-settings"
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                    activeTab === 'settings' 
                      ? 'bg-gradient-to-r from-saffron-600/15 to-gold-500/10 text-gold-300 border border-gold-500/30' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Settings className="w-4 h-4 text-saffron-500" />
                  {t.settingsTab}
                </button>
              </div>

              {/* Configure birth particulars box */}
              <div className="bg-[#13131a] border border-neutral-800 rounded-3xl p-5 space-y-4">
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">Birth Profile (Janam)</span>
                {birthDetails ? (
                  <div className="space-y-3">
                    <div className="text-xs space-y-1 bg-[#1b1b24] p-3 rounded-xl border border-neutral-800">
                      <p className="text-neutral-400">Date: <span className="font-semibold text-neutral-200">{birthDetails.dateOfBirth}</span></p>
                      <p className="text-neutral-400">Time: <span className="font-semibold text-neutral-200">{birthDetails.timeOfBirth}</span></p>
                      <p className="text-neutral-400">Place: <span className="font-semibold text-neutral-200 line-clamp-1">{birthDetails.placeOfBirth}</span></p>
                    </div>
                    <button
                      id="btn-edit-birth-profile"
                      onClick={() => {
                        setBirthDetails(null);
                        setAstrologicalProfile(null);
                      }}
                      className="w-full py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-xs font-semibold transition"
                    >
                      Update Birth Details
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Set up your exact coordinates to dynamically calculate houses and active yogas.
                  </p>
                )}
              </div>
            </div>

            {/* Right main workspace panel */}
            <div className="lg:col-span-3">
              {!astrologicalProfile ? (
                // Setup profile form if no birth particulars are configured
                <ProfileForm
                  initialDetails={birthDetails || undefined}
                  onSubmit={handleProfileSubmit}
                />
              ) : (
                // TAB VIEWS
                <div className="space-y-6">
                  {activeTab === 'patrika' && (
                    <div className="space-y-6 animate-fade-in">
                      {/* Janam Kundli and Lagna chart */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <KundliChart
                          planetaryPositions={astrologicalProfile.planetaryPositions}
                          lagnaRashi={astrologicalProfile.rashi}
                        />

                        {/* Remedies and Gemstone Card */}
                        <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 space-y-4">
                          <h3 className="text-lg font-display font-semibold text-gold-100 flex items-center gap-1.5">
                            <Sparkles className="text-saffron-500 w-5 h-5 animate-pulse" />
                            {t.remediesTitle}
                          </h3>
                          <p className="text-xs text-neutral-400 leading-relaxed">
                            Based on your Moon Rashi ({astrologicalProfile.rashi}) and Nakshatra, practice these daily rituals to dissolve karmic blockages.
                          </p>

                          <div className="space-y-3 pt-2">
                            {astrologicalProfile.remedies.map((rem, idx) => (
                              <div key={idx} className="flex gap-2.5 text-xs bg-[#1b1b24] p-3 rounded-xl border border-neutral-800/60 leading-relaxed text-neutral-200">
                                <span className="text-gold-500 font-bold shrink-0">🕉️</span>
                                <p>{rem}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Active Yogas / Doshas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Active Yogas */}
                        <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 space-y-4">
                          <h4 className="text-sm font-bold text-saffron-400 uppercase tracking-widest font-mono">
                            {t.activeYogas}
                          </h4>
                          {astrologicalProfile.yogas.length > 0 ? (
                            <div className="space-y-3">
                              {astrologicalProfile.yogas.map((y) => (
                                <div key={y.name} className="p-4 bg-[#1b1b24] rounded-2xl border border-neutral-800/80">
                                  <h5 className="text-xs font-semibold text-gold-300 font-display">{y.name}</h5>
                                  <p className="text-[11px] text-neutral-400 mt-1">{y.description}</p>
                                  <p className="text-xs text-neutral-300 mt-2 bg-[#13131a] p-2.5 rounded-lg border border-neutral-800/40">{y.significance}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-400">No major auspicious yogas active today.</p>
                          )}
                        </div>

                        {/* Active Doshas */}
                        <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 space-y-4">
                          <h4 className="text-sm font-bold text-saffron-400 uppercase tracking-widest font-mono">
                            {t.activeDoshas}
                          </h4>
                          <div className="space-y-3">
                            {astrologicalProfile.doshas.map((d) => (
                              <div key={d.name} className="p-4 bg-[#1b1b24] rounded-2xl border border-neutral-800/80">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-xs font-semibold text-gold-300 font-display">{d.name}</h5>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                    d.severity === 'high' ? 'bg-red-500/10 text-red-400' :
                                    d.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                                    'bg-emerald-500/10 text-emerald-400'
                                  }`}>
                                    {d.severity} severity
                                  </span>
                                </div>
                                <p className="text-[11px] text-neutral-400 mt-1">{d.description}</p>
                                {d.remedies.length > 0 && (
                                  <div className="mt-3 space-y-1 pt-2 border-t border-neutral-800/60">
                                    <span className="text-[10px] font-mono text-neutral-500 block uppercase">Recommended Pooja/Charity</span>
                                    {d.remedies.map((r, rIdx) => (
                                      <p key={rIdx} className="text-[11px] text-neutral-300">• {r}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Vimsottari Mahadasha timeline */}
                      <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 space-y-4">
                        <h4 className="text-sm font-bold text-saffron-400 uppercase tracking-widest font-mono">
                          {t.mahadashaTimeline}
                        </h4>
                        <p className="text-xs text-neutral-400">
                          Timeline sequence of active planets running in cycles throughout your solar lifespan.
                        </p>
                        
                        <div className="relative border-l border-neutral-800 ml-4 pl-6 space-y-6 pt-2">
                          {astrologicalProfile.mahadasha.slice(0, 5).map((dash, dIdx) => (
                            <div key={dash.planet} className="relative">
                              {/* Dot indicator */}
                              <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-gradient-to-tr from-saffron-600 to-gold-400 flex items-center justify-center text-[8px] text-neutral-950 font-bold border-2 border-[#13131a]">
                                🕉️
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <h5 className="text-xs font-bold text-gold-300 font-display uppercase tracking-wider">{dash.planet} Period</h5>
                                <span className="text-xs font-mono text-neutral-400 bg-neutral-800/40 px-2 py-0.5 rounded border border-neutral-800/40">
                                  {dash.startDate} to {dash.endDate}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'horoscope' && (
                    <HoroscopeView
                      userRashi={astrologicalProfile.rashi}
                      onBookmarkPrediction={handleBookmarkPrediction}
                      bookmarkedPredictions={bookmarkedPredictions}
                    />
                  )}

                  {activeTab === 'panchang' && <PanchangFestivals />}

                  {activeTab === 'matching' && (
                    <KundliMatching
                      currentUserDetails={birthDetails}
                      savedProfiles={savedProfiles}
                    />
                  )}

                  {activeTab === 'guru' && <AstroGuru birthProfile={astrologicalProfile} />}

                  {activeTab === 'report' && <DownloadReport birthProfile={astrologicalProfile} />}

                  {activeTab === 'settings' && (
                    <AdminPanel
                      savedProfiles={savedProfiles}
                      onDeleteProfile={handleDeleteProfile}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
