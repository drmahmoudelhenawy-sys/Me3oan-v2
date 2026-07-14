import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { 
  Award, Flame, Trophy, QrCode, Calendar, MapPin, User, Plus, Search, 
  Bell, ChevronRight, Settings, LogOut, Heart, Camera, CheckCircle, 
  X, Copy, PlusCircle, MinusCircle, Filter, ArrowRight, Lock, Shield, 
  Activity, Info, Droplet, Star, Clock, AlertCircle, Share2, Compass, Check,
  Printer, Maximize2, Eye, EyeOff
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { db } from "../services/firebase";

// ─── TYPES & INTERFACES ──────────────────────────────────────────────────────
interface Volunteer {
  uid: string;
  name: string;
  phone: string;
  bloodType: string;
  avatarUrl: string;
  points: number;
  campaignsCount: number;
  donationsCount: number;
  level: number;
  streak: number;
  lastActive: string;
  lastDonation?: string;
  badges: string[];
  role: 'volunteer' | 'organizer' | 'admin';
  wantsPoints?: boolean;
  email?: string;
  password?: string;
}

interface Campaign {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  volunteersRequired: number;
  volunteersRegistered: string[];
  status: 'upcoming' | 'active' | 'completed';
  pointsReward: {
    attendance: number;
    donation: number;
    organize: number;
  };
  qrSettings?: Partial<Record<'attendance' | 'donation' | 'organize', { active: boolean; points: number }>>;
}

interface PointsLog {
  id: string;
  volunteerId: string;
  volunteerName: string;
  campaignId: string;
  campaignTitle: string;
  points: number;
  type: 'attendance' | 'donation' | 'organize' | 'bonus' | 'penalty';
  date: string;
  description: string;
}

interface NotificationItem {
  id: string;
  volunteerId: string;
  title: string;
  content: string;
  date: string;
  isRead: boolean;
  type: 'points' | 'badge' | 'campaign' | 'system';
}

// ─── CONSTANTS & CONFIGS ─────────────────────────────────────────────────────
const BADGE_DEFS: Record<string, { title: string; desc: string; icon: any; color: string; bg: string }> = {
  badge_first_donation: { title: "المنقذ الأول", desc: "تبرعت بالدم لأول مرة مع الفريق", icon: Droplet, color: "text-red-500 border-red-500/20", bg: "bg-red-500/10" },
  badge_5_campaigns: { title: "المساند الدائم", desc: "شاركت في 5 حملات تطوعية ميدانية", icon: Calendar, color: "text-blue-500 border-blue-500/20", bg: "bg-blue-500/10" },
  badge_life_line: { title: "شريان الحياة", desc: "تبرعت بالدم 3 مرات أو أكثر", icon: Heart, color: "text-rose-500 border-rose-500/20", bg: "bg-rose-500/10" },
  badge_organizer: { title: "قائد الميدان", desc: "ساعدت في تنظيم حملة واحدة على الأقل", icon: Shield, color: "text-amber-500 border-amber-500/20", bg: "bg-amber-500/10" },
  badge_streak: { title: "شعلة النشاط", desc: "حافظت على تفاعل متتالي لأكثر من 5 أيام", icon: Flame, color: "text-orange-500 border-orange-500/20", bg: "bg-orange-500/10" },
  badge_volunteer_month: { title: "متطوع الشهر", desc: "حصلت على لقب متطوع الشهر لتميزك الاستثنائي", icon: Trophy, color: "text-yellow-500 border-yellow-500/20", bg: "bg-yellow-500/10" },
};

const LEVEL_DEFS = [
  { level: 1, name: "متطوع مبادر", minPoints: 0, maxPoints: 99, title: "مبتدئ" },
  { level: 2, name: "سفير العطاء", minPoints: 100, maxPoints: 299, title: "نشط" },
  { level: 3, name: "بطل ومن أحياها", minPoints: 300, maxPoints: 599, title: "قدير" },
  { level: 4, name: "منقذ الأرواح", minPoints: 600, maxPoints: 999, title: "خبير" },
  { level: 5, name: "نجم الإنسانية الكوني", minPoints: 1000, maxPoints: 99999, title: "أسطوري" },
];

const MOTIVATIONAL_QUOTES = [
  "وَمَنْ أَحْيَاهَا فَكَأَنَّمَا أَحْيَا النَّاسَ جَمِيعًا ❤️",
  "تبرعك بقطرة دم قد يكون فارقاً بين الحياة والموت لأخيك 🩸",
  "التطوع ليس مجرد عمل بل هو حياة تنبض بالعطاء والرحمة ✨",
  "أبطال ومن أحياها يصنعون الأمل في قلوب المئات يومياً 🌟",
  "كل كيس دم تتبرع به قادر على إنقاذ حياة 3 أشخاص! 🏥",
  "استمر في مشاركاتك، فبكل خطوة تخطوها تبني مجتمعاً ينبض بالصحة والتعاون 🤝"
];

// No seed data — system starts fresh
const INITIAL_VOLUNTEERS: Volunteer[] = [];
const INITIAL_CAMPAIGNS: Campaign[] = [];
const INITIAL_LOGS: PointsLog[] = [];

// ─── SUPER ADMIN ─────────────────────────────────────────────────────────────
const SUPER_ADMIN_EMAIL = "dr.mahmoud.elhenawy@gmail.com";
const SUPER_ADMIN_PASSWORD = "waman2024admin"; // يمكن تغييرها لاحقاً

// ─── BEEP SYNTHESIZER ────────────────────────────────────────────────────────
const playScanBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const osc1 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    
    osc1.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.2);
  } catch (e) {
    console.warn("AudioContext error: ", e);
  }
};

