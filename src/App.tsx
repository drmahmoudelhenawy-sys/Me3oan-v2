
import React, { useState, useEffect, useCallback } from "react";
import { User, onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import AuthScreen from "../components/AuthScreen";
import SecretCodeScreen from "../components/SecretCodeScreen";
import Dashboard from "../components/Dashboard";
import IdentitySystem from "../components/IdentitySystem"; 
import PublicOrgStructure from "../components/PublicOrgStructure"; 
import WamanAhyaahaSystem from "../components/WamanAhyaahaSystem"; 
import IntroScreen from "../components/IntroScreen";
import { Loader2, ArrowRight } from "lucide-react";


// ── show intro only once per browser session ──────────────────────────────────
const INTRO_KEY = "ma3wan_intro_v2_shown";

export default function App() {
  const [user, setUser]                   = useState<User | null>(null);
  const [authLoading, setAuthLoading]     = useState(true);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [accessLevel, setAccessLevel]     = useState<'full' | 'charity_restricted'>('full');
  const [darkMode, setDarkMode]           = useState(false);

  // show intro only if not shown before in this session  
  const [showIntro, setShowIntro]         = useState<boolean>(() => {
    // Skip intro on public URL params (donor form, blood admin)
    const params = new URLSearchParams(window.location.search);
    if (params.get('view')) return false;
    try {
      return !sessionStorage.getItem(INTRO_KEY);
    } catch (e) {
      console.warn("SessionStorage access failed:", e);
      return false; // Default to not showing intro if storage fails
    }
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Public Access States
  const [publicView, setPublicView] = useState<'none' | 'identity' | 'org' | 'blood' | 'donor_form' | 'blood_admin'>('none');
  const [telegramConfig, setTelegramConfig] = useState<any>({});

  useEffect(() => {
    // 1. Check Local Verification
    let verifiedStatus: string | null = null;
    try {
      verifiedStatus = localStorage.getItem("ma3wan_code_verified");
    } catch (e) { console.warn("LocalStorage access failed:", e); }

    if (verifiedStatus === "full" || verifiedStatus === "true") {
      setIsCodeVerified(true);
      setAccessLevel('full');
    } else if (verifiedStatus === "charity_restricted") {
      setIsCodeVerified(true);
      setAccessLevel('charity_restricted');
    }

    // 2. Listen for Auth
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Re-verify code status (in case AuthScreen set it during login)
      let verifiedStatus: string | null = null;
      try {
        verifiedStatus = localStorage.getItem("ma3wan_code_verified");
      } catch (e) { console.warn("LocalStorage access failed:", e); }

      if (verifiedStatus === "full" || verifiedStatus === "true") {
        setIsCodeVerified(true);
        setAccessLevel('full');
      }

      setUser(currentUser);
      setAuthLoading(false);
    });

    // 3. Fetch Config
    const fetchConfig = async () => {
        try {
            const docSnap = await getDoc(doc(db, "app_settings", "telegram_config"));
            if (docSnap.exists()) setTelegramConfig(docSnap.data());
        } catch(e) { console.error(e); }
    };
    fetchConfig();
    
    // 4. Routing Logic
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');

    if (viewParam) {
        if (viewParam === 'donor_form' || viewParam === 'blood_admin') {
            handlePublicAccess(viewParam as any);
        }
    }

    return () => unsubscribe();
  }, []);


  const handleIntroFinish = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch (e) { console.warn("SessionStorage set failed:", e); }
    setShowIntro(false);
  }, []);

  const sendTelegramMessage = async (targetChatId: string, text: string, botToken?: string) => {
      if (!text || !targetChatId) return;
      const DEFAULT_TOKEN = "8048288694:AAH92QC0rHgkaYHjQxQyWLU3PRrhTiGmLZA";
      const tokenToUse = botToken || telegramConfig?.defaultBotToken || DEFAULT_TOKEN;
      
      try {
        await fetch(`https://api.telegram.org/bot${tokenToUse}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              chat_id: targetChatId, 
              text: text, 
              parse_mode: 'HTML',
              disable_web_page_preview: false 
            })
        });
      } catch (e) { console.error("Telegram Send Error:", e); }
  };

  const handlePublicAccess = async (view: 'identity' | 'org' | 'blood' | 'donor_form' | 'blood_admin') => {
      if (!auth.currentUser) {
          setAuthLoading(true);
          try {
              await signInAnonymously(auth);
          } catch (error) {
              console.error("Anonymous auth failed:", error);
          } finally {
              setAuthLoading(false);
          }
      }
      setPublicView(view);
  };

  const exitPublicView = async () => {
      try {
          localStorage.removeItem('ma3wan_blood_admin'); 
      } catch (e) { console.warn("LocalStorage remove failed:", e); }
      if (window.location.search.includes('view=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
      }
      setPublicView('none');
      if (user?.isAnonymous) {
          await signOut(auth);
      }
      window.location.reload();
  };

  // ── Show Intro ─────────────────────────────────────────────────────────────
  if (showIntro) {
    return <IntroScreen onFinish={handleIntroFinish} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-indigo-600 font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="font-medium animate-pulse">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // --- Public Views Wrapper ---
  if (publicView !== 'none') {
    return (
      <div className="min-h-screen bg-[#F3F4F6] dark:bg-gray-900 flex flex-col" dir="rtl">
         {publicView !== 'donor_form' && publicView !== 'blood_admin' && (
             <div className="bg-white dark:bg-gray-800 p-4 shadow-sm flex justify-between items-center sticky top-0 z-50 shrink-0">
                <div className="flex items-center gap-2">
                    <button 
                      onClick={exitPublicView} 
                      className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-xl transition"
                    >
                        <ArrowRight size={20} />
                        <span className="font-bold text-sm">عودة للرئيسية</span>
                    </button>
                </div>
                <p className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full">
                    {publicView === 'identity' && 'دليل الهوية البصرية'}
                    {publicView === 'org' && 'الهيكل الإداري'}
                    {publicView === 'blood' && 'إدارة بنك الدم (ومن أحياها)'}
                </p>
             </div>
         )}
         
         <div className={`flex-1 mx-auto w-full ${publicView === 'org' ? '' : 'max-w-7xl p-4 md:p-8'}`}>
            {publicView === 'identity' && <IdentitySystem user={user || { email: 'guest', uid: 'guest_user' }} isPublicView={true} />}
            {publicView === 'org' && <PublicOrgStructure />}
            {publicView === 'blood' && (
                <WamanAhyaahaSystem 
                    user={user || { email: 'guest', uid: 'guest' }} 
                    telegramConfig={telegramConfig} 
                    onSendTelegram={sendTelegramMessage}
                    isPublicMode={true}
                />
            )}
            {publicView === 'donor_form' && (
                <WamanAhyaahaSystem 
                    user={user || { email: 'guest', uid: 'guest' }} 
                    telegramConfig={telegramConfig} 
                    onSendTelegram={sendTelegramMessage}
                    isPublicMode={true}
                    forceGuestMode={true} 
                />
            )}
            {publicView === 'blood_admin' && (
                <div className="relative">
                    <WamanAhyaahaSystem 
                        user={user || { email: 'guest', uid: 'guest' }} 
                        telegramConfig={telegramConfig} 
                        onSendTelegram={sendTelegramMessage}
                        isPublicMode={true}
                        standaloneAdminMode={true} 
                    />
                </div>
            )}
         </div>
      </div>
    );
  }

  let isMagicSession = false;
  try {
      isMagicSession = localStorage.getItem('ma3wan_magic_session') === 'true';
  } catch (e) { console.warn("Magic session check failed", e); }

  if (!user || (user.isAnonymous && !isMagicSession)) {
    return (
        <AuthScreen 
            onGuestIdentity={() => handlePublicAccess('identity')}
            onGuestOrg={() => handlePublicAccess('org')}
            onGuestBlood={() => handlePublicAccess('blood')}
            onGuestDonorForm={() => handlePublicAccess('donor_form')}
        />
    );
  }

  if (!isCodeVerified) {
    return <SecretCodeScreen onSuccess={(level) => {
        setIsCodeVerified(true);
        setAccessLevel(level);
    }} />;
  }

  return <Dashboard user={user} telegramConfig={telegramConfig} onSendTelegram={sendTelegramMessage} accessLevel={accessLevel} darkMode={darkMode} setDarkMode={setDarkMode} />;
}
