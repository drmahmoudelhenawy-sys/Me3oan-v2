
import React, { useState, useEffect, useCallback } from "react";
import { User, onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import AuthScreen from "../components/AuthScreen";
import SecretCodeScreen from "../components/SecretCodeScreen";
import Dashboard from "../components/Dashboard";
import IdentitySystem from "../components/IdentitySystem"; 
import PublicOrgStructure from "../components/PublicOrgStructure"; 
import WamanAhyaahaSystem from "../components/WamanAhyaahaSystem"; 
import IntroScreen from "../components/IntroScreen";
import { Loader2, ArrowRight } from "lucide-react";
import { safeStorage } from "../utils/browserStorage";


// ── show intro only once per browser session ──────────────────────────────────
const INTRO_KEY = "ma3wan_intro_v2_shown";

const getSiteUserTelegramId = (user: any) =>
  String(user?.telegramId || user?.chatId || user?.telegramChatId || "").trim();

const mergeTelegramConfigWithSiteUsers = (telegramConfig: any = {}, siteUsers: any[] = []) => {
  const manualPeople = Array.isArray(telegramConfig.people) ? telegramConfig.people : [];
  const sitePeople = siteUsers
    .map((siteUser) => {
      const chatId = getSiteUserTelegramId(siteUser);
      if (!chatId) return null;
      const uid = siteUser.uid || siteUser.id;
      return {
        id: `site_${uid}`,
        name: siteUser.displayName || siteUser.email || "مستخدم بدون اسم",
        chatId,
        source: "site"
      };
    })
    .filter(Boolean);

  return {
    ...telegramConfig,
    people: [...manualPeople, ...sitePeople]
  };
};

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
    return !safeStorage.get("sessionStorage", INTRO_KEY);
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
    const verifiedStatus = safeStorage.get("localStorage", "ma3wan_code_verified");
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
      const verifiedStatus = safeStorage.get("localStorage", "ma3wan_code_verified");
      if (verifiedStatus === "full" || verifiedStatus === "true") {
        setIsCodeVerified(true);
        setAccessLevel('full');
      }

      setUser(currentUser);
      setAuthLoading(false);
    });

    // 3. Keep Telegram config live and merge site users with Telegram IDs.
    let latestTelegramConfig: any = {};
    let latestSiteUsers: any[] = [];
    const publishTelegramConfig = () => {
      setTelegramConfig(mergeTelegramConfigWithSiteUsers(latestTelegramConfig, latestSiteUsers));
    };

    const unsubscribeTelegramConfig = onSnapshot(
        doc(db, "app_settings", "telegram_config"),
        (docSnap) => {
            latestTelegramConfig = docSnap.exists() ? docSnap.data() : {};
            publishTelegramConfig();
        },
        (error) => console.error("Telegram config listener error:", error)
    );

    const unsubscribeSiteUsers = onSnapshot(
        collection(db, "users"),
        (snapshot) => {
            latestSiteUsers = snapshot.docs.map((userDoc) => ({
              id: userDoc.id,
              ...userDoc.data()
            }));
            publishTelegramConfig();
        },
        (error) => console.error("Users listener error:", error)
    );
    
    // 4. Routing Logic
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');

    if (viewParam) {
        if (viewParam === 'donor_form' || viewParam === 'blood_admin') {
            handlePublicAccess(viewParam as any);
        }
    }

    return () => {
      unsubscribe();
      unsubscribeTelegramConfig();
      unsubscribeSiteUsers();
    };
  }, []);


  const handleIntroFinish = useCallback(() => {
    safeStorage.set("sessionStorage", INTRO_KEY, "1");
    setShowIntro(false);
  }, []);

  const sendTelegramMessage = async (targetChatId: string, text: string, botToken?: string) => {
      if (!text || !targetChatId) return;
      const envBotToken = (import.meta as any).env?.VITE_TELEGRAM_BOT_TOKEN || "";
      const tokenToUse = botToken || telegramConfig?.defaultBotToken || envBotToken;
      if (!tokenToUse) {
        console.warn("Telegram bot token is not configured.");
        return;
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${tokenToUse}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              chat_id: targetChatId, 
              text: text, 
              parse_mode: 'HTML',
              disable_web_page_preview: false 
            })
        });
        if (!response.ok) {
          console.warn("Telegram Send Error:", await response.text());
        }
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
      safeStorage.remove("localStorage", "ma3wan_blood_admin"); 
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

  if (!user || (user.isAnonymous && safeStorage.get("localStorage", "ma3wan_magic_session") !== "true")) {
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