// ─── QR PRINT UTILITY ────────────────────────────────────────────────────────
const printQRCode = (qrUrl: string, campaignTitle: string, qrType: string, points: number) => {
  const typeLabels: Record<string, string> = {
    attendance: "🎟️ حضور الحملة",
    donation: "🩸 تبرع بالدم",
    organize: "👑 تنظيم وإشراف"
  };
  const typeLabel = typeLabels[qrType] || qrType;

  const printWindow = window.open('', '_blank', 'width=600,height=700');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <title>QR - ${campaignTitle}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .card { border: 3px solid #dc2626; border-radius: 24px; padding: 32px; text-align: center; max-width: 400px; width: 90%; }
        .logo { width: 48px; height: 48px; background: linear-gradient(135deg, #dc2626, #9f1239); border-radius: 14px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
        h1 { font-size: 20px; color: #111; font-weight: 900; margin-bottom: 6px; }
        .badge { display: inline-block; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 4px 14px; border-radius: 999px; font-size: 13px; font-weight: 700; margin-bottom: 16px; }
        .qr-img { width: 240px; height: 240px; border: 4px solid #f1f5f9; border-radius: 16px; margin: 0 auto 16px; display: block; }
        .points { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; margin-bottom: 12px; }
        .instructions { background: #fafafa; border: 1px solid #e5e7eb; padding: 12px; border-radius: 12px; font-size: 11px; color: #6b7280; line-height: 1.8; }
        .footer { margin-top: 18px; font-size: 10px; color: #9ca3af; }
        @media print {
          body { background: white; }
          .card { border-color: #000; }
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">🩸</div>
        <h1>ومن أحياها</h1>
        <div class="badge">${typeLabel}</div>
        <p style="font-size:12px;color:#6b7280;margin-bottom:16px;">${campaignTitle}</p>
        <img class="qr-img" src="${qrUrl}" alt="QR Code" />
        <div class="points">✨ +${points} نقطة عند المسح الناجح</div>
        <div class="instructions">
          📱 وجّه كاميرا هاتفك نحو الرمز<br/>
          ✅ سيتم تسجيل نقاطك تلقائياً<br/>
          🔒 كل رمز يُستخدم مرة واحدة فقط لكل متطوع
        </div>
        <div class="footer">بوابة أبطال ومن أحياها · ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
      <script>window.onload = function(){ window.print(); }<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

interface WamanAhyaahaVolunteersProps {
  onBack: () => void;
  currentUserEmail?: string;
  currentUserName?: string;
}

export default function WamanAhyaahaVolunteers({ onBack, currentUserEmail, currentUserName }: WamanAhyaahaVolunteersProps) {
  // ─── STATE MANAGEMENT ──────────────────────────────────────────────────────
  const [volunteers, setVolunteers] = useState<Volunteer[]>(() => {
    const saved = localStorage.getItem("waman_volunteers_list");
    return saved ? JSON.parse(saved) : INITIAL_VOLUNTEERS;
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const saved = localStorage.getItem("waman_campaigns_list");
    return saved ? JSON.parse(saved) : INITIAL_CAMPAIGNS;
  });

  const [pointsLogs, setPointsLogs] = useState<PointsLog[]>(() => {
    const saved = localStorage.getItem("waman_points_log");
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Current logged in volunteer (Mock auth)
  const [loggedVolunteer, setLoggedVolunteer] = useState<Volunteer | null>(() => {
    const saved = localStorage.getItem("waman_logged_volunteer");
    if (saved) return JSON.parse(saved);
    const mahmoud = INITIAL_VOLUNTEERS.find(v => v.uid === "vol_1");
    if (mahmoud) {
      localStorage.setItem("waman_logged_volunteer", JSON.stringify(mahmoud));
      return mahmoud;
    }
    return null;
  });

  const [currentTab, setCurrentTab] = useState<'home' | 'campaigns' | 'ranking' | 'profile' | 'scan' | 'achievements' | 'admin' | 'notifications' | 'campaign_details'>('home');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['home']);

  // Admin section sub-states
  const [adminPointsForm, setAdminPointsForm] = useState({ volunteerId: "", points: 10, type: "bonus" as any, description: "" });
  const [adminCampaignForm, setAdminCampaignForm] = useState({ title: "", description: "", date: "", time: "", location: "", volunteersRequired: 10, pointsAttendance: 50, pointsDonation: 100, pointsOrganize: 150 });
  const [adminSelectedCampaignQR, setAdminSelectedCampaignQR] = useState<string>("");
  const [adminQRType, setAdminQRType] = useState<'attendance' | 'donation' | 'organize'>('attendance');
  const [adminQRActive, setAdminQRActive] = useState(true);
  const [adminQRCustomPoints, setAdminQRCustomPoints] = useState<number>(0);
  const [qrFullscreen, setQrFullscreen] = useState(false);

  // Scanner states
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [scanResultDetails, setScanResultDetails] = useState<any>(null);
  const [simulatedCode, setSimulatedCode] = useState<string>("");
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Search/Filters states
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'upcoming' | 'active' | 'completed'>('all');
  const [searchVolunteerText, setSearchVolunteerText] = useState("");

  const [quoteOfTheDay, setQuoteOfTheDay] = useState(MOTIVATIONAL_QUOTES[0]);
  const [cloudReady, setCloudReady] = useState(false);

  // Dark/Light mode
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("waman_dark_mode");
    return saved !== null ? saved === 'true' : true;
  });

  // Persist dark mode
  const toggleDarkMode = () => {
    setIsDark(prev => {
      localStorage.setItem("waman_dark_mode", String(!prev));
      return !prev;
    });
  };

  // Auth states
  const [loginPhone, setLoginPhone] = useState("");
  const [loginName, setLoginName] = useState("");
  const [registerBloodType, setRegisterBloodType] = useState("O+");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginMode, setLoginMode] = useState<'phone' | 'email'>('phone');
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Gamification signup states
  const [wantsPoints, setWantsPoints] = useState<boolean | null>(null); // null = not chosen yet
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Handle deep link simulation + prefill from guest form
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrToken = params.get("qr_code_token");
    if (qrToken && loggedVolunteer) {
      processQRToken(qrToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    const rand = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    setQuoteOfTheDay(MOTIVATIONAL_QUOTES[rand]);

    // Check if opened from guest donor form → prefill & open register mode
    const prefillRaw = localStorage.getItem('waman_prefill_volunteer');
    if (prefillRaw) {
      try {
        const prefill = JSON.parse(prefillRaw) as {
          name: string; phone: string; bloodType: string;
          email?: string; password?: string; wantsPoints?: boolean;
        };
        setLoginName(prefill.name || '');
        setLoginPhone(prefill.phone || '');
        setRegisterBloodType(prefill.bloodType || 'O+');
        setIsRegisterMode(true);

        // If email+pass were collected in modal → pre-fill and mark wantsPoints
        if (prefill.email) setRegEmail(prefill.email);
        if (prefill.password) setRegPassword(prefill.password);
        if (prefill.password) setRegConfirmPassword(prefill.password);
        if (prefill.wantsPoints === true) setWantsPoints(true);

        localStorage.removeItem('waman_prefill_volunteer');
      } catch {}
    }
  }, []);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem("waman_volunteers_list", JSON.stringify(volunteers));
  }, [volunteers]);

  useEffect(() => {
    localStorage.setItem("waman_campaigns_list", JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    localStorage.setItem("waman_points_log", JSON.stringify(pointsLogs));
  }, [pointsLogs]);

  useEffect(() => {
    if (!adminSelectedCampaignQR) return;
    const camp = campaigns.find(c => c.id === adminSelectedCampaignQR);
    const savedSettings = camp?.qrSettings?.[adminQRType];
    setAdminQRActive(savedSettings?.active ?? false);
    setAdminQRCustomPoints(savedSettings?.points || 0);
  }, [adminSelectedCampaignQR, adminQRType, campaigns]);

  useEffect(() => {
    if (currentTab !== 'scan') stopCameraScan();
    return () => stopCameraScan();
  }, [currentTab]);

  useEffect(() => {
    if (loggedVolunteer) {
      localStorage.setItem("waman_logged_volunteer", JSON.stringify(loggedVolunteer));
      setVolunteers(prev => prev.map(v => v.uid === loggedVolunteer.uid ? loggedVolunteer : v));
      const userNotifs: NotificationItem[] = [
        { id: "n_1", volunteerId: loggedVolunteer.uid, title: "مرحباً بك في ومن أحياها! 🩸", content: "بوابتك التفاعلية جاهزة. شارك في الحملات لتكسب الأوسمة وتصعد الصدارة!", date: new Date().toISOString().split('T')[0], isRead: false, type: "system" }
      ];
      if (loggedVolunteer.points > 500) {
        userNotifs.push({ id: "n_2", volunteerId: loggedVolunteer.uid, title: "أنت بطل رائع! 🏆", content: "تجاوزت الـ 500 نقطة. استمر في العطاء!", date: new Date().toISOString().split('T')[0], isRead: false, type: "points" });
      }
      setNotifications(userNotifs);
    } else {
      localStorage.removeItem("waman_logged_volunteer");
    }
  }, [loggedVolunteer]);

  useEffect(() => {
    const unsubVolunteers = onSnapshot(collection(db, "waman_volunteers"), (snapshot) => {
      const cloudVolunteers = snapshot.docs.map((volunteerDoc) => ({ uid: volunteerDoc.id, ...volunteerDoc.data() })) as Volunteer[];
      setVolunteers(cloudVolunteers);
      setLoggedVolunteer((current) => {
        if (!current) return current;
        return cloudVolunteers.find((volunteer) => volunteer.uid === current.uid) || current;
      });
      setCloudReady(true);
    }, (error) => {
      console.error("Waman volunteers listener error:", error);
      setCloudReady(true);
    });

    const unsubCampaigns = onSnapshot(query(collection(db, "waman_campaigns"), orderBy("createdAt", "desc")), (snapshot) => {
      setCampaigns(snapshot.docs.map((campaignDoc) => ({ id: campaignDoc.id, ...campaignDoc.data() })) as Campaign[]);
    }, (error) => console.error("Waman campaigns listener error:", error));

    const unsubLogs = onSnapshot(query(collection(db, "waman_points_logs"), orderBy("createdAt", "desc")), (snapshot) => {
      setPointsLogs(snapshot.docs.map((logDoc) => ({ id: logDoc.id, ...logDoc.data() })) as PointsLog[]);
    }, (error) => console.error("Waman points logs listener error:", error));

    return () => {
      unsubVolunteers();
      unsubCampaigns();
      unsubLogs();
    };
  }, []);

  // Navigate with history keeping
  const navigateTo = (tab: typeof currentTab) => {
    setNavigationHistory(prev => [...prev, tab]);
    setCurrentTab(tab);
  };

  const saveVolunteerToCloud = async (volunteer: Volunteer) => {
    await setDoc(doc(db, "waman_volunteers", volunteer.uid), {
      ...volunteer,
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  const saveCampaignToCloud = async (campaign: Campaign) => {
    await setDoc(doc(db, "waman_campaigns", campaign.id), {
      ...campaign,
      updatedAt: serverTimestamp(),
      createdAt: (campaign as any).createdAt || serverTimestamp()
    }, { merge: true });
  };

  const savePointsLogToCloud = async (log: PointsLog) => {
    await setDoc(doc(db, "waman_points_logs", log.id), {
      ...log,
      createdAt: serverTimestamp()
    });
  };

  const navigateBack = () => {
    if (navigationHistory.length > 1) {
      const copy = [...navigationHistory];
      copy.pop();
      const prev = copy[copy.length - 1];
      setNavigationHistory(copy);
      setCurrentTab(prev as any);
    } else {
      setCurrentTab('home');
    }
  };

  // ─── GAME LOGIC HELPERS ────────────────────────────────────────────────────
  const getLevelInfo = (points: number) => {
    const levelObj = LEVEL_DEFS.find(l => points >= l.minPoints && points <= l.maxPoints) || LEVEL_DEFS[0];
    const nextLevelObj = LEVEL_DEFS.find(l => l.level === levelObj.level + 1);
    let progressPercentage = 100;
    if (nextLevelObj) {
      const range = nextLevelObj.minPoints - levelObj.minPoints;
      const progress = points - levelObj.minPoints;
      progressPercentage = Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
    }
    return {
      level: levelObj.level,
      name: levelObj.name,
      title: levelObj.title,
      minPoints: levelObj.minPoints,
      maxPoints: nextLevelObj ? nextLevelObj.minPoints : levelObj.maxPoints,
      progress: progressPercentage
    };
  };

  // ─── AUTHENTICATION WORKFLOWS ──────────────────────────────────────────────
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMode === 'phone') {
      if (!loginPhone.trim()) { toast.error("الرجاء إدخال رقم الهاتف"); return; }
      const found = volunteers.find(v => v.phone === loginPhone.trim());
      if (found) { _loginUser(found); }
      else { toast.error("رقم الهاتف غير مسجل. يرجى إنشاء حساب جديد."); setIsRegisterMode(true); }
    } else {
      if (!loginEmail.trim() || !loginPassword.trim()) { toast.error("الرجاء إدخال البريد وكلمة المرور"); return; }
      const emailLower = loginEmail.trim().toLowerCase();

      // ── Super Admin bypass ──
      if (emailLower === SUPER_ADMIN_EMAIL) {
        if (loginPassword.trim() !== SUPER_ADMIN_PASSWORD) {
          toast.error("كلمة مرور الإدارة غير صحيحة");
          return;
        }
        // Find or auto-create admin account
        const existingAdmin = volunteers.find(v => v.email === SUPER_ADMIN_EMAIL);
        if (existingAdmin) {
          _loginUser({ ...existingAdmin, role: 'admin' });
        } else {
          const adminVol: Volunteer = {
            uid: 'admin_super',
            name: 'د. محمود الهناوي',
            phone: '01000000000',
            bloodType: 'O+',
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=admin_mahmoud`,
            points: 9999,
            campaignsCount: 0,
            donationsCount: 0,
            level: 5,
            streak: 1,
            lastActive: new Date().toISOString().split('T')[0],
            badges: Object.keys(BADGE_DEFS),
            role: 'admin',
            wantsPoints: true,
            email: SUPER_ADMIN_EMAIL,
            password: SUPER_ADMIN_PASSWORD,
          };
          setVolunteers(prev => {
            const exists = prev.find(v => v.uid === 'admin_super');
            return exists ? prev : [adminVol, ...prev];
          });
          saveVolunteerToCloud(adminVol).catch((error) => console.error("Unable to save Waman admin:", error));
          _loginUser(adminVol);
        }
        return;
      }

      // ── Regular email login ──
      const found = volunteers.find(v => v.email === emailLower && v.password === loginPassword.trim());
      if (found) { _loginUser(found); }
      else { toast.error("البريد الإلكتروني أو كلمة المرور غير صحيحة"); }
    }
  };

  const _loginUser = (found: Volunteer) => {
    let updatedStreak = found.streak;
    const todayStr = new Date().toISOString().split('T')[0];
    if (found.lastActive && found.lastActive !== todayStr) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (found.lastActive === yesterdayStr) {
        updatedStreak += 1;
        toast.success(`أنت في تقدم مستمر! 🔥 الـ Streak زاد ليصبح ${updatedStreak} أيام!`);
      } else {
        updatedStreak = 1;
      }
    } else if (!found.lastActive) {
      updatedStreak = 1;
    }

    const updated = { ...found, streak: updatedStreak, lastActive: todayStr };
    setLoggedVolunteer(updated);
    toast.success(`مرحباً بعودتك يا ${found.name} 👋`);
    // Navigate admin directly to admin panel, others to home
    navigateTo(updated.role === 'admin' ? 'admin' : 'home');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginPhone.trim()) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const exist = volunteers.some(v => v.phone === loginPhone.trim());
    if (exist) { toast.error("رقم الهاتف هذا مسجل بالفعل!"); return; }

    // Validate gamification fields if opted in
    let volunteerEmail: string | undefined;
    let volunteerPassword: string | undefined;

    if (wantsPoints) {
      if (!regEmail.trim() || !regPassword.trim() || !regConfirmPassword.trim()) {
        toast.error("يرجى ملء جميع حقول نظام النقاط");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(regEmail.trim())) {
        toast.error("يرجى إدخال بريد إلكتروني صحيح");
        return;
      }
      if (volunteers.some(v => v.email === regEmail.trim().toLowerCase())) {
        toast.error("البريد الإلكتروني مسجل بالفعل! اختر بريداً آخر.");
        return;
      }
      if (regPassword.trim().length < 6) {
        toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
        return;
      }
      if (regPassword.trim() !== regConfirmPassword.trim()) {
        toast.error("كلمة المرور وتأكيدها غير متطابقتين");
        return;
      }
      volunteerEmail = regEmail.trim().toLowerCase();
      volunteerPassword = regPassword.trim();
    }

    const newVol: Volunteer = {
      uid: `vol_${Date.now()}`,
      name: loginName.trim(),
      phone: loginPhone.trim(),
      bloodType: registerBloodType,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(loginName)}`,
      points: wantsPoints ? 50 : 0,
      campaignsCount: 0,
      donationsCount: 0,
      level: 1,
      streak: 1,
      lastActive: new Date().toISOString().split('T')[0],
      badges: [],
      role: 'volunteer',
      wantsPoints: !!wantsPoints,
      email: volunteerEmail,
      password: volunteerPassword,
    };

    setVolunteers(prev => [...prev, newVol]);
    await saveVolunteerToCloud(newVol);

    if (wantsPoints) {
      const welcomeLog: PointsLog = {
        id: `log_${Date.now()}`,
        volunteerId: newVol.uid,
        volunteerName: newVol.name,
        campaignId: "",
        campaignTitle: "الانضمام لبوابة المتطوعين",
        points: 50,
        type: "bonus",
        date: new Date().toISOString().split('T')[0],
        description: "هدية ترحيبية بمناسبة انضمامك لنظام النقاط 🎉"
      };
      setPointsLogs(prev => [welcomeLog, ...prev]);
      await savePointsLogToCloud(welcomeLog);
      toast.success("تم إنشاء حسابك بنجاح وحصلت على 50 نقطة ترحيبية! 🎉");
    } else {
      toast.success("تم تسجيلك كمتبرع بنجاح! شكراً لانضمامك 🙏");
    }

    setLoggedVolunteer(newVol);
    navigateTo('home');
  };

  const handleLogout = () => {
    setLoggedVolunteer(null);
    toast.success("تم تسجيل الخروج بنجاح. أراك قريباً!");
    setCurrentTab('home');
  };

  // ─── CAMPAIGN PARTICIPATION ────────────────────────────────────────────────
  const handleCampaignToggleParticipation = (campId: string) => {
    if (!loggedVolunteer) {
      toast.error("يرجى تسجيل الدخول أولاً لتتمكن من المشاركة!");
      setIsRegisterMode(false);
      navigateTo('home');
      return;
    }

    setCampaigns(prev => prev.map(camp => {
      if (camp.id === campId) {
        const isRegistered = camp.volunteersRegistered.includes(loggedVolunteer.uid);
        let updatedVolunteers = [...camp.volunteersRegistered];
        
        if (isRegistered) {
          updatedVolunteers = updatedVolunteers.filter(id => id !== loggedVolunteer.uid);
          toast.success("تم إلغاء تسجيل مشاركتك في الحملة.");
          setLoggedVolunteer(prevUser => {
            if (!prevUser) return null;
            return { ...prevUser, campaignsCount: Math.max(0, prevUser.campaignsCount - 1) };
          });
        } else {
          updatedVolunteers.push(loggedVolunteer.uid);
          toast.success("رائع! تم تسجيل اسمك للمشاركة في الحملة بنجاح. ننتظرك بكل حماس! 💪🩸");
          setLoggedVolunteer(prevUser => {
            if (!prevUser) return null;
            return { ...prevUser, campaignsCount: prevUser.campaignsCount + 1 };
          });
        }
        
        const updatedCampaign = { ...camp, volunteersRegistered: updatedVolunteers };
        saveCampaignToCloud(updatedCampaign).catch((error) => console.error("Unable to update campaign participation:", error));
        return updatedCampaign;
      }
      return camp;
    }));
  };

  // ─── ADMIN FUNCTIONS ───────────────────────────────────────────────────────
  const handleAdminAddPoints = (e: React.FormEvent) => {
    e.preventDefault();
    const { volunteerId, points, type, description } = adminPointsForm;
    if (!volunteerId || !points) {
      toast.error("يرجى اختيار المتطوع وتحديد النقاط");
      return;
    }

    const target = volunteers.find(v => v.uid === volunteerId);
    if (!target) return;

    const finalPoints = Number(points);
    const newPoints = Math.max(0, target.points + finalPoints);
    const lvlInfo = getLevelInfo(newPoints);

    const log: PointsLog = {
      id: `log_${Date.now()}`,
      volunteerId: target.uid,
      volunteerName: target.name,
      campaignId: "",
      campaignTitle: "تعديل إداري مباشر",
      points: finalPoints,
      type: type,
      date: new Date().toISOString().split('T')[0],
      description: description || (finalPoints >= 0 ? "نقاط إضافية مكافأة من الإدارة" : "خصم نقاط بموافقة المسؤولين")
    };

    let updatedTarget: Volunteer | null = null;
    setVolunteers(prev => prev.map(v => {
      if (v.uid === target.uid) {
        let badgesCopy = [...v.badges];
        if (type === 'organize' && !badgesCopy.includes('badge_organizer')) {
          badgesCopy.push('badge_organizer');
        }
        updatedTarget = { ...v, points: newPoints, level: lvlInfo.level, badges: badgesCopy };
        return updatedTarget;
      }
      return v;
    }));

    setPointsLogs(prev => [log, ...prev]);
    if (updatedTarget) saveVolunteerToCloud(updatedTarget).catch((error) => console.error("Unable to save volunteer points:", error));
    savePointsLogToCloud(log).catch((error) => console.error("Unable to save points log:", error));

    if (loggedVolunteer && loggedVolunteer.uid === target.uid) {
      let badgesCopy = [...loggedVolunteer.badges];
      if (type === 'organize' && !badgesCopy.includes('badge_organizer')) {
        badgesCopy.push('badge_organizer');
      }
      setLoggedVolunteer({ ...loggedVolunteer, points: newPoints, level: lvlInfo.level, badges: badgesCopy });
    }

    toast.success(`تم ${finalPoints >= 0 ? 'إضافة' : 'خصم'} ${Math.abs(finalPoints)} نقطة للمتطوع ${target.name} بنجاح!`);
    setAdminPointsForm({ volunteerId: "", points: 10, type: "bonus", description: "" });
  };

  const handleAdminAddCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    const f = adminCampaignForm;
    if (!f.title || !f.date || !f.location) {
      toast.error("يرجى ملء البيانات الأساسية للحملة");
      return;
    }

    const newCamp: Campaign = {
      id: `camp_${Date.now()}`,
      title: f.title,
      description: f.description || "لا يوجد وصف تفصيلي متوفر حالياً.",
      date: f.date,
      time: f.time || "طوال اليوم",
      location: f.location,
      volunteersRequired: Number(f.volunteersRequired),
      volunteersRegistered: [],
      status: 'active',
      pointsReward: {
        attendance: Number(f.pointsAttendance),
        donation: Number(f.pointsDonation),
        organize: Number(f.pointsOrganize)
      },
      qrSettings: {
        attendance: { active: false, points: Number(f.pointsAttendance) },
        donation: { active: false, points: Number(f.pointsDonation) },
        organize: { active: false, points: Number(f.pointsOrganize) }
      }
    };

    setCampaigns(prev => [newCamp, ...prev]);
    saveCampaignToCloud(newCamp).catch((error) => console.error("Unable to save Waman campaign:", error));
    toast.success("تم إنشاء الحملة بنجاح وهي متاحة الآن للتسجيل! 🚀");
    setAdminCampaignForm({
      title: "", description: "", date: "", time: "", location: "",
      volunteersRequired: 10, pointsAttendance: 50, pointsDonation: 100, pointsOrganize: 150
    });
  };

  // Generate Admin QR Code URL
  const getAdminQRUrl = (size = 250) => {
    if (!adminSelectedCampaignQR) return "";
    const deepLinkData = `WAMAN_QR_${adminQRType.toUpperCase()}_${adminSelectedCampaignQR}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(deepLinkData)}&color=ef4444&bgcolor=ffffff`;
  };

  const getAdminQRPoints = () => {
    const camp = campaigns.find(c => c.id === adminSelectedCampaignQR);
    if (!camp) return 50;
    const saved = camp.qrSettings?.[adminQRType]?.points;
    if (adminQRCustomPoints > 0) return adminQRCustomPoints;
    return saved || camp.pointsReward[adminQRType] || 50;
  };

  const getQRConfig = (campaign: Campaign, qrType: 'attendance' | 'donation' | 'organize') => {
    return campaign.qrSettings?.[qrType] || {
      active: false,
      points: campaign.pointsReward[qrType] || 50
    };
  };

  const saveSelectedQRSettings = (active = adminQRActive, points = getAdminQRPoints()) => {
    if (!adminSelectedCampaignQR) {
      toast.error("اختر الحملة أولاً");
      return;
    }

    setCampaigns(prev => prev.map(camp => {
      if (camp.id !== adminSelectedCampaignQR) return camp;
      const updatedCampaign = {
        ...camp,
        qrSettings: {
          ...(camp.qrSettings || {}),
          [adminQRType]: {
            active,
            points: Number(points) || camp.pointsReward[adminQRType] || 50
          }
        }
      };
      saveCampaignToCloud(updatedCampaign).catch((error) => console.error("Unable to save QR settings:", error));
      return updatedCampaign;
    }));
    toast.success(active ? "تم تفعيل QR لهذه الحملة" : "تم إيقاف QR لهذه الحملة");
  };

  const stopCameraScan = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach(track => track.stop());
      scanStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCameraScan = async () => {
    setCameraError("");
    setScanStatus('scanning');

    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    if (!BarcodeDetectorClass) {
      setCameraError("المتصفح الحالي لا يدعم قراءة QR بالكاميرا مباشرة. استخدم الرابط/الإدخال اليدوي بالأسفل.");
      setScanStatus('idle');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      scanStreamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector = new BarcodeDetectorClass({ formats: ["qr_code"] });

      const detect = async () => {
        if (!videoRef.current || !canvasRef.current || scanStatus === 'success') return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const codes = await detector.detect(canvas);
            const rawValue = codes?.[0]?.rawValue;
            if (rawValue) {
              stopCameraScan();
              const token = rawValue.includes("qr_code_token=")
                ? new URL(rawValue).searchParams.get("qr_code_token") || rawValue
                : rawValue;
              processQRToken(token);
              return;
            }
          }
        }
        scanLoopRef.current = requestAnimationFrame(detect);
      };

      scanLoopRef.current = requestAnimationFrame(detect);
    } catch (error) {
      console.error(error);
      setCameraError("تعذر فتح الكاميرا. تأكد من السماح للموقع باستخدام الكاميرا.");
      setScanStatus('idle');
      stopCameraScan();
    }
  };

  // ─── QR CODE PROCESSING ────────────────────────────────────────────────────
  const processQRToken = (token: string) => {
    if (!loggedVolunteer) {
      toast.error("يرجى تسجيل الدخول أولاً لتسجيل نقاط الـ QR!");
      return;
    }

    const parts = token.split("_");
    if (parts[0] !== "WAMAN" || parts[1] !== "QR") {
      setScanStatus('error');
      toast.error("رمز الـ QR غير صالح أو غير معتمد من قبل إدارة ومن أحياها.");
      return;
    }

    const type = parts[2].toLowerCase() as 'attendance' | 'donation' | 'organize';
    const campId = parts.slice(3).join("_");
    const campaign = campaigns.find(c => c.id === campId);
    const qrConfig = campaign ? getQRConfig(campaign, type) : null;
    
    if (!campaign) {
      setScanStatus('error');
      toast.error("الحملة المرتبطة بهذا الرمز لم تعد متوفرة.");
      return;
    }

    if (campaign && (campaign.status !== 'active' || !qrConfig?.active)) {
      setScanStatus('error');
      toast.error("رمز الـ QR غير مفعّل حالياً. يتم تشغيله فقط وقت الحملات من صفحة الإدارة.");
      return;
    }

    let rewardPoints = 50;
    let typeNameAr = "حضور حملة";
    let typeLog: PointsLog['type'] = 'attendance';

    if (type === 'donation') {
      rewardPoints = qrConfig?.points || campaign.pointsReward.donation || 100;
      typeNameAr = "تبرع بالدم";
      typeLog = 'donation';
    } else if (type === 'organize') {
      rewardPoints = qrConfig?.points || campaign.pointsReward.organize || 150;
      typeNameAr = "تنظيم وإشراف";
      typeLog = 'organize';
    } else {
      rewardPoints = qrConfig?.points || campaign.pointsReward.attendance || 50;
    }

    const alreadyClaimed = pointsLogs.some(log => 
      log.volunteerId === loggedVolunteer.uid && 
      log.campaignId === campaign.id && 
      log.type === typeLog
    );

    if (alreadyClaimed) {
      setScanStatus('error');
      toast.error(`لقد قمت بالفعل بتسجيل نقاط (${typeNameAr}) لهذه الحملة سابقاً!`);
      return;
    }

    playScanBeep();
    const newTotalPoints = loggedVolunteer.points + rewardPoints;
    const levelInfo = getLevelInfo(newTotalPoints);
    const todayStr = new Date().toISOString().split('T')[0];

    const newLog: PointsLog = {
      id: `log_${Date.now()}`,
      volunteerId: loggedVolunteer.uid,
      volunteerName: loggedVolunteer.name,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      points: rewardPoints,
      type: typeLog,
      date: todayStr,
      description: `تسجيل تلقائي عبر QR: ${typeNameAr} في ${campaign.title}`
    };

    let updatedBadges = [...loggedVolunteer.badges];
    let showBadgeToast = false;
    let badgeGrantedTitle = "";

    if (typeLog === 'donation' && !updatedBadges.includes('badge_first_donation')) {
      updatedBadges.push('badge_first_donation');
      showBadgeToast = true;
      badgeGrantedTitle = BADGE_DEFS.badge_first_donation.title;
    }

    const newDonationsCount = loggedVolunteer.donationsCount + (typeLog === 'donation' ? 1 : 0);
    if (newDonationsCount >= 3 && !updatedBadges.includes('badge_life_line')) {
      updatedBadges.push('badge_life_line');
      showBadgeToast = true;
      badgeGrantedTitle = BADGE_DEFS.badge_life_line.title;
    }

    const newCampaignsCount = loggedVolunteer.campaignsCount + (typeLog === 'attendance' || typeLog === 'organize' ? 1 : 0);
    if (newCampaignsCount >= 5 && !updatedBadges.includes('badge_5_campaigns')) {
      updatedBadges.push('badge_5_campaigns');
      showBadgeToast = true;
      badgeGrantedTitle = BADGE_DEFS.badge_5_campaigns.title;
    }

    if (typeLog === 'organize' && !updatedBadges.includes('badge_organizer')) {
      updatedBadges.push('badge_organizer');
      showBadgeToast = true;
      badgeGrantedTitle = BADGE_DEFS.badge_organizer.title;
    }

    // ──── KEY: Update lastDonation if donation type ────
    const updatedUser: Volunteer = {
      ...loggedVolunteer,
      points: newTotalPoints,
      level: levelInfo.level,
      donationsCount: newDonationsCount,
      campaignsCount: newCampaignsCount,
      badges: updatedBadges,
      ...(typeLog === 'donation' ? { lastDonation: todayStr } : {})
    };

    setLoggedVolunteer(updatedUser);
    setPointsLogs(prev => [newLog, ...prev]);
    saveVolunteerToCloud(updatedUser).catch((error) => console.error("Unable to save QR points:", error));
    savePointsLogToCloud(newLog).catch((error) => console.error("Unable to save QR points log:", error));

    if (!campaign.volunteersRegistered.includes(loggedVolunteer.uid)) {
      const updatedCampaign = {
        ...campaign,
        volunteersRegistered: [...campaign.volunteersRegistered, loggedVolunteer.uid]
      };
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? {
        ...c,
        volunteersRegistered: [...c.volunteersRegistered, loggedVolunteer.uid]
      } : c));
      saveCampaignToCloud(updatedCampaign).catch((error) => console.error("Unable to save QR campaign registration:", error));
    }

    setScanResultDetails({
      pointsGained: rewardPoints,
      campaignTitle: campaign.title,
      typeName: typeNameAr,
      newTotal: newTotalPoints,
      levelName: levelInfo.name,
      badgeGranted: showBadgeToast ? badgeGrantedTitle : null,
      isDonation: typeLog === 'donation',
      donationDate: todayStr
    });

    setScanStatus('success');
    toast.success(`تم مسح الرمز بنجاح! حصلت على +${rewardPoints} نقطة 🩸🎉`);
  };

  const handleSimulatedScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedCode) return;
    processQRToken(simulatedCode);
    setSimulatedCode("");
  };

  // Top Volunteers List sorted by points
  const leaderboardVolunteers = useMemo(() => {
    return [...volunteers].sort((a, b) => b.points - a.points);
  }, [volunteers]);

  const starVolunteer = useMemo(() => {
    return volunteers.find(v => v.uid === "vol_3") || volunteers[0];
  }, [volunteers]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (campaignFilter === 'all') return true;
      return c.status === campaignFilter;
    });
  }, [campaigns, campaignFilter]);

  const currentUserLogs = useMemo(() => {
    if (!loggedVolunteer) return [];
    return pointsLogs.filter(log => log.volunteerId === loggedVolunteer.uid);
  }, [pointsLogs, loggedVolunteer]);

  const getProgressBarColor = (lvl: number) => {
    switch (lvl) {
      case 1: return "bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
      case 2: return "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-[0_0_10px_rgba(59,130,246,0.5)]";
      case 3: return "bg-gradient-to-r from-purple-500 to-fuchsia-600 shadow-[0_0_10px_rgba(168,85,247,0.5)]";
      case 4: return "bg-gradient-to-r from-amber-500 to-orange-600 shadow-[0_0_10px_rgba(245,158,11,0.5)]";
      default: return "bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 shadow-[0_0_12px_rgba(234,179,8,0.7)] animate-pulse";
    }
  };

  // ─── QR FULLSCREEN MODAL ─────────────────────────────────────────────────
  const QRFullscreenModal = () => {
    if (!qrFullscreen || !adminSelectedCampaignQR) return null;
    const camp = campaigns.find(c => c.id === adminSelectedCampaignQR);
    const qrUrl = getAdminQRUrl(400);
    const typeLabels: Record<string, string> = {
      attendance: "🎟️ حضور الحملة",
      donation: "🩸 تبرع بالدم",
      organize: "👑 تنظيم وإشراف"
    };

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] bg-black/95 flex flex-col items-center justify-center p-6"
          onClick={() => setQrFullscreen(false)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 flex flex-col items-center gap-4 max-w-sm w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-700 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">
              🩸
            </div>
            <div className="text-center">
              <h2 className="text-slate-900 font-black text-lg">ومن أحياها</h2>
              <p className="text-slate-500 text-sm font-bold mt-1">{typeLabels[adminQRType]}</p>
              {camp && <p className="text-slate-400 text-xs mt-1 leading-relaxed">{camp.title}</p>}
            </div>
            <img src={qrUrl} alt="QR" className="w-72 h-72 rounded-2xl border-4 border-slate-100" />
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm">
              ✨ +{getAdminQRPoints()} نقطة عند المسح
            </div>
            <div className="text-center text-xs text-slate-400 leading-relaxed">
              📱 وجّه الكاميرا نحو الرمز · ✅ النقاط تُضاف تلقائياً
            </div>
            <button
              onClick={() => setQrFullscreen(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm transition"
            >
              إغلاق ✕
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // ─── SIDEBAR NAV ITEMS ─────────────────────────────────────────────────────
  const navItems = [
    { id: 'home', label: 'الرئيسية', icon: User },
    { id: 'campaigns', label: 'الحملات', icon: Calendar },
    { id: 'scan', label: 'مسح QR', icon: QrCode, highlight: true },
    { id: 'ranking', label: 'لوحة الشرف', icon: Trophy },
    { id: 'achievements', label: 'الأوسمة', icon: Award },
    ...(loggedVolunteer?.role === 'admin' ? [{ id: 'admin', label: 'الإدارة', icon: Shield, adminOnly: true }] : []),
    { id: 'notifications', label: 'الإشعارات', icon: Bell },
    { id: 'profile', label: 'الملف الشخصي', icon: User },
  ] as const;

  // Theme classes
  const themeBase = isDark
    ? 'bg-[#090D1A] text-slate-100'
    : 'bg-slate-100 text-slate-900';
  const themeSidebar = isDark
    ? 'bg-[#0F172A] border-slate-800/60'
    : 'bg-white border-slate-200';
  const themeHeader = isDark
    ? 'bg-[#0F172A]/90 border-slate-800/60'
    : 'bg-white/90 border-slate-200';
  const themeNav = isDark
    ? 'bg-[#0F172A]/90 border-slate-800'
    : 'bg-white border-slate-200';
  const themeNavItem = (active: boolean) => active
    ? 'bg-red-600/15 text-red-500 font-black border-r-2 border-red-500'
    : isDark ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  const themeMain = isDark ? 'bg-[#090D1A]' : 'bg-slate-50';

  // Card-level theme tokens
  const themeCard = isDark ? 'bg-[#0F172A]/90 border-slate-800' : 'bg-white border-slate-200';
  const themeCard2 = isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200';
  const themeText = isDark ? 'text-white' : 'text-slate-900';
  const themeSubText = isDark ? 'text-slate-400' : 'text-slate-500';
  const themeBorder = isDark ? 'border-slate-800' : 'border-slate-200';
  const themeInput = isDark
    ? 'bg-slate-900 border-slate-800 focus:border-red-500 text-slate-100 placeholder-slate-600'
    : 'bg-slate-50 border-slate-300 focus:border-red-500 text-slate-900 placeholder-slate-400';
  const themeSection = isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-100 border-slate-200';

  return (
    <div
      className={`min-h-screen ${themeBase} font-sans select-none flex flex-col md:flex-row`}
      dir="rtl"
    >
      <Toaster position="top-center" reverseOrder={false} />
      <QRFullscreenModal />

      {/* ══════════════════════════════════════════════════════════════
          SIDEBAR – Desktop/Tablet only (md+)
      ══════════════════════════════════════════════════════════════ */}
      {loggedVolunteer && (
        <aside className={`hidden md:flex flex-col shrink-0 w-60 border-l sticky top-0 h-screen overflow-y-auto ${themeSidebar}`}>
          {/* Sidebar Brand */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/30">
            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-rose-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30 shrink-0">
              <Activity size={18} className="text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-sm font-black leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>ومن أحياها</h1>
              <p className="text-[10px] text-red-500/80 font-bold">بوابة الأبطال</p>
            </div>
          </div>

          {/* Volunteer mini-card */}
          <div className={`mx-3 mt-4 p-3 rounded-2xl border flex items-center gap-2.5 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <img src={loggedVolunteer.avatarUrl} alt={loggedVolunteer.name} className="w-9 h-9 rounded-xl shrink-0" />
            <div className="min-w-0">
              <p className={`text-xs font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{loggedVolunteer.name.split(' ')[0]}</p>
              <span className="text-[9px] text-red-500 font-bold">{getLevelInfo(loggedVolunteer.points).name}</span>
            </div>
            <span className={`shrink-0 text-[9px] font-black ml-auto px-1.5 py-0.5 rounded-lg ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
              {loggedVolunteer.points} XP
            </span>
          </div>

          {/* Nav Links */}
          <nav className="flex flex-col gap-1 px-3 mt-4 flex-1">
            {([
              { id: 'home', label: 'الرئيسية', icon: User },
              { id: 'campaigns', label: 'الحملات', icon: Calendar },
              { id: 'scan', label: 'مسح QR الذكي', icon: QrCode, highlight: true },
              { id: 'ranking', label: 'لوحة الشرف', icon: Trophy },
              { id: 'achievements', label: 'الأوسمة', icon: Award },
              ...(loggedVolunteer.role === 'admin' ? [{ id: 'admin' as const, label: 'الإدارة', icon: Shield }] : []),
              { id: 'notifications', label: 'الإشعارات', icon: Bell },
              { id: 'profile', label: 'الملف الشخصي', icon: User },
            ] as { id: typeof currentTab; label: string; icon: any; highlight?: boolean }[]).map(item => {
              const isActive = currentTab === item.id || (item.id === 'campaigns' && currentTab === 'campaign_details');
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition text-right w-full ${
                    item.highlight
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 mb-1'
                      : themeNavItem(isActive)
                  }`}
                >
                  <item.icon size={16} className={item.highlight ? 'text-white' : ''} />
                  <span className="flex-1 text-right">{item.label}</span>
                  {item.id === 'notifications' && (
                    <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom controls */}
          <div className={`px-3 pb-4 pt-3 border-t flex flex-col gap-2 ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
            {/* Dark / Light toggle */}
            <button
              onClick={toggleDarkMode}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition w-full ${isDark ? 'bg-slate-800/60 hover:bg-slate-700 text-yellow-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
            >
              {isDark ? <Star size={16} className="text-yellow-400" /> : <Activity size={16} className="text-slate-500" />}
              {isDark ? 'الوضع النهاري ☀️' : 'الوضع الليلي 🌙'}
            </button>

            {/* Back to blood bank */}
            <button
              onClick={onBack}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition w-full ${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
            >
              <ArrowRight size={14} />
              العودة لبنك الدم
            </button>
          </div>
        </aside>
      )}

      {/* ══════════════════════════════════════════════════════════════
          RIGHT SIDE: Header (mobile/tablet) + Content
      ══════════════════════════════════════════════════════════════ */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-screen ${themeMain}`}>

      {/* ─── MOBILE/TABLET HEADER (hidden on sidebar desktop when logged in) ── */}
      <header className={`w-full backdrop-blur-xl border-b px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md ${
        loggedVolunteer ? 'md:hidden' : ''
      } ${themeHeader}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`p-2 rounded-xl transition ${isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
            title="العودة لبنك الدم"
          >
            <ArrowRight size={18} />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-rose-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
              <Activity size={18} className="text-white animate-pulse" />
            </div>
            <div>
              <h1 className={`text-sm font-black leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>ومن أحياها</h1>
              <p className="text-[10px] text-red-500/80 font-bold tracking-wider">بوابة الأبطال المتطوعين</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dark/Light toggle button – header */}
          <button
            onClick={toggleDarkMode}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-yellow-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
            title="تبديل المظهر"
          >
            {isDark ? <Star size={16} /> : <Activity size={16} />}
          </button>

          {loggedVolunteer && (
            <>
              <button
                onClick={() => navigateTo('notifications')}
                className={`w-9 h-9 rounded-xl flex items-center justify-center relative transition ${isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
              >
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {loggedVolunteer.role === 'admin' && (
                <button
                  onClick={() => navigateTo('admin')}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${currentTab === 'admin' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : isDark ? 'bg-slate-800/80 hover:bg-slate-700 text-yellow-500' : 'bg-slate-100 hover:bg-slate-200 text-yellow-600'}`}
                >
                  <Shield size={18} />
                </button>
              )}
            </>
          )}

          {!loggedVolunteer ? (
            <button
              onClick={() => navigateTo('home')}
              className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-md active:scale-95 transition"
            >
              <Lock size={12} /> دخول
            </button>
          ) : (
            <button
              onClick={() => navigateTo('profile')}
              className={`flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-xl border transition ${isDark ? 'bg-slate-800/85 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
            >
              <img src={loggedVolunteer.avatarUrl} alt={loggedVolunteer.name} className="w-7 h-7 rounded-lg" />
              <span className={`text-[11px] font-black hidden xs:inline max-w-[80px] truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {loggedVolunteer.name.split(' ')[0]}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* ─── MAIN CONTENT CONTAINER ─────────────────────────── */}
      <main className={`flex-1 w-full px-4 md:px-8 py-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-28 md:pb-8 ${!loggedVolunteer ? 'max-w-lg mx-auto' : ''}`}>
        
        <AnimatePresence mode="wait">
          
          {/* 1. MOCK LOGIN & REGISTER */}
          {!loggedVolunteer && currentTab === 'home' && (
            <motion.div
              key="auth-gate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto w-full bg-[#0F172A]/90 border border-slate-800 rounded-3xl p-6 flex flex-col gap-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-red-500/20">
                  <Activity size={32} className="text-white" />
                </div>
                <h2 className="text-xl font-black text-white">انضم لأبطال ومن أحياها! 🩸🚀</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  سجل دخولك أو أنشئ حساباً جديداً للانضمام لحملات التبرع، كسب النقاط، فتح الأوسمة الممتعة، وتصدر الترتيب التنافسي!
                </p>
              </div>

              {/* Form Tab Toggles */}
              <div className="bg-slate-900/90 p-1.5 rounded-xl flex border border-slate-800">
                <button
                  onClick={() => setIsRegisterMode(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${!isRegisterMode ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  تسجيل الدخول
                </button>
                <button
                  onClick={() => setIsRegisterMode(true)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${isRegisterMode ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  حساب متطوع جديد
                </button>
              </div>

              {!isRegisterMode ? (
                // Login Form
                <div className="flex flex-col gap-4">
                  {/* Login method tabs */}
                  <div className="bg-slate-950/80 p-1 rounded-xl flex border border-slate-900 text-[11px]">
                    <button
                      onClick={() => setLoginMode('phone')}
                      className={`flex-1 py-1.5 rounded-lg font-bold transition ${loginMode === 'phone' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      📱 بالهاتف
                    </button>
                    <button
                      onClick={() => setLoginMode('email')}
                      className={`flex-1 py-1.5 rounded-lg font-bold transition ${loginMode === 'email' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      🏆 بالبريد
                    </button>
                  </div>

                  <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    {loginMode === 'phone' ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400 mr-1">رقم الهاتف المسجل *</label>
                        <input
                          type="tel"
                          className="w-full p-3.5 bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl text-sm text-slate-100 outline-none transition placeholder-slate-600"
                          placeholder="أدخل رقم الهاتف (مثال: 01012345678)"
                          value={loginPhone}
                          onChange={e => setLoginPhone(e.target.value)}
                          required
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-slate-400 mr-1">البريد الإلكتروني *</label>
                          <input
                            type="email"
                            className="w-full p-3.5 bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl text-sm text-slate-100 outline-none transition placeholder-slate-600"
                            placeholder="example@email.com"
                            value={loginEmail}
                            onChange={e => setLoginEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-slate-400 mr-1">كلمة المرور *</label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              className="w-full p-3.5 bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl text-sm text-slate-100 outline-none transition placeholder-slate-600 pl-10"
                              placeholder="كلمة المرور"
                              value={loginPassword}
                              onChange={e => setLoginPassword(e.target.value)}
                              required
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    <button type="submit"
                      className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/30 active:scale-95 transition flex items-center justify-center gap-2"
                    >
                      دخول البوابة <ChevronRight size={16} />
                    </button>
                  </form>
                </div>
              ) : (
                // Register Form
                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                  {/* Basic Info */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 mr-1">الاسم الكامل *</label>
                    <input type="text"
                      className="w-full p-3.5 bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl text-sm text-slate-100 outline-none transition placeholder-slate-600"
                      placeholder="الاسم باللغة العربية"
                      value={loginName} onChange={e => setLoginName(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 mr-1">رقم الهاتف *</label>
                    <input type="tel"
                      className="w-full p-3.5 bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl text-sm text-slate-100 outline-none transition placeholder-slate-600"
                      placeholder="01xxxxxxxxx"
                      value={loginPhone} onChange={e => setLoginPhone(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 mr-1">فصيلة الدم *</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {["O+","O-","A+","A-","B+","B-","AB+","AB-"].map(f => (
                        <button type="button" key={f} onClick={() => setRegisterBloodType(f)}
                          className={`py-2 rounded-lg text-xs font-black transition border ${registerBloodType === f ? 'bg-red-600 text-white border-transparent' : 'bg-slate-900 border-slate-800 text-slate-300'}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ═══ Points System Infographic Choice ═══ */}
                  {wantsPoints === null && (
                    <div className="flex flex-col gap-3">
                      <p className="text-xs font-black text-white text-center">هل تريد الانضمام لنظام النقاط والتحديات؟</p>

                      {/* Infographic card */}
                      <div className="bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent border border-yellow-500/20 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">🏆</span>
                          <span className="text-xs font-black text-yellow-400">فوائد نظام النقاط:</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="flex items-start gap-1.5 bg-slate-900/60 rounded-xl p-2.5">
                            <span className="text-base mt-0.5">🩸</span>
                            <div><p className="font-black text-white">نقاط XP</p><p className="text-slate-400">اكسب نقاط عند كل تبرع وحملة</p></div>
                          </div>
                          <div className="flex items-start gap-1.5 bg-slate-900/60 rounded-xl p-2.5">
                            <span className="text-base mt-0.5">🏅</span>
                            <div><p className="font-black text-white">أوسمة</p><p className="text-slate-400">افتح شارات تخصيصية</p></div>
                          </div>
                          <div className="flex items-start gap-1.5 bg-slate-900/60 rounded-xl p-2.5">
                            <span className="text-base mt-0.5">📊</span>
                            <div><p className="font-black text-white">صدارة</p><p className="text-slate-400">تنافس مع أبطال الفريق</p></div>
                          </div>
                          <div className="flex items-start gap-1.5 bg-slate-900/60 rounded-xl p-2.5">
                            <span className="text-base mt-0.5">⭐</span>
                            <div><p className="font-black text-white">مستويات</p><p className="text-slate-400">تطور وارتقي مع كل مشاركة</p></div>
                          </div>
                        </div>
                        <div className="text-center text-[9px] text-yellow-500/70 font-bold">✨ +50 نقطة ترحيبية عند التسجيل!</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setWantsPoints(true)}
                          className="py-3 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 text-slate-900 font-black text-sm shadow-lg shadow-yellow-500/30 hover:opacity-90 transition active:scale-95 flex flex-col items-center gap-1">
                          <span className="text-xl">🏆</span>
                          <span>نعم! أريد</span>
                        </button>
                        <button type="button" onClick={() => setWantsPoints(false)}
                          className="py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm hover:bg-slate-700 transition active:scale-95 flex flex-col items-center gap-1">
                          <span className="text-xl">🙏</span>
                          <span>لا شكراً</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* If opted IN: show email+password fields */}
                  <AnimatePresence>
                    {wantsPoints === true && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} className="flex flex-col gap-3 overflow-hidden">
                        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 flex items-center gap-2">
                          <Trophy size={14} className="text-yellow-500 shrink-0" />
                          <p className="text-[10px] text-yellow-400 font-bold">جميل! سجل بيانات دخولك لنظام النقاط</p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-slate-400 mr-1">البريد الإلكتروني *</label>
                          <input type="email"
                            className="w-full p-3 bg-slate-900 border border-yellow-500/30 focus:border-yellow-500 rounded-xl text-sm text-slate-100 outline-none transition placeholder-slate-600"
                            placeholder="example@email.com"
                            value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-slate-400 mr-1">كلمة المرور *</label>
                          <div className="relative">
                            <input type={showRegPassword ? "text" : "password"}
                              className="w-full p-3 bg-slate-900 border border-yellow-500/30 focus:border-yellow-500 rounded-xl text-sm text-slate-100 outline-none transition placeholder-slate-600 pl-10"
                              placeholder="6 أحرف على الأقل"
                              value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                            <button type="button" onClick={() => setShowRegPassword(!showRegPassword)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                              {showRegPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-slate-400 mr-1">تأكيد كلمة المرور *</label>
                          <div className="relative">
                            <input type={showRegConfirm ? "text" : "password"}
                              className={`w-full p-3 bg-slate-900 border rounded-xl text-sm text-slate-100 outline-none transition placeholder-slate-600 pl-10 ${
                                regConfirmPassword && regConfirmPassword !== regPassword ? 'border-red-500' : 'border-yellow-500/30 focus:border-yellow-500'
                              }`}
                              placeholder="أعد كتابة كلمة المرور"
                              value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} />
                            <button type="button" onClick={() => setShowRegConfirm(!showRegConfirm)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                              {showRegConfirm ? <EyeOff size={15}/> : <Eye size={15}/>}
                            </button>
                            {regConfirmPassword && regConfirmPassword === regPassword && (
                              <Check size={14} className="absolute left-10 top-1/2 -translate-y-1/2 text-emerald-500" />
                            )}
                          </div>
                          {regConfirmPassword && regConfirmPassword !== regPassword && (
                            <p className="text-[10px] text-red-400 mr-1">⚠️ كلمة المرور غير متطابقة</p>
                          )}
                        </div>
                        <button type="button" onClick={() => setWantsPoints(null)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 text-center transition">
                          ← تغيير الاختيار
                        </button>
                      </motion.div>
                    )}
                    {wantsPoints === false && (
                      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex items-center gap-2 bg-slate-900/40 border border-slate-800 rounded-xl p-3">
                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                        <p className="text-[10px] text-slate-400">ستسجل كمتبرع فقط بدون نظام نقاط</p>
                        <button type="button" onClick={() => setWantsPoints(null)}
                          className="mr-auto text-[9px] text-slate-500 hover:text-slate-300 transition">تغيير</button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {wantsPoints !== null && (
                    <button type="submit"
                      className="w-full bg-gradient-to-r from-red-600 to-rose-700 hover:opacity-90 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/30 active:scale-95 transition flex items-center justify-center gap-2">
                      {wantsPoints ? '🏆 تسجيل مع نظام النقاط' : '🩸 تسجيل كمتبرع'} <Plus size={16} />
                    </button>
                  )}
                </form>
              )}
            </motion.div>
          )}

          {/* 2. PORTAL HOME DASHBOARD */}
          {loggedVolunteer && currentTab === 'home' && (
            <motion.div
              key="home-tab"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col md:grid md:grid-cols-12 gap-4"
            >
              {/* LEFT/TOP COLUMN: Volunteer card + stats */}
              <div className="md:col-span-7 flex flex-col gap-4">
                {/* Motivational Quote */}
                <div className={`bg-gradient-to-r from-red-600/10 via-rose-600/5 to-transparent border border-red-500/15 p-3 rounded-2xl flex items-center gap-3`}>
                  <span className="text-lg">💡</span>
                  <p className={`text-[11px] font-medium italic leading-relaxed ${isDark ? 'text-red-200' : 'text-red-700'}`}>{quoteOfTheDay}</p>
                </div>

                {/* Glowing Volunteer Level Card */}
                <div className={`border rounded-3xl p-5 relative overflow-hidden shadow-xl ${themeCard}`}>
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-16 h-16 rounded-2xl border-2 border-red-500/40 p-1 shrink-0 flex items-center justify-center overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <img src={loggedVolunteer.avatarUrl} alt={loggedVolunteer.name} className="w-full h-full object-contain" />
                      </div>
                      <span className={`absolute -bottom-1.5 -left-1.5 w-6 h-6 bg-red-600 text-white border-2 rounded-lg text-xs font-black flex items-center justify-center shadow-lg ${isDark ? 'border-[#090D1A]' : 'border-white'}`}>
                        {loggedVolunteer.level}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-black tracking-widest text-red-500 uppercase bg-red-500/10 px-2 py-0.5 rounded-md">
                        {getLevelInfo(loggedVolunteer.points).name}
                      </span>
                      <h3 className={`text-base font-black truncate mt-1 ${themeText}`}>{loggedVolunteer.name}</h3>
                      <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${themeSubText}`}>
                        <Droplet size={10} className="text-red-500" /> فصيلة الدم: <strong>{loggedVolunteer.bloodType}</strong> · رتبة: <strong>{loggedVolunteer.role === 'admin' ? 'مسؤول البوابة' : 'بطل متطوع'}</strong>
                      </p>
                    </div>

                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-11 h-11 bg-orange-600/10 border border-orange-500/20 rounded-2xl flex items-center justify-center text-orange-500 shadow-inner relative group animate-bounce">
                        <Flame size={20} className="fill-orange-600/20 group-hover:scale-110 transition" />
                        <span className={`absolute -top-1 -right-1 w-4 h-4 bg-orange-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border ${isDark ? 'border-[#0F172A]' : 'border-white'}`}>
                          {loggedVolunteer.streak}
                        </span>
                      </div>
                      <span className="text-[8px] text-orange-400 font-bold mt-1">يوم متتالي 🔥</span>
                    </div>
                  </div>

                  <div className={`mt-4 pt-3 border-t ${themeBorder}`}>
                    <div className="flex justify-between items-center text-[10px] mb-1.5">
                      <span className={themeSubText}>النقاط الكلية: <strong className={`font-black ${themeText}`}>{loggedVolunteer.points} XP</strong></span>
                      <span className={themeSubText}>المستوى القادم: <strong>{getLevelInfo(loggedVolunteer.points).maxPoints} XP</strong></span>
                    </div>
                    <div className={`w-full h-3 rounded-full overflow-hidden p-0.5 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                      <motion.div 
                        className={`h-full rounded-full ${getProgressBarColor(loggedVolunteer.level)}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${getLevelInfo(loggedVolunteer.points).progress}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Three Grid Cards for Quick Statistics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className={`border rounded-2xl p-3.5 flex flex-col items-center text-center shadow-sm relative hover:border-red-500/30 transition-all ${themeCard}`}>
                    <div className="w-8 h-8 rounded-xl bg-red-600/10 flex items-center justify-center text-red-500 mb-2">
                      <Droplet size={16} />
                    </div>
                    <span className={`text-[10px] font-bold ${themeSubText}`}>مرات التبرع</span>
                    <p className={`text-lg font-black mt-1 ${themeText}`}>{loggedVolunteer.donationsCount}</p>
                    {loggedVolunteer.lastDonation && (
                      <p className={`text-[8px] mt-0.5 ${themeSubText}`}>آخر: {loggedVolunteer.lastDonation}</p>
                    )}
                  </div>

                  <div className={`border rounded-2xl p-3.5 flex flex-col items-center text-center shadow-sm relative hover:border-blue-500/30 transition-all ${themeCard}`}>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-2">
                      <Calendar size={16} />
                    </div>
                    <span className={`text-[10px] font-bold ${themeSubText}`}>حملات نزلتها</span>
                    <p className={`text-lg font-black mt-1 ${themeText}`}>{loggedVolunteer.campaignsCount}</p>
                  </div>

                  <div className={`border rounded-2xl p-3.5 flex flex-col items-center text-center shadow-sm relative hover:border-yellow-500/30 transition-all ${themeCard}`}>
                    <div className="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-2">
                      <Trophy size={16} />
                    </div>
                    <span className={`text-[10px] font-bold ${themeSubText}`}>الـ Ranking</span>
                    <p className={`text-lg font-black mt-1 ${themeText}`}>
                      #{leaderboardVolunteers.findIndex(v => v.uid === loggedVolunteer.uid) + 1}
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN (Desktop): Campaigns + Achievements */}
              <div className="md:col-span-5 flex flex-col gap-4">
                {/* Active & Upcoming Campaigns */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center mr-1">
                    <h4 className={`text-sm font-black flex items-center gap-1.5 ${themeText}`}>
                      <Compass size={16} className="text-red-500" /> حملات نشطة وقادمة
                    </h4>
                    <button 
                      onClick={() => { setCampaignFilter('all'); navigateTo('campaigns'); }} 
                      className="text-[10px] text-red-500 font-bold hover:underline"
                    >
                      عرض الكل ➔
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {campaigns.filter(c => c.status !== 'completed').slice(0, 2).map(camp => {
                      const isRegistered = camp.volunteersRegistered.includes(loggedVolunteer.uid);
                      return (
                        <div 
                          key={camp.id}
                          className={`border rounded-2xl p-4 flex flex-col gap-3 shadow-md relative transition hover:border-slate-600/50 ${themeCard}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              {camp.status === 'active' && (
                                <span className="inline-flex items-center gap-1 text-[8px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded-md mb-2">
                                  <span className="w-1 h-1 bg-white rounded-full animate-ping" /> نشطة الآن ⚠️
                                </span>
                              )}
                              <h5 className={`text-xs font-black leading-normal truncate ${themeText}`}>{camp.title}</h5>
                            </div>
                            <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-lg shrink-0">
                              +{camp.pointsReward.attendance} XP حضور
                            </span>
                          </div>

                          <div className={`grid grid-cols-2 gap-2 text-[10px] p-2.5 rounded-xl border ${isDark ? 'bg-slate-950/40 border-slate-900/60 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                            <div className="flex items-center gap-1.5 truncate">
                              <Calendar size={12} className={themeSubText} />
                              <span>{camp.date}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin size={12} className={themeSubText} />
                              <span>{camp.location.split(" - ")[0]}</span>
                            </div>
                          </div>

                          <div className="flex gap-2.5 mt-1">
                            <button
                              onClick={() => { setSelectedCampaignId(camp.id); navigateTo('campaign_details'); }}
                              className={`flex-1 py-2 rounded-xl text-xs font-black transition active:scale-95 flex items-center justify-center gap-1.5 ${isDark ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                              التفاصيل الكاملة
                            </button>
                            <button
                              onClick={() => handleCampaignToggleParticipation(camp.id)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 border ${isRegistered ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500' : 'bg-red-600 hover:bg-red-500 text-white border-transparent shadow-lg shadow-red-600/10'}`}
                            >
                              {isRegistered ? (<><Check size={12} /> مسجل للحضور</>) : "سأشارك بالحملة 🩸"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Achievements Summary Card */}
                <div className={`border rounded-3xl p-4 shadow-sm flex items-center justify-between ${themeCard}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center justify-center text-yellow-500 shadow-inner">
                      <Award size={20} />
                    </div>
                    <div>
                      <h4 className={`text-xs font-black ${themeText}`}>إنجازاتك وأوسمتك</h4>
                      <p className={`text-[10px] mt-0.5 ${themeSubText}`}>لقد قمت بفتح {loggedVolunteer.badges.length} من أصل {Object.keys(BADGE_DEFS).length} أوسمة</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigateTo('achievements')}
                    className="text-xs text-red-500 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-xl font-bold transition"
                  >
                    استعراض
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. CAMPAIGNS PAGE (LIST) */}
          {currentTab === 'campaigns' && (
            <motion.div
              key="campaigns-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col gap-4"
            >
              <div className="flex justify-between items-center mr-1">
                <h3 className={`text-base font-black flex items-center gap-1.5 ${themeText}`}>
                  <Calendar size={18} className="text-red-500 animate-pulse" /> حملات وفعاليات الفريق
                </h3>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${isDark ? "text-slate-400 bg-slate-900 border border-slate-800" : "text-slate-500 bg-slate-100 border border-slate-200"}`}>
                  إجمالي الحملات: {campaigns.length}
                </span>
              </div>

              <div className={`p-1 border rounded-2xl flex text-[10px] font-black ${themeSubText} ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-100 border-slate-200"}`}>
                {(['all', 'upcoming', 'active', 'completed'] as const).map(f => {
                  const labelMap: Record<string, string> = { all: "الكل", upcoming: "القادمة", active: "النشطة", completed: "المنتهية" };
                  return (
                    <button
                      key={f}
                      onClick={() => setCampaignFilter(f)}
                      className={`flex-1 py-2 text-center rounded-xl transition ${campaignFilter === f ? 'bg-red-600 text-white shadow-md' : 'hover:text-slate-200'}`}
                    >
                      {labelMap[f]}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredCampaigns.length === 0 ? (
                  <div className="col-span-full bg-[#0F172A]/50 border border-slate-850 p-8 rounded-3xl text-center text-slate-500">
                    <Calendar size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">لا توجد حملات متطابقة مع التصنيف حالياً.</p>
                  </div>
                ) : (
                  filteredCampaigns.map(camp => {
                    const isRegistered = loggedVolunteer ? camp.volunteersRegistered.includes(loggedVolunteer.uid) : false;
                    const percentComplete = Math.min(100, Math.round((camp.volunteersRegistered.length / camp.volunteersRequired) * 100));

                    return (
                      <div 
                        key={camp.id}
                        className={`border rounded-2xl ${themeCard} p-4 flex flex-col gap-3 shadow-md relative overflow-hidden`}
                      >
                        {camp.status === 'active' && (
                          <div className="absolute top-0 left-0 bg-red-600 text-white font-black text-[8px] px-3 py-1 rounded-br-xl shadow-md">نشطة</div>
                        )}
                        {camp.status === 'completed' && (
                          <div className="absolute top-0 left-0 bg-slate-800 text-slate-400 font-bold text-[8px] px-3 py-1 rounded-br-xl">منتهية</div>
                        )}

                        <div className="flex justify-between items-start pr-8 pl-1">
                          <div>
                            <h4 className={`text-sm font-black leading-snug ${themeText}`}>{camp.title}</h4>
                            <p className="text-[10.5px] text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">{camp.description}</p>
                          </div>
                        </div>

                        <div className={`grid grid-cols-2 gap-3 text-[10px] p-3 rounded-2xl border mt-1 ${isDark ? "bg-slate-950/40 border-slate-900/60 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-slate-500" />
                            <span>تاريخ: <strong>{camp.date}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-500" />
                            <span>وقت: <strong>{camp.time.split(" - ")[0]}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 col-span-2 truncate">
                            <MapPin size={12} className="text-red-500/70" />
                            <span>موقع: <strong>{camp.location}</strong></span>
                          </div>
                        </div>

                        {camp.status !== 'completed' && (
                          <div className="mt-1">
                            <div className="flex justify-between items-center text-[9.5px] text-slate-400 mb-1">
                              <span>المتطوعون المشاركون: <strong className="text-white">{camp.volunteersRegistered.length} أبطال</strong></span>
                              <span>العدد المطلوب: <strong>{camp.volunteersRequired}</strong></span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                              <div 
                                className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-full"
                                style={{ width: `${percentComplete}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => { setSelectedCampaignId(camp.id); navigateTo('campaign_details'); }}
                            className="flex-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 py-2 rounded-xl text-xs font-black transition"
                          >
                            كامل التفاصيل
                          </button>
                          
                          {camp.status !== 'completed' && (
                            <button
                              onClick={() => handleCampaignToggleParticipation(camp.id)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${isRegistered ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500' : 'bg-red-600 hover:bg-red-500 text-white border-transparent'}`}
                            >
                              {isRegistered ? "✓ مسجل للحضور" : "سأشارك بالحملة 🩸"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* 4. CAMPAIGN DETAILS PAGE */}
          {currentTab === 'campaign_details' && selectedCampaignId && (
            (() => {
              const camp = campaigns.find(c => c.id === selectedCampaignId);
              if (!camp) return <div className="text-center p-4">لم يتم العثور على الحملة</div>;
              const isRegistered = loggedVolunteer ? camp.volunteersRegistered.includes(loggedVolunteer.uid) : false;

              return (
                <motion.div
                  key="campaign-details-tab"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`max-w-2xl mx-auto w-full border rounded-3xl p-5 flex flex-col gap-4 shadow-xl ${themeCard}`}
                >
                  <button 
                    onClick={navigateBack}
                    className="self-start flex items-center gap-1 text-slate-400 hover:text-slate-100 text-xs font-bold transition"
                  >
                    <ArrowRight size={16} /> عودة للحملات
                  </button>

                  <div className={`border-b pb-3 ${themeBorder}`}>
                    {camp.status === 'active' && (
                      <span className="bg-red-600 text-white font-black text-[8px] px-2 py-0.5 rounded-md inline-block mb-2">نشطة حالياً</span>
                    )}
                    <h3 className={`text-base font-black leading-snug ${themeText}`}>{camp.title}</h3>
                  </div>

                  <div className="bg-gradient-to-br from-red-600/10 to-rose-700/10 border border-red-500/15 p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Trophy size={12} /> جوائز النقاط المتوقعة (XP Rewards):
                    </span>
                    <div className="grid grid-cols-3 gap-2 mt-1 text-center">
                      <div className={`p-2 rounded-xl border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                        <p className="text-[9px] text-slate-400 font-bold">حضور الحملة</p>
                        <p className={`text-xs font-black mt-0.5 ${themeText}`}>+{camp.pointsReward.attendance} XP</p>
                      </div>
                      <div className={`p-2 rounded-xl border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                        <p className="text-[9px] text-slate-400 font-bold">التبرع بالدم</p>
                        <p className="text-xs font-black text-red-500 mt-0.5">+{camp.pointsReward.donation} XP</p>
                      </div>
                      <div className={`p-2 rounded-xl border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                        <p className="text-[9px] text-slate-400 font-bold">المساهمة بالتنظيم</p>
                        <p className="text-xs font-black text-yellow-500 mt-0.5">+{camp.pointsReward.organize} XP</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className={`text-xs font-black ${themeText}`}>وصف وفكرة الحملة:</h4>
                    <p className={`text-xs mt-1 leading-relaxed ${themeSubText}`}>{camp.description}</p>
                  </div>

                  <div className={`flex flex-col gap-2 p-4 rounded-2xl border ${isDark ? "bg-slate-950/40 border-slate-900" : "bg-slate-50 border-slate-200"}`}>
                    <div className="flex items-start gap-2.5 text-xs text-slate-300">
                      <Calendar size={14} className="text-slate-500 mt-0.5 shrink-0" />
                      <div><span className="text-slate-400 font-medium">تاريخ الفعالية: </span><strong>{camp.date}</strong></div>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-slate-300">
                      <Clock size={14} className="text-slate-500 mt-0.5 shrink-0" />
                      <div><span className="text-slate-400 font-medium">ساعات التواجد الميداني: </span><strong>{camp.time}</strong></div>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-slate-300">
                      <MapPin size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <div><span className="text-slate-400 font-medium">المكان بالتفصيل: </span><strong>{camp.location}</strong></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-slate-300 mb-2">المتطوعون الأبطال المسجلون ({camp.volunteersRegistered.length}):</h4>
                    {camp.volunteersRegistered.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-950/20 rounded-xl border border-slate-900/60">كن البطل الأول وسجل اسمك الآن!</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1">
                        {camp.volunteersRegistered.map(uid => {
                          const vol = volunteers.find(v => v.uid === uid);
                          if (!vol) return null;
                          return (
                            <div key={uid} className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-[10.5px]">
                              <img src={vol.avatarUrl} alt={vol.name} className="w-5 h-5 rounded bg-slate-700" />
                              <span className="font-bold text-slate-200">{vol.name.split(" ")[0]}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <a 
                    href={`https://maps.google.com/?q=${encodeURIComponent(camp.location)}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-red-500 hover:text-red-400 hover:underline flex items-center justify-center gap-1.5 p-2 bg-red-600/5 rounded-xl border border-red-500/10 transition mt-1"
                  >
                    <MapPin size={14} /> عرض الموقع الجغرافي على خرائط Google ➔
                  </a>

                  {camp.status !== 'completed' && (
                    <button
                      onClick={() => handleCampaignToggleParticipation(camp.id)}
                      className={`w-full py-3.5 rounded-xl text-xs font-black transition shadow-lg mt-2 ${isRegistered ? 'bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25' : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20 hover:shadow-red-500/25'}`}
                    >
                      {isRegistered ? "✓ مسجل للمشاركة (اضغط لإلغاء التسجيل)" : "سأشارك بالحملة 🩸 (أضف اسمي للائحة الشرف)"}
                    </button>
                  )}
                </motion.div>
              );
            })()
          )}

          {/* 5. LEADERBOARD / RANKING */}
          {currentTab === 'ranking' && (
            <motion.div
              key="ranking-tab"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-4"
            >
              <div className="flex justify-between items-center mr-1">
                <h3 className={`text-base font-black flex items-center gap-1.5 ${themeText}`}>
                  <Trophy size={18} className="text-yellow-500 animate-bounce" /> لوحة الشرف والصدارة لمتطوعينا
                </h3>
                <span className="text-[10px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-lg font-bold">
                  أعلى المتصدرين
                </span>
              </div>

              <div className="bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent border border-yellow-500/30 rounded-3xl p-5 relative overflow-hidden shadow-lg">
                <div className="absolute -top-12 -left-12 w-28 h-28 bg-yellow-500/15 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900 border-2 border-yellow-500 p-1 shrink-0 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                      <img src={starVolunteer.avatarUrl} alt={starVolunteer.name} className="w-full h-full object-contain" />
                    </div>
                    <span className="absolute -bottom-1 -left-1 w-6 h-6 bg-yellow-500 border-2 border-[#090D1A] rounded-full text-xs font-black flex items-center justify-center shadow-lg text-slate-950">
                      👑
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] font-black tracking-widest text-yellow-500 uppercase bg-yellow-500/10 px-2 py-0.5 rounded-md border border-yellow-500/20">
                      🏆 بطل الشهر الاستثنائي
                    </span>
                    <h3 className="text-base font-black text-white mt-1.5">{starVolunteer.name}</h3>
                    <p className="text-[10.5px] text-slate-400 mt-0.5 leading-normal">
                      صاحب أعلى نقاط تفاعلية وحضور هذا الشهر. شريان حقيقي للحياة!
                    </p>
                  </div>

                  <div className="text-center shrink-0">
                    <p className="text-[10px] text-yellow-500 font-black">النقاط الكلية</p>
                    <p className="text-lg font-black text-white mt-0.5">{starVolunteer.points} XP</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-black text-slate-400 mr-1 mb-1">ترتيب أفضل 10 متطوعين:</h4>

                <div className="bg-[#0F172A]/80 border border-slate-800 rounded-3xl p-3 flex flex-col gap-2.5 shadow-md">
                  {leaderboardVolunteers.slice(0, 10).map((vol, index) => {
                    const isTopThree = index < 3;
                    const rankEmoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
                    const rankBgColor = index === 0 ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : index === 1 ? "bg-slate-400/10 text-slate-300 border border-slate-400/20" : index === 2 ? "bg-amber-600/10 text-amber-500 border border-amber-600/20" : "text-slate-400";
                    const isLogged = loggedVolunteer && loggedVolunteer.uid === vol.uid;

                    return (
                      <div 
                        key={vol.uid}
                        className={`flex items-center justify-between p-3 rounded-2xl transition border ${isLogged ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/60 border-slate-850 hover:bg-slate-900'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${rankBgColor}`}>
                            {rankEmoji}
                          </div>
                          <img src={vol.avatarUrl} alt={vol.name} className="w-8 h-8 rounded-lg bg-slate-800 p-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-white truncate">{vol.name}</span>
                              {isLogged && (
                                <span className="text-[7.5px] font-black bg-red-600 text-white px-1 py-0.2 rounded-md shrink-0">أنت</span>
                              )}
                            </div>
                            <p className="text-[9.5px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                              المستوى: {vol.level} · {vol.campaignsCount} حملة · {vol.donationsCount} تبرع
                            </p>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="text-xs font-black text-slate-200">{vol.points}</span>
                          <span className="text-[8px] text-slate-400 font-bold block">XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* 6. PROFILE TAB */}
          {currentTab === 'profile' && loggedVolunteer && (
            <motion.div
              key="profile-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-2xl mx-auto w-full flex flex-col gap-4"
            >
              <div className={`border rounded-3xl ${themeCard} p-5 flex flex-col items-center text-center shadow-lg relative overflow-hidden`}>
                <button 
                  onClick={handleLogout}
                  className="absolute top-4 left-4 p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition"
                  title="تسجيل الخروج"
                >
                  <LogOut size={16} />
                </button>

                <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-red-500/40 p-1 flex items-center justify-center overflow-hidden mb-3">
                  <img src={loggedVolunteer.avatarUrl} alt={loggedVolunteer.name} className="w-full h-full" />
                </div>

                <h3 className="text-base font-black text-white">{loggedVolunteer.name}</h3>
                <span className="text-[10px] text-red-500 bg-red-500/10 px-3 py-0.5 rounded-full font-bold mt-1">
                  المستوى {loggedVolunteer.level} · {getLevelInfo(loggedVolunteer.points).name}
                </span>

                <div className="grid grid-cols-2 gap-8 w-full mt-5 pt-4 border-t border-slate-850 text-slate-300">
                  <div>
                    <span className={`text-[10px] block ${themeSubText}`}>رقم الهاتف</span>
                    <strong className="text-xs text-white font-bold">{loggedVolunteer.phone}</strong>
                  </div>
                  <div>
                    <span className={`text-[10px] block ${themeSubText}`}>فصيلة الدم</span>
                    <strong className="text-xs text-white font-bold">{loggedVolunteer.bloodType}</strong>
                  </div>
                  {loggedVolunteer.lastDonation && (
                    <div className="col-span-2">
                      <span className={`text-[10px] block ${themeSubText}`}>آخر تبرع بالدم</span>
                      <strong className="text-xs text-red-400 font-bold flex items-center gap-1 justify-center mt-0.5">
                        <Droplet size={12} /> {loggedVolunteer.lastDonation}
                      </strong>
                    </div>
                  )}
                  {loggedVolunteer.wantsPoints && loggedVolunteer.email && (
                    <div className="col-span-2">
                      <span className={`text-[10px] block ${themeSubText}`}>البريد الإلكتروني (نظام النقاط)</span>
                      <strong className="text-xs text-yellow-400 font-bold">{loggedVolunteer.email}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-black text-slate-400 mr-1">سجل نقاط الـ XP المكتسبة ({currentUserLogs.length}):</h4>

                <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto p-1 custom-scrollbar">
                  {currentUserLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center p-6 bg-slate-900/45 rounded-2xl border border-slate-850">لا يوجد حركات مسجلة لنقاطك بعد.</p>
                  ) : (
                    currentUserLogs.map(log => {
                      const isPositive = log.points >= 0;
                      return (
                        <div 
                          key={log.id}
                          className={`border rounded-2xl ${themeCard} p-3 flex justify-between items-center text-xs`}
                        >
                          <div className="min-w-0 pr-1">
                            <span className="text-[9px] text-slate-400 font-bold block">{log.date}</span>
                            <span className="font-bold text-slate-200 block truncate mt-0.5">{log.description}</span>
                          </div>
                          <span className={`text-xs font-black shrink-0 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}{log.points} XP
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* 7. NOTIFICATIONS TAB */}
          {currentTab === 'notifications' && (
            <motion.div
              key="notifications-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className={`max-w-2xl mx-auto w-full border rounded-3xl p-5 flex flex-col gap-4 shadow-xl ${themeCard}`}
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <button 
                  onClick={navigateBack}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-100 text-xs font-bold transition"
                >
                  <ArrowRight size={16} /> عودة
                </button>
                <h3 className="text-sm font-black text-white">مركز التنبيهات والتحفيز</h3>
              </div>

              <div className="flex flex-col gap-3">
                {notifications.length === 0 ? (
                  <div className="text-center p-6 text-slate-500">
                    <Bell size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">صندوق التنبيهات فارغ حالياً.</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id}
                      className="bg-slate-900 border border-slate-850 p-3 rounded-2xl flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0 mt-0.5">
                        {n.type === 'points' ? <Star size={16} /> : n.type === 'badge' ? <Award size={16} /> : <Info size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] text-slate-400 font-bold block">{n.date}</span>
                        <h4 className={`text-xs font-black mt-0.5 ${themeText}`}>{n.title}</h4>
                        <p className="text-[10.5px] text-slate-400 mt-1 leading-relaxed">{n.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* 8. QR CODE SCANNER (VOLUNTEER VIEW) */}
          {currentTab === 'scan' && (
            <motion.div
              key="scan-tab"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-lg mx-auto w-full bg-[#0F172A]/90 border border-slate-800 rounded-3xl p-5 flex flex-col gap-4 shadow-xl"
            >
              <div className="text-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center justify-center gap-1.5">
                  <QrCode size={18} className="text-red-500" /> ماسح الرموز الذكي لـ "ومن أحياها"
                </h3>
                <p className="text-[10.5px] text-slate-400 mt-1">امسح رمز الـ QR لتسجيل حضورك أو تبرعك في الحملة تلقائياً وكسب نقاطك!</p>
              </div>

              {scanStatus === 'idle' && (
                <div className="flex flex-col gap-4">
                  <div className="w-full aspect-square max-w-[280px] mx-auto bg-slate-950 rounded-2xl border-2 border-red-500/30 relative overflow-hidden flex flex-col items-center justify-center text-center">
                    <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-lg" />
                    <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-lg" />
                    <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-lg" />
                    <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-lg" />
                    
                    <motion.div 
                      className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                      animate={{ top: ["10%", "90%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                    />

                    <Camera size={42} className="text-slate-700 animate-pulse" />
                    <p className="text-[10.5px] text-slate-500 font-bold mt-3">الماسح جاهز للعمل</p>
                  </div>

                  <button
                    type="button"
                    onClick={startCameraScan}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl text-xs active:scale-95 transition flex items-center justify-center gap-2 shadow shadow-red-600/20"
                  >
                    <Camera size={16} /> فتح الكاميرا ومسح QR
                  </button>

                  {cameraError && (
                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-[10.5px] font-bold leading-relaxed text-yellow-300">
                      {cameraError}
                    </div>
                  )}

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3">
                    <span className="text-[10.5px] font-black text-yellow-500 flex items-center gap-1">
                      <Star size={12} /> محاكي ومجرب الـ QR التفاعلي (Demo Simulator)
                    </span>
                    
                    <div className="grid grid-cols-1 gap-2 mt-1">
                      {campaigns.slice(0, 2).map(camp => (
                        <div key={camp.id} className="flex flex-col gap-1 border-t border-slate-800/80 pt-2 first:border-0 first:pt-0">
                          <span className="text-[9px] text-slate-500 font-bold block truncate">{camp.title}</span>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              onClick={() => processQRToken(`WAMAN_QR_ATTENDANCE_${camp.id}`)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 rounded-lg text-[9px] font-bold border border-slate-750 transition"
                            >
                              مسح حضور 🎟️
                            </button>
                            <button
                              onClick={() => processQRToken(`WAMAN_QR_DONATION_${camp.id}`)}
                              className="bg-red-950/60 hover:bg-red-900/60 text-red-400 py-1.5 rounded-lg text-[9px] font-bold border border-red-900/40 transition"
                            >
                              مسح تبرع 🩸
                            </button>
                            <button
                              onClick={() => processQRToken(`WAMAN_QR_ORGANIZE_${camp.id}`)}
                              className="bg-yellow-950/60 hover:bg-yellow-900/60 text-yellow-400 py-1.5 rounded-lg text-[9px] font-bold border border-yellow-900/40 transition"
                            >
                              مسح تنظيم 👑
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSimulatedScanSubmit} className="flex gap-2 border-t border-slate-850 pt-3">
                      <input
                        type="text"
                        className="flex-1 p-2 bg-slate-950 border border-slate-850 focus:border-red-500 text-[10px] text-slate-200 outline-none rounded-xl"
                        placeholder="أدخل رمز الـ QR يدوياً لو رغبت..."
                        value={simulatedCode}
                        onChange={e => setSimulatedCode(e.target.value)}
                      />
                      <button 
                        type="submit" 
                        className="bg-red-600 text-white font-bold text-[10px] px-3.5 rounded-xl hover:bg-red-500 active:scale-95 transition"
                      >
                        إرسال
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {scanStatus === 'scanning' && (
                <div className="flex flex-col gap-3">
                  <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border-2 border-red-500/40 bg-black">
                    <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="pointer-events-none absolute inset-6 rounded-2xl border border-red-400/70 shadow-[0_0_30px_rgba(239,68,68,0.25)]" />
                    <motion.div
                      className="pointer-events-none absolute left-8 right-8 h-1 bg-gradient-to-r from-transparent via-red-400 to-transparent"
                      animate={{ top: ["18%", "82%"] }}
                      transition={{ duration: 1.7, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraScan();
                      setScanStatus('idle');
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 text-xs font-black text-slate-200 transition hover:bg-slate-800"
                  >
                    إيقاف الكاميرا
                  </button>
                </div>
              )}

              {/* SUCCESS OVERLAY SCREEN */}
              {scanStatus === 'success' && scanResultDetails && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-slate-900/90 border border-emerald-500/20 p-5 rounded-3xl text-center flex flex-col items-center gap-4 relative overflow-hidden"
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10 animate-bounce">
                    <CheckCircle size={36} />
                  </div>

                  <div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      عملية مسح ناجحة وموثقة ✓
                    </span>
                    <h4 className="text-base font-black text-white mt-3">تم تسجيل نقاطك تلقائياً! 🩸🎉</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-normal max-w-[280px]">
                      تم منحك <strong>+{scanResultDetails.pointsGained} XP</strong> لحملة: <br />
                      <strong className="text-white">"{scanResultDetails.campaignTitle}"</strong> <br />
                      بصفة: <strong>({scanResultDetails.typeName})</strong>
                    </p>
                    {scanResultDetails.isDonation && (
                      <div className="mt-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 text-[10px] text-red-400 font-bold">
                        <Droplet size={12} /> تم تسجيل تبرعك بالدم بتاريخ {scanResultDetails.donationDate}
                      </div>
                    )}
                  </div>

                  {scanResultDetails.badgeGranted && (
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1, transition: { delay: 0.4 } }}
                      className="w-full bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20 p-3 rounded-2xl text-center flex items-center justify-center gap-2 mt-1 shadow"
                    >
                      <span className="text-base">🏆</span>
                      <p className="text-[10px] text-yellow-400 font-black">
                        مبروك! لقد قمت بفتح وسام جديد: <strong>"{scanResultDetails.badgeGranted}"</strong>!
                      </p>
                    </motion.div>
                  )}

                  <div className="w-full bg-slate-950/60 p-3 rounded-2xl border border-slate-900 text-[10.5px] text-slate-400 mt-1">
                    مجموع نقاطك الجديد: <strong className="text-white">{scanResultDetails.newTotal} XP</strong> · مستواك: <strong className="text-emerald-400">{scanResultDetails.levelName}</strong>
                  </div>

                  <button
                    onClick={() => setScanStatus('idle')}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs active:scale-95 transition shadow shadow-emerald-600/20"
                  >
                    مسح رمز آخر ➔
                  </button>
                </motion.div>
              )}

              {/* ERROR STATE */}
              {scanStatus === 'error' && (
                <div className="bg-slate-900 border border-red-500/20 p-6 rounded-3xl text-center flex flex-col items-center gap-4">
                  <div className="w-14 h-14 bg-red-600/15 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-500">
                    <AlertCircle size={28} />
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-black text-white">فشل تسجيل الرمز</h4>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      تعذر معالجة الرمز. قد يكون قد تم استخدامه مسبقاً، أو أنه غير مسجل في النظام للحملة الحالية.
                    </p>
                  </div>

                  <button
                    onClick={() => setScanStatus('idle')}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs transition"
                  >
                    إعادة المحاولة ➔
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* 9. ACHIEVEMENTS & BADGES PAGE */}
          {currentTab === 'achievements' && loggedVolunteer && (
            <motion.div
              key="achievements-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col gap-4"
            >
              <div className="flex justify-between items-center mr-1">
                <h3 className={`text-base font-black flex items-center gap-1.5 ${themeText}`}>
                  <Award size={18} className="text-red-500" /> لوحة الأوسمة والإنجازات
                </h3>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${isDark ? "text-slate-400 bg-slate-900 border border-slate-800" : "text-slate-500 bg-slate-100 border border-slate-200"}`}>
                  مكتسب: {loggedVolunteer.badges.length} / {Object.keys(BADGE_DEFS).length}
                </span>
              </div>

              <div className={`border rounded-3xl ${themeCard} p-4 shadow-md flex flex-col gap-3`}>
                <h4 className="text-xs font-black text-slate-300 border-b border-slate-800 pb-2">تفاصيل مستويات أبطال ومن أحياها:</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {LEVEL_DEFS.map(lvl => {
                    const isCurrent = loggedVolunteer.level === lvl.level;
                    
                    return (
                      <div 
                        key={lvl.level}
                        className={`p-2.5 rounded-xl text-[10.5px] flex items-center justify-between border ${isCurrent ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-950/30 border-slate-900 text-slate-400'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded flex items-center justify-center font-black text-[10px] ${isCurrent ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                            {lvl.level}
                          </span>
                          <span className={`font-black ${isCurrent ? 'text-white' : 'text-slate-400'}`}>{lvl.name}</span>
                        </div>
                        <span className="font-bold text-[9.5px]">تبدأ من: {lvl.minPoints} XP</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-black text-slate-400 mr-1">قائمة الأوسمة والميداليات المتاحة:</h4>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-1">
                  {Object.entries(BADGE_DEFS).map(([id, item]) => {
                    const isUnlocked = loggedVolunteer.badges.includes(id);
                    
                    return (
                      <div 
                        key={id}
                        className={`border rounded-2xl p-4 flex flex-col items-center text-center shadow-sm relative overflow-hidden transition-all ${isUnlocked ? `bg-slate-900 border-slate-800 shadow-md ${item.color.split(" ")[1]}` : 'bg-slate-900/40 border-slate-900/80 opacity-40'}`}
                      >
                        {isUnlocked && (
                          <span className="absolute top-2 right-2 text-[9px] font-black bg-yellow-500 text-slate-950 px-1.5 py-0.2 rounded-md animate-pulse">✓ فتح</span>
                        )}

                        <div className={`w-11 h-11 rounded-2xl ${isUnlocked ? item.bg : 'bg-slate-950'} border ${isUnlocked ? item.color.split(" ")[1] : 'border-slate-850'} flex items-center justify-center text-slate-300 mb-3 shadow-inner`}>
                          <item.icon size={22} className={isUnlocked ? item.color : 'text-slate-700'} />
                        </div>

                        <h5 className={`text-xs font-black ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>{item.title}</h5>
                        <p className="text-[9.5px] text-slate-400 mt-1 leading-normal line-clamp-2">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* 10. ADMIN DASHBOARD */}
          {currentTab === 'admin' && loggedVolunteer && loggedVolunteer.role === 'admin' && (
            <motion.div
              key="admin-tab"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-4"
            >
              <div className="flex justify-between items-center mr-1">
                <h3 className={`text-base font-black flex items-center gap-1.5 ${themeText}`}>
                  <Shield size={18} className="text-red-500" /> لوحة التحكم والمراقبة للمسؤولين
                </h3>
                <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                  وضع الإدارة الكاملة
                </span>
              </div>

              {/* Admin content: 2-column on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* 10.1 Points Allocation block */}
                <div className={`border rounded-3xl ${themeCard} p-5 shadow-md flex flex-col gap-4`}>
                  <h4 className={`text-xs font-black border-b pb-2 flex items-center gap-1.5 ${themeText} ${themeBorder}`}>
                    <PlusCircle size={14} className="text-emerald-500" /> تعديل وتخصيص نقاط متطوع يدوياً:
                  </h4>

                  <form onSubmit={handleAdminAddPoints} className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1.5">
                        <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>اختر المتطوع البطل:</label>
                        <select 
                          className={`p-2.5 text-xs outline-none rounded-xl ${themeInput}`}
                          value={adminPointsForm.volunteerId}
                          onChange={e => setAdminPointsForm({...adminPointsForm, volunteerId: e.target.value})}
                          required
                        >
                          <option value="">-- حدد المتطوع --</option>
                          {volunteers.map(v => (
                            <option key={v.uid} value={v.uid}>{v.name} ({v.points} XP)</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>النقاط (موجب أو سالب):</label>
                        <input 
                          type="number"
                          className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-red-500 text-center"
                          value={adminPointsForm.points}
                          onChange={e => setAdminPointsForm({...adminPointsForm, points: Number(e.target.value)})}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1.5">
                        <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>التصنيف:</label>
                        <select 
                          className={`p-2.5 text-xs outline-none rounded-xl ${themeInput}`}
                          value={adminPointsForm.type}
                          onChange={e => setAdminPointsForm({...adminPointsForm, type: e.target.value as any})}
                          required
                        >
                          <option value="bonus">مكافأة إضافية 🎁</option>
                          <option value="attendance">حضور ميداني 🎟️</option>
                          <option value="donation">تبرع دم 🩸</option>
                          <option value="organize">تنظيم وإشراف 👑</option>
                          <option value="penalty">خصم عقوبة ⚠️</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>تفاصيل وسبب التعديل:</label>
                        <input 
                          type="text"
                          className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-red-500"
                          placeholder="مثال: جهود استثنائية في حملة سوهاج"
                          value={adminPointsForm.description}
                          onChange={e => setAdminPointsForm({...adminPointsForm, description: e.target.value})}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition shadow shadow-emerald-600/20"
                    >
                      تأكيد تعديل رصيد النقاط يدوياً ✓
                    </button>
                  </form>
                </div>

                {/* 10.2 Add Campaign block */}
                <div className={`border rounded-3xl ${themeCard} p-5 shadow-md flex flex-col gap-4`}>
                  <h4 className={`text-xs font-black border-b pb-2 flex items-center gap-1.5 ${themeText} ${themeBorder}`}>
                    <PlusCircle size={14} className="text-red-500" /> إنشاء حملة ميدانية جديدة:
                  </h4>

                  <form onSubmit={handleAdminAddCampaign} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>عنوان الحملة/الندوة *</label>
                      <input 
                        type="text"
                        className={`p-2.5 text-xs outline-none rounded-xl ${themeInput}`}
                        placeholder="مثال: حملة التبرع بالدم بمركز طهطا"
                        value={adminCampaignForm.title}
                        onChange={e => setAdminCampaignForm({...adminCampaignForm, title: e.target.value})}
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>تفاصيل الحملة</label>
                      <textarea 
                        className="p-2.5 bg-slate-950 border border-slate-800 focus:border-red-500 text-xs text-slate-200 outline-none rounded-xl h-16 resize-none"
                        placeholder="وصف تفصيلي للفعالية والمهام والجهات الشريكة..."
                        value={adminCampaignForm.description}
                        onChange={e => setAdminCampaignForm({...adminCampaignForm, description: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1.5">
                        <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>تاريخ الفعالية *</label>
                        <input 
                          type="date"
                          className={`p-2 text-xs outline-none rounded-xl ${themeInput}`}
                          value={adminCampaignForm.date}
                          onChange={e => setAdminCampaignForm({...adminCampaignForm, date: e.target.value})}
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>المكان بالتفصيل *</label>
                        <input 
                          type="text"
                          className={`p-2 text-xs outline-none rounded-xl ${themeInput}`}
                          placeholder="مثال: النادي الرياضي - وسط البلد"
                          value={adminCampaignForm.location}
                          onChange={e => setAdminCampaignForm({...adminCampaignForm, location: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition shadow shadow-red-600/20"
                    >
                      نشر الحملة وإتاحتها فوراً 🚀
                    </button>
                  </form>
                </div>

                {/* 10.3 QR Code Generator – ENHANCED */}
                <div className="md:col-span-2 bg-[#0F172A]/90 border border-yellow-500/20 rounded-3xl p-5 shadow-md flex flex-col gap-4">
                  <h4 className="text-xs font-black text-yellow-400 border-b border-yellow-500/20 pb-2 flex items-center gap-1.5">
                    <QrCode size={14} className="text-yellow-500" /> مولد ومدير رموز الـ QR الذكية للحملات 🎫
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Config */}
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>اختر الحملة النشطة:</label>
                        <select 
                          className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-yellow-500"
                          value={adminSelectedCampaignQR}
                          onChange={e => { setAdminSelectedCampaignQR(e.target.value); setAdminQRCustomPoints(0); }}
                        >
                          <option value="">-- حدد الحملة --</option>
                          {campaigns.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>نوع رمز الـ QR:</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { val: 'attendance', label: 'حضور 🎟️' },
                            { val: 'donation', label: 'تبرع 🩸' },
                            { val: 'organize', label: 'تنظيم 👑' }
                          ].map(opt => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => { setAdminQRType(opt.val as any); setAdminQRCustomPoints(0); }}
                              className={`py-2 rounded-xl text-[10px] font-bold border transition ${adminQRType === opt.val ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className={`text-[10px] font-bold mr-1 ${themeSubText}`}>نقاط مخصصة (اختياري):</label>
                        <input 
                          type="number"
                          min={0}
                          className={`p-2.5 text-xs outline-none rounded-xl text-center ${themeInput}`}
                          placeholder={`الافتراضي: ${adminSelectedCampaignQR ? (campaigns.find(c => c.id === adminSelectedCampaignQR)?.pointsReward[adminQRType] || 50) : 50} نقطة`}
                          value={adminQRCustomPoints || ""}
                          onChange={e => setAdminQRCustomPoints(Number(e.target.value))}
                        />
                      </div>

                      {/* Active toggle */}
                      <div
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${adminQRActive ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/40'}`}
                        onClick={() => setAdminQRActive(!adminQRActive)}
                      >
                        <span className="text-xs font-bold text-slate-300">حالة الرمز</span>
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${adminQRActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          {adminQRActive ? '✅ مفعّل' : '⛔ معطّل'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => saveSelectedQRSettings(adminQRActive, getAdminQRPoints())}
                        disabled={!adminSelectedCampaignQR}
                        className="w-full rounded-xl bg-yellow-500 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        حفظ إعدادات QR للحملة
                      </button>
                    </div>

                    {/* Right: QR Display + Actions */}
                    <div className="flex flex-col items-center gap-3">
                      {adminSelectedCampaignQR ? (
                        <>
                          <div className={`bg-white p-3 rounded-2xl inline-block shadow-xl ${!adminQRActive ? 'opacity-30 grayscale' : 'shadow-yellow-500/10'}`}>
                            <img 
                              src={getAdminQRUrl(220)} 
                              alt="Campaign QR Code" 
                              className="w-48 h-48"
                            />
                          </div>

                          {!adminQRActive && (
                            <div className="text-[10px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                              ⛔ الرمز معطّل حالياً ولن يعمل عند المسح
                            </div>
                          )}

                          <div className="text-center text-[10px] text-slate-400">
                            <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-black px-3 py-1 rounded-full">
                              +{getAdminQRPoints()} نقطة عند المسح
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col gap-2 w-full">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => {
                                  const camp = campaigns.find(c => c.id === adminSelectedCampaignQR);
                                  printQRCode(getAdminQRUrl(250), camp?.title || '', adminQRType, getAdminQRPoints());
                                }}
                                disabled={!adminQRActive}
                                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10.5px] font-bold transition disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700 ${isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
                              >
                                <Printer size={13} /> طباعة الرمز 🖨️
                              </button>

                              <button
                                onClick={() => setQrFullscreen(true)}
                                disabled={!adminQRActive}
                                className="flex items-center justify-center gap-1.5 bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 py-2 rounded-xl text-[10.5px] font-bold transition disabled:opacity-30 disabled:cursor-not-allowed border border-yellow-500/30"
                              >
                                <Maximize2 size={13} /> فتح ملء الشاشة 📱
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                const deepData = `WAMAN_QR_${adminQRType.toUpperCase()}_${adminSelectedCampaignQR}`;
                                const deepUrl = `${window.location.origin}${window.location.pathname}?qr_code_token=${deepData}`;
                                navigator.clipboard.writeText(deepUrl);
                                toast.success("تم نسخ الرابط المباشر للـ QR كود!");
                              }}
                              className={`flex-1 py-2 rounded-xl text-[10.5px] font-bold transition flex items-center justify-center gap-1 border ${isDark ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300" : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600"}`}
                            >
                              <Copy size={12} /> نسخ رابط الـ QR للمشاركة
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-8 text-slate-500 italic text-[11px] bg-slate-950/20 rounded-2xl border border-slate-900/60 w-full flex flex-col items-center gap-2">
                          <QrCode size={32} className="opacity-20" />
                          يرجى اختيار الحملة من القائمة لتوليد الـ QR كود تلقائياً.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 10.4 All Volunteers Database Table view */}
                <div className={`md:col-span-2 border rounded-3xl p-5 shadow-md flex flex-col gap-3 ${themeCard}`}>
                  <div className={`flex justify-between items-center border-b pb-2 ${themeBorder}`}>
                    <h4 className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                      <User size={14} className="text-slate-400" /> قاعدة بيانات جميع المتطوعين ({volunteers.length}):
                    </h4>
                    
                    <input
                      type="text"
                      className="p-1.5 bg-slate-950 border border-slate-850 focus:border-red-500 text-[10px] text-slate-200 outline-none rounded-lg w-28 placeholder-slate-650"
                      placeholder="ابحث عن متطوع..."
                      value={searchVolunteerText}
                      onChange={e => setSearchVolunteerText(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1 custom-scrollbar">
                    {volunteers.filter(v => v.name.includes(searchVolunteerText) || v.phone.includes(searchVolunteerText)).map(vol => (
                      <div 
                        key={vol.uid}
                        className={`p-2.5 rounded-xl flex items-center justify-between text-[11px] border ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={vol.avatarUrl} alt={vol.name} className={`w-7 h-7 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-200 block truncate">{vol.name}</span>
                            <span className="text-[9px] text-slate-500 block truncate">
                              {vol.phone} · فصيلة {vol.bloodType}
                              {vol.lastDonation && ` · آخر تبرع: ${vol.lastDonation}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-black text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-850">{vol.points} XP</span>
                          
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                const newPoints = Math.max(0, vol.points - 10);
                                const lvl = getLevelInfo(newPoints);
                                setVolunteers(prev => prev.map(v => v.uid === vol.uid ? { ...v, points: newPoints, level: lvl.level } : v));
                                toast.success(`تم خصم 10 نقاط لـ ${vol.name}`);
                              }}
                              className="p-1 bg-red-950 text-red-500 hover:bg-red-600 hover:text-white rounded transition"
                              title="خصم 10 نقاط"
                            >
                              <MinusCircle size={13} />
                            </button>
                            
                            <button
                              onClick={() => {
                                const newPoints = vol.points + 10;
                                const lvl = getLevelInfo(newPoints);
                                setVolunteers(prev => prev.map(v => v.uid === vol.uid ? { ...v, points: newPoints, level: lvl.level } : v));
                                toast.success(`تم إضافة 10 نقاط لـ ${vol.name}`);
                              }}
                              className="p-1 bg-emerald-950 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded transition"
                              title="مكافأة 10 نقاط"
                            >
                              <PlusCircle size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ─── MOBILE BOTTOM NAV (hidden on md+) ──────────────────── */}
      {loggedVolunteer && (
        <div className={`fixed bottom-3 left-3 right-3 z-50 md:hidden backdrop-blur-xl border shadow-2xl p-1.5 rounded-3xl flex items-center justify-between ${
          isDark ? 'bg-[#0F172A]/95 border-slate-800' : 'bg-white/95 border-slate-200'
        }`}>
          <button
            onClick={() => setCurrentTab('home')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition ${
              currentTab === 'home' ? 'text-red-500 font-bold' : isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <User size={18} />
            <span className="text-[8.5px] mt-0.5">الرئيسية</span>
          </button>

          <button
            onClick={() => setCurrentTab('campaigns')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition ${
              currentTab === 'campaigns' || currentTab === 'campaign_details' ? 'text-red-500 font-bold' : isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <Calendar size={18} />
            <span className="text-[8.5px] mt-0.5">الحملات</span>
          </button>

          {/* Floating QR button */}
          <button
            onClick={() => setCurrentTab('scan')}
            className={`w-14 h-14 bg-red-600 hover:bg-red-500 text-white rounded-2xl flex flex-col items-center justify-center -translate-y-5 shadow-xl shadow-red-600/40 border-4 transition active:scale-95 shrink-0 ${
              isDark ? 'border-[#090D1A]' : 'border-slate-100'
            }`}
          >
            <QrCode size={22} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => setCurrentTab('ranking')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition ${
              currentTab === 'ranking' ? 'text-red-500 font-bold' : isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <Trophy size={18} />
            <span className="text-[8.5px] mt-0.5">الصدارة</span>
          </button>

          <button
            onClick={() => setCurrentTab('achievements')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition ${
              currentTab === 'achievements' ? 'text-red-500 font-bold' : isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <Award size={18} />
            <span className="text-[8.5px] mt-0.5">الأوسمة</span>
          </button>
        </div>
      )}

      </div>{/* end right-side flex-1 */}
    </div>
  );
}
