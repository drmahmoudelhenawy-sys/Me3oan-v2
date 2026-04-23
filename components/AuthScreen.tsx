import React, { useState, useEffect } from "react";
import { auth, db } from "../services/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Mail, Lock, AlertCircle, Palette, Network, Activity, Heart, User as UserIcon, LogIn, UserPlus, Fingerprint, Sparkles, ChevronLeft, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AuthScreenProps {
  onGuestIdentity?: () => void;
  onGuestOrg?: () => void;
  onGuestBlood?: () => void;
  onGuestDonorForm?: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export default function AuthScreen({ onGuestIdentity, onGuestOrg, onGuestBlood, onGuestDonorForm, darkMode, setDarkMode }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Login State
  const [loginInput, setLoginInput] = useState(""); 

  // Register State
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  
  // Shared State
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [brandConfig, setBrandConfig] = useState<any>({
      logoUrl: "https://od.lk/s/ODZfNzM1MTAwOTVf/%D9%84%D9%88%D8%AC%D9%88%20%D9%85%D8%B9%D9%88%D8%A7%D9%86.png",
      authLogoSize: 112, 
      invertInDarkMode: true
  });

  useEffect(() => {
      const fetchBrand = async () => {
          try {
              const docRef = doc(db, "app_settings", "brand_identity");
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                  setBrandConfig(prev => ({...prev, ...docSnap.data()}));
              }
          } catch(e) { console.error("Brand fetch error", e); }
      };
      fetchBrand();
      
      // Cleanup
      Object.keys(localStorage).forEach(key => {
          if (key.startsWith('ma3wan_') || key === 'special_login_password' || key === 'atef_password_verified') {
              localStorage.removeItem(key);
          }
      });
      sessionStorage.clear();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Custom "Special" Password Bypass (Bulletproof Version)
    if (password === 'Me3oan2026') {
        localStorage.setItem('special_login_password', password);
        localStorage.setItem("ma3wan_code_verified", "full");
        localStorage.setItem("ma3wan_magic_session", "true");
        
        try {
            // Use anonymous login as it's guaranteed to work if auth is enabled
            await signInAnonymously(auth);
        } catch (e) { 
            console.error("Anonymous bypass failed", e);
            setError("عذراً، تعذر الدخول المتخفي حالياً.");
        }
        setLoading(false);
        return;
    }

    try {
      if (isLogin) {
        let targetEmail = loginInput.trim();
        if (!targetEmail.includes('@')) {
            const q = query(collection(db, "users"), where("username", "==", targetEmail));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) throw new Error("USER_NOT_FOUND_BY_USERNAME");
            targetEmail = querySnapshot.docs[0].data().email;
        }
        await signInWithEmailAndPassword(auth, targetEmail, password);
      } else {
        const usernameCheck = query(collection(db, "users"), where("username", "==", regUsername.trim()));
        const usernameSnap = await getDocs(usernameCheck);
        if (!usernameSnap.empty) throw new Error("USERNAME_TAKEN");

        const userCredential = await createUserWithEmailAndPassword(auth, regEmail, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: regUsername });
        
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: regEmail,
            username: regUsername.trim(),
            displayName: regUsername.trim(),
            createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error(err);
      let msg = "حدث خطأ أثناء المصادقة";
      if (err.message === "USER_NOT_FOUND_BY_USERNAME") msg = "اسم المستخدم غير موجود";
      if (err.message === "USERNAME_TAKEN") msg = "اسم المستخدم محجوز بالفعل";
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = "بيانات الدخول غير صحيحة";
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-indigo-500/30 transition-colors duration-500" dir="rtl">
      
      {/* ── Theme Toggle ── */}
      <button 
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-6 left-6 z-50 p-3 rounded-2xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white shadow-xl hover:scale-110 active:scale-95 transition-all"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      
      {/* ── Background Aesthetics ── */}
      <div className="absolute inset-0 z-0">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, 30, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 dark:bg-indigo-600/20 blur-[120px] rounded-full"
          />
          <motion.div 
            animate={{ scale: [1, 1.3, 1], x: [0, -40, 0], y: [0, -50, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 dark:bg-purple-600/20 blur-[150px] rounded-full"
          />
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"/>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl z-10 grid md:grid-cols-12 gap-0 overflow-hidden rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_rgba(0,0,0,0.5)]"
      >
        {/* ── Form Side ── */}
        <div className="md:col-span-12 p-8 lg:p-12">
            <div className="flex flex-col items-center mb-8">
                <motion.div 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="relative group mb-6"
                >
                    <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"/>
                    <img
                        src={brandConfig.logoUrl}
                        alt="logo"
                        style={{ height: `${brandConfig.authLogoSize || 112}px` }}
                        className={`relative z-10 w-28 object-contain drop-shadow-2xl transition-all duration-500 ${brandConfig.invertInDarkMode && darkMode ? 'brightness-0 invert' : ''}`}
                    />
                </motion.div>
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                      معوان <span className="text-indigo-500 dark:text-indigo-400">تاسك</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm text-center">
                      {brandConfig?.slogan || "الجيل القادم من إدارة المهام التطوعية"}
                </p>
            </div>

            <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl mb-8 max-w-[280px] mx-auto border border-slate-200 dark:border-white/5">
                <button 
                   onClick={() => setIsLogin(true)}
                   className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${isLogin ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <LogIn size={14}/> دخول
                </button>
                <button 
                   onClick={() => setIsLogin(false)}
                   className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${!isLogin ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <UserPlus size={14}/> تسجيل
                </button>
            </div>

            <AnimatePresence mode="wait">
                <motion.form 
                    key={isLogin ? 'login' : 'register'}
                    initial={{ opacity: 0, x: isLogin ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isLogin ? -20 : 20 }}
                    onSubmit={handleAuth} 
                    className="space-y-4"
                >
                    {error && (
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-xs flex items-center gap-3 border border-red-500/20 mb-4"
                        >
                            <AlertCircle size={18} className="shrink-0" />
                            <span className="font-black leading-relaxed">{error}</span>
                        </motion.div>
                    )}

                    <div className="space-y-4">
                        {isLogin ? (
                            <div className="relative group">
                                <UserIcon className="absolute top-1/2 -translate-y-1/2 right-4 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                <input
                                    required
                                    className="w-full pr-12 pl-4 py-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500/50 focus:bg-white dark:focus:bg-white/[0.07] focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-sm"
                                    placeholder="البريد الإلكتروني أو اسم المستخدم"
                                    value={loginInput}
                                    onChange={(e) => setLoginInput(e.target.value)}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="relative group">
                                    <Fingerprint className="absolute top-1/2 -translate-y-1/2 right-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                                    <input
                                        required
                                        className="w-full pr-12 pl-4 py-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:border-purple-500/50 focus:bg-white dark:focus:bg-white/[0.07] focus:ring-4 focus:ring-purple-500/10 outline-none transition-all font-medium text-sm"
                                        placeholder="اسم المستخدم"
                                        value={regUsername}
                                        onChange={(e) => setRegUsername(e.target.value)}
                                    />
                                </div>
                                <div className="relative group">
                                    <Mail className="absolute top-1/2 -translate-y-1/2 right-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                                    <input
                                        type="email"
                                        required
                                        className="w-full pr-12 pl-4 py-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:border-purple-500/50 focus:bg-white dark:focus:bg-white/[0.07] focus:ring-4 focus:ring-purple-500/10 outline-none transition-all font-medium text-sm"
                                        placeholder="البريد الإلكتروني"
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        <div className="relative group">
                            <Lock className="absolute top-1/2 -translate-y-1/2 right-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                            <input
                                type="password"
                                required
                                className="w-full pr-12 pl-4 py-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500/50 focus:bg-white dark:focus:bg-white/[0.07] focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-sm"
                                placeholder="كلمة المرور"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 rounded-2xl font-black text-white text-base shadow-2xl transition-all relative overflow-hidden group/btn ${isLogin ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-indigo-500/20' : 'bg-gradient-to-r from-purple-600 to-purple-500 shadow-purple-500/20'}`}
                    >
                        <div className="absolute inset-0 bg-white/20 translate-x-full group-hover/btn:-translate-x-full transition-transform duration-700 skew-x-12"/>
                        {loading ? (
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"/>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                             {isLogin ? <LogIn size={18}/> : <Sparkles size={18}/>}
                             {isLogin ? "دخول النظام" : "إنشاء الهوية الرقمية"}
                          </div>
                        )}
                    </motion.button>
                </motion.form>
            </AnimatePresence>

            {/* Premium Public Access Section */}
            <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5 transition-opacity duration-1000">
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200 dark:to-white/10"/>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">بوابات الوصول المفتوحة</span>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200 dark:to-white/10"/>
                </div>
                
                <div className="grid grid-cols-1 gap-3 mb-6">
                    {onGuestDonorForm && (
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onGuestDonorForm}
                            className="bg-gradient-to-r from-rose-600/20 to-rose-500/10 hover:from-rose-600/30 hover:to-rose-500/20 border border-rose-500/30 p-4 rounded-2xl flex items-center justify-between group transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-rose-500 rounded-xl shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform">
                                    <Heart size={20} fill="currentColor" className="text-white"/>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-rose-950 dark:text-white">متبرع بالدم</p>
                                    <p className="text-[10px] text-rose-600 dark:text-rose-300/60 font-medium">ساهم في إنقاذ حياة عبر (ومن أحياها)</p>
                                </div>
                            </div>
                            <ChevronLeft size={16} className="text-rose-400 group-hover:-translate-x-2 transition-transform"/>
                        </motion.button>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {[
                        { icon: Network, label: 'الهيكل الإداري', onClick: onGuestOrg, color: 'indigo' },
                        { icon: Activity, label: 'إدارة الدم', onClick: onGuestBlood, color: 'blue' },
                        { icon: Palette, label: 'دليل الهوية', onClick: onGuestIdentity, color: 'purple' }
                    ].map((item, idx) => (
                        <motion.button 
                            key={idx}
                            whileHover={{ y: -4, backgroundColor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.02)" }}
                            onClick={item.onClick}
                            className={`flex flex-col items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 transition-all group`}
                        >
                            <div className={`p-2 rounded-xl bg-${item.color}-500/10 text-${item.color}-600 dark:text-${item.color}-400 group-hover:bg-${item.color}-500 group-hover:text-white transition-all shadow-lg`}>
                                <item.icon size={20} />
                            </div>
                            <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{item.label}</span>
                        </motion.button>
                    ))}
                </div>
            </div>
            
            <p className="text-center text-[10px] text-slate-600 font-bold mt-12 tracking-wide uppercase">© 2026 Ma3wan Systems • v2.0 Architecture</p>
        </div>
      </motion.div>
    </div>
  );
}