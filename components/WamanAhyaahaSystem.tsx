
import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, getDoc } from "firebase/firestore";
import { 
    Heart, Ambulance, UserPlus, MapPin, Phone, AlertTriangle, 
    CheckCircle, X, Plus, Activity, Lock, Search, Calendar, 
    Clock, PhoneCall, FileText, ChevronDown, ChevronUp, Edit, Trash2, UserCheck, Eye, Share2, Copy, Shield, Settings, Save, Info, Droplet, Users, UserMinus, CalendarPlus, HelpCircle, Download, Briefcase, Filter, MessageCircle, Zap, TrendingUp, Award, Star
} from "lucide-react";
import { exportCsv } from "../utils/csvExport";
import { resolveWamanRoute, sendTelegramToChatIds } from "../utils/telegramRouting";
import TaskBoard from "./TaskBoard"; 

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", "لا أعرف"];
const URGENCY_LEVELS = ["عاجل الآن", "خلال 24 ساعة", "موعد عملية محدد (مجدولة)"];
const PRODUCT_TYPES = ["دم كامل", "صفائح دموية", "بلازما", "كرات دم حمراء (Packed RBCs)", "أخرى"];
const SOHAG_CENTERS = [
    "سوهاج", "أخميم", "ساقلتة", "دار السلام", "البلينا", "جرجا", 
    "العسيرات", "جزيرة شندويل", "المراغة", "طهطا", "طما", "المنشأة", "جهينة"
];


const SUPER_ADMIN_EMAIL = "dr.mahmoud.elhenawy@gmail.com";


const RBC_COMPATIBILITY: Record<string, string[]> = {
    "A+": ["A+", "A-", "O+", "O-"],
    "A-": ["A-", "O-"],
    "B+": ["B+", "B-", "O+", "O-"],
    "B-": ["B-", "O-"],
    "AB+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    "AB-": ["AB-", "A-", "B-", "O-"],
    "O+": ["O+", "O-"],
    "O-": ["O-"], 
    "لا أعرف": [] 
};

// Blood type color map
const BLOOD_COLORS: Record<string, { bg: string; text: string; grad: string }> = {
    "A+":  { bg: "bg-red-100",    text: "text-red-700",    grad: "from-red-500 to-red-700" },
    "A-":  { bg: "bg-red-50",     text: "text-red-600",    grad: "from-red-400 to-red-600" },
    "B+":  { bg: "bg-orange-100", text: "text-orange-700", grad: "from-orange-500 to-orange-700" },
    "B-":  { bg: "bg-orange-50",  text: "text-orange-600", grad: "from-orange-400 to-orange-600" },
    "O+":  { bg: "bg-rose-100",   text: "text-rose-700",   grad: "from-rose-500 to-rose-700" },
    "O-":  { bg: "bg-rose-50",    text: "text-rose-600",   grad: "from-rose-400 to-rose-600" },
    "AB+": { bg: "bg-purple-100", text: "text-purple-700", grad: "from-purple-500 to-purple-700" },
    "AB-": { bg: "bg-purple-50",  text: "text-purple-600", grad: "from-purple-400 to-purple-600" },
    "لا أعرف": { bg: "bg-gray-100", text: "text-gray-600", grad: "from-gray-400 to-gray-600" },
};

const URGENCY_META: Record<string, { color: string; bg: string; label: string; pulse: boolean }> = {
    "عاجل الآن":                { color: "text-red-700",    bg: "bg-red-100",    label: "عاجل",    pulse: true  },
    "خلال 24 ساعة":             { color: "text-orange-700", bg: "bg-orange-100", label: "24 ساعة", pulse: false },
    "موعد عملية محدد (مجدولة)": { color: "text-blue-700",   bg: "bg-blue-100",   label: "مجدول",   pulse: false },
};

interface Recipient { id: string; name: string; chatId: string; }

interface WamanAhyaahaSystemProps {
    user: any;
    telegramConfig?: any;
    onSendTelegram?: (chatId: string, text: string, botToken?: string) => void;
    isPublicMode?: boolean;
    forceGuestMode?: boolean;
    standaloneAdminMode?: boolean;
    tasks?: any[];
    newTask?: any;
    setNewTask?: any;
    handleAddTask?: any;
    toggleStatus?: any;
    deleteTask?: any;
    setSelectedTask?: any;
    onOpenAddTask?: (defaults?: any) => void;
    deptSettings?: any;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, sub }: any) => (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-4 text-white shadow-lg flex flex-col gap-1 min-w-[110px]`}>
        <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-80">{label}</span>
            <Icon size={16} className="opacity-70"/>
        </div>
        <p className="text-3xl font-black leading-none">{value}</p>
        {sub && <p className="text-[10px] opacity-70 font-medium">{sub}</p>}
    </div>
);

// ─── Blood Badge ──────────────────────────────────────────────────────────────
const BloodBadge = ({ type, size = 'md' }: { type: string; size?: 'sm' | 'md' | 'lg' }) => {
    const c = BLOOD_COLORS[type] || BLOOD_COLORS["لا أعرف"];
    const sizeClass = size === 'lg' ? 'w-14 h-14 text-xl' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-12 h-12 text-base';
    return (
        <div className={`${sizeClass} rounded-xl bg-gradient-to-br ${c.grad} flex items-center justify-center font-black text-white shadow-md shrink-0`}>
            {type}
        </div>
    );
};

// ─── Donor Card ───────────────────────────────────────────────────────────────
const DonorCard = ({ donor, activeTab, approveDonor, deleteDonor, markAsDonatedToday, isDonorEligible }: any) => {
    const [expanded, setExpanded] = useState(false);
    const eligible = isDonorEligible(donor.lastDonation);
    const isPending = donor.status === 'pending';

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${isPending ? 'border-orange-200 dark:border-orange-800/40' : eligible ? 'border-emerald-200 dark:border-emerald-800/30' : 'border-gray-100 dark:border-gray-700'}`}>
            {/* Eligibility accent bar */}
            <div className={`h-1 w-full ${isPending ? 'bg-orange-400' : eligible ? 'bg-emerald-500' : 'bg-gray-300'}`}/>
            
            <div className="p-4">
                {/* Top Row */}
                <div className="flex items-center gap-3 mb-3">
                    <BloodBadge type={donor.bloodType} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-800 dark:text-white truncate">{donor.name}</h4>
                            {isPending && <span className="text-[9px] font-black bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full shrink-0">انتظار</span>}
                            {!isPending && eligible && <span className="text-[9px] font-black bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full shrink-0">متاح ✓</span>}
                            {!isPending && !eligible && <span className="text-[9px] font-black bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">متعافٍ</span>}
                        </div>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin size={10}/> {donor.city}{donor.area ? ` - ${donor.area}` : ''} · {donor.age} سنة
                        </p>
                    </div>
                    <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition">
                        {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                </div>

                {/* Expanded Details */}
                {expanded && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 mb-3 space-y-1.5 text-xs animate-fade-in-up">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {donor.age && <div className="flex justify-between"><span className="text-gray-400">العمر</span><span className="font-bold dark:text-gray-300">{donor.age} سنة</span></div>}
                            {donor.phone2 && <div className="flex justify-between"><span className="text-gray-400">هاتف 2</span><span className="font-bold dark:text-gray-300 dir-ltr">{donor.phone2}</span></div>}
                            <div className="flex justify-between"><span className="text-gray-400">آخر تبرع</span><span className="font-bold dark:text-gray-300">{donor.lastDonation || "لم يتبرع بعد"}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">الحالة الصحية</span><span className={`font-bold ${donor.hasDisease === 'yes' ? 'text-red-500' : 'text-emerald-600'}`}>{donor.hasDisease === 'yes' ? '⚠️ مزمن' : 'سليم'}</span></div>
                            {donor.bestTime && <div className="flex justify-between"><span className="text-gray-400">أفضل وقت</span><span className="font-bold dark:text-gray-300">{donor.bestTime === 'anytime' ? 'أي وقت' : donor.bestTime}</span></div>}
                            {donor.emergencyConsent && <div className="flex justify-between"><span className="text-gray-400">طوارئ</span><span className={`font-bold ${donor.emergencyConsent === 'yes' ? 'text-emerald-600' : 'text-red-500'}`}>{donor.emergencyConsent === 'yes' ? 'موافق ✓' : 'غير موافق'}</span></div>}
                        </div>
                        {donor.address && <p className="text-gray-500 pt-1 border-t dark:border-gray-700 mt-1"><span className="text-gray-400">العنوان: </span>{donor.address}</p>}
                        {donor.adminNotes && <p className="text-indigo-600 dark:text-indigo-400 pt-1 border-t dark:border-gray-700"><span className="font-bold">ملاحظات: </span>{donor.adminNotes}</p>}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                    {activeTab === 'supply' ? (
                        <>
                            <a href={`tel:${donor.phone1}`} className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition">
                                <Phone size={13}/> اتصال
                            </a>
                            <a href={`https://wa.me/20${donor.phone1?.startsWith('0') ? donor.phone1.substring(1) : donor.phone1}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-green-100 transition">
                                <MessageCircle size={13}/> واتساب
                            </a>
                        </>
                    ) : (
                        <button onClick={() => approveDonor(donor.id, donor.name)} className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white py-2 rounded-xl text-xs font-bold hover:opacity-90 transition shadow-sm">
                            ✓ قبول الانضمام
                        </button>
                    )}
                    <button onClick={() => deleteDonor(donor.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-600 rounded-xl transition">
                        <Trash2 size={15}/>
                    </button>
                </div>
                {activeTab === 'supply' && (
                    <button onClick={() => markAsDonatedToday(donor.id, donor.name)} className="w-full mt-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-100 transition flex items-center justify-center gap-1.5">
                        <CalendarPlus size={12}/> تسجيل تبرع اليوم
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── Request Card ─────────────────────────────────────────────────────────────
const RequestCard = ({ req, deleteRequest }: any) => {
    const urgMeta = URGENCY_META[req.urgency] || URGENCY_META["خلال 24 ساعة"];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all overflow-hidden">
            {/* Urgency accent */}
            <div className={`h-1 w-full ${req.urgency === 'عاجل الآن' ? 'bg-red-500' : req.urgency?.includes('24') ? 'bg-orange-400' : 'bg-blue-400'}`}/>
            <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                    <BloodBadge type={req.bloodType}/>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 dark:text-white truncate">{req.patientName}</h4>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin size={10}/> {req.hospitalName} · {req.governorate}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${urgMeta.bg} ${urgMeta.color} flex items-center gap-1`}>
                            {req.urgency === 'عاجل الآن' && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block"/>}
                            {urgMeta.label}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${req.status === 'active' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {req.status === 'active' ? 'نشط' : 'تم'}
                        </span>
                    </div>
                </div>

                {/* Details row */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg font-bold">{req.productType}</span>
                    <span className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-600 px-2 py-1 rounded-lg font-bold">{req.bagsCount} كيس</span>
                    {req.fileNumber && <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 px-2 py-1 rounded-lg">ملف: {req.fileNumber}</span>}
                </div>

                {req.notes && <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg mb-3">{req.notes}</p>}

                <div className="flex gap-2">
                    <a href={`tel:${req.contactPhone}`} className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition">
                        <Phone size={13}/> {req.contactPhone}
                    </a>
                    <button onClick={() => deleteRequest(req.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-600 rounded-xl transition">
                        <Trash2 size={15}/>
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WamanAhyaahaSystem({ 
    user, telegramConfig, onSendTelegram, 
    isPublicMode = false, forceGuestMode = false,
    standaloneAdminMode = false,
    tasks = [], newTask, setNewTask, handleAddTask, toggleStatus, deleteTask, setSelectedTask, onOpenAddTask
}: WamanAhyaahaSystemProps) {
    const [viewMode, setViewMode] = useState<'landing' | 'guest' | 'login' | 'admin'>('landing');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [adminName, setAdminName] = useState("");        // display name shown after login
    const [adminUsername, setAdminUsername] = useState(""); // username field in form
    const [adminPass, setAdminPass] = useState("");
    const [loginError, setLoginError] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [bloodConfig, setBloodConfig] = useState<{ donorRecipients: Recipient[]; distressRecipients: Recipient[]; }>({ donorRecipients: [], distressRecipients: [] });
    const [newRecipient, setNewRecipient] = useState({ name: "", chatId: "" });
    const [activeConfigTab, setActiveConfigTab] = useState<'donors' | 'distress'>('donors');
    const [showGuide, setShowGuide] = useState(false);
    const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    // Data State
    const [activeTab, setActiveTab] = useState<'demand' | 'supply' | 'pending'>('demand'); 
    const [donors, setDonors] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false); 
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [filterGov, setFilterGov] = useState("");
    const [filterCity, setFilterCity] = useState(""); 
    const [filterBloodType, setFilterBloodType] = useState("");
    const [filterEligibleOnly, setFilterEligibleOnly] = useState(false);

    const [donorForm, setDonorForm] = useState({
        name: "", birthDate: "", age: "", phone1: "", phone2: "",
        governorate: "سوهاج", city: "", area: "", address: "",
        bloodType: "", lastDonation: "", neverDonated: false,
        hasDisease: "no", bestTime: "anytime", emergencyConsent: "yes",
        agreement: false, status: "pending", adminNotes: ""
    });

    const [requestForm, setRequestForm] = useState({
        patientName: "", bloodType: "A+", productType: "دم كامل",
        bagsCount: 1, governorate: "سوهاج", hospitalName: "",
        fileNumber: "", urgency: "عاجل الآن", contactPhone: "", notes: ""
    });

    // Init Logic
    useEffect(() => {
        if (forceGuestMode) { setViewMode('guest'); return; }
        if (standaloneAdminMode) {
            const session = localStorage.getItem("ma3wan_blood_admin");
            if (session) { setAdminName(session); setIsAuthenticated(true); setViewMode('admin'); } else { setViewMode('login'); }
            return;
        }
        if (!isPublicMode) { setViewMode('admin'); setIsAuthenticated(true); setAdminName(user.displayName || user.email); } 
        else { const session = localStorage.getItem("ma3wan_blood_admin"); if (session) { setAdminName(session); setIsAuthenticated(true); setViewMode('admin'); } }
    }, [isPublicMode, user, forceGuestMode, standaloneAdminMode]);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docSnap = await getDoc(doc(db, "app_settings", "blood_config"));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const donorRecipients = data.donorRecipients || (data.donorChatId ? [{id: Date.now().toString(), name: "Admin", chatId: data.donorChatId}] : []);
                    const distressRecipients = data.distressRecipients || (data.distressChatId ? [{id: Date.now().toString(), name: "Channel", chatId: data.distressChatId}] : []);
                    setBloodConfig({ donorRecipients, distressRecipients });
                }
            } catch (e) { console.error(e); }
        };
        fetchConfig();
    }, []);

    useEffect(() => {
        if (viewMode === 'admin') {
            setLoading(true);
            const handleError = (err: any) => { console.error(err); setError("تعذر الوصول لقاعدة البيانات."); setLoading(false); };
            const unsubDonors = onSnapshot(query(collection(db, "blood_donors"), orderBy('created_at', 'desc')), (snap) => setDonors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), handleError);
            const unsubRequests = onSnapshot(query(collection(db, "blood_requests"), orderBy('created_at', 'desc')), (snap) => { setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); }, handleError);
            return () => { unsubDonors(); unsubRequests(); };
        }
    }, [viewMode]);

    // Helpers
    const calculateAge = (dob: string) => { if (!dob) return ""; const birthDate = new Date(dob); const today = new Date(); let age = today.getFullYear() - birthDate.getFullYear(); const m = today.getMonth() - birthDate.getMonth(); if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--; return age.toString(); };
    const isDonorEligible = (lastDonationDate: string) => { if (!lastDonationDate || lastDonationDate === 'never' || lastDonationDate === '') return true; const last = new Date(lastDonationDate); const today = new Date(); const diffDays = Math.ceil(Math.abs(today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)); return diffDays >= 90; };
    const handleAddRecipient = () => { if (!newRecipient.name || !newRecipient.chatId) return; const recipient: Recipient = { id: Date.now().toString(), name: newRecipient.name, chatId: newRecipient.chatId }; if (activeConfigTab === 'donors') setBloodConfig(prev => ({...prev, donorRecipients: [...prev.donorRecipients, recipient]})); else setBloodConfig(prev => ({...prev, distressRecipients: [...prev.distressRecipients, recipient]})); setNewRecipient({ name: "", chatId: "" }); };
    const handleRemoveRecipient = (id: string, type: 'donors' | 'distress') => { if (type === 'donors') setBloodConfig(prev => ({...prev, donorRecipients: prev.donorRecipients.filter(r => r.id !== id)})); else setBloodConfig(prev => ({...prev, distressRecipients: prev.distressRecipients.filter(r => r.id !== id)})); };
    const handleSaveConfig = async () => { try { await setDoc(doc(db, "app_settings", "blood_config"), bloodConfig); alert("تم الحفظ"); setShowSettings(false); } catch (e) { alert("خطأ"); } };
    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminUsername.trim() || !adminPass.trim()) return;
        setLoginLoading(true);
        setLoginError("");
        try {
            const snap = await getDoc(doc(db, 'app_settings', 'blood_bank_users'));
            const users: any[] = snap.exists() ? (snap.data().users || []) : [];
            const matched = users.find(u => u.username === adminUsername.trim() && u.password === adminPass.trim());
            if (matched) {
                localStorage.setItem('ma3wan_blood_admin', matched.displayName);
                localStorage.setItem('ma3wan_blood_username', matched.username);
                setAdminName(matched.displayName);
                setIsAuthenticated(true);
                setViewMode('admin');
            } else {
                setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة');
            }
        } catch(e) {
            setLoginError('حدث خطأ في الاتصال بالسيرفر');
        }
        setLoginLoading(false);
    };

    const copyFormLink = () => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?view=donor_form`); alert("تم نسخ رابط الاستمارة"); };
    const copyAdminLink = () => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?view=blood_admin`); alert("تم نسخ رابط الإدارة"); };
    
    // Submit
    const handleGuestDonorSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!donorForm.agreement) { alert("الموافقة مطلوبة."); return; }
        try {
            await addDoc(collection(db, "blood_donors"), {
                ...donorForm, lastDonation: donorForm.neverDonated ? "" : donorForm.lastDonation,
                created_at: new Date().toISOString(), created_by: "Guest", source: "public_form", status: "pending"
            });
            if (onSendTelegram && telegramConfig?.rules) {
                const route = resolveWamanRoute(telegramConfig, "donors");
                if (route.chatIds.length > 0) {
                    const msg = `🩸 <b>متبرع جديد</b>\n👤 ${donorForm.name} (${donorForm.age})\n🅾️ ${donorForm.bloodType}\n📍 ${donorForm.governorate}-${donorForm.city}`;
                    sendTelegramToChatIds(onSendTelegram, route.chatIds, msg, route.botToken);
                }
            }
            setShowSuccessModal(true);
            setDonorForm({ name: "", birthDate: "", age: "", phone1: "", phone2: "", governorate: "سوهاج", city: "", area: "", address: "", bloodType: "", lastDonation: "", neverDonated: false, hasDisease: "no", bestTime: "anytime", emergencyConsent: "yes", agreement: false, status: "pending", adminNotes: "" });
        } catch (err: any) { alert("حدث خطأ أثناء التسجيل."); }
    };

    const closeSuccessModal = () => { setShowSuccessModal(false); if (!forceGuestMode) setViewMode('landing'); };
    
    // Actions
    const handleExportDonors = () => { try { const data = filteredList.map(d => ({ "Name": d.name, "Type": d.bloodType, "Phone": d.phone1, "City": d.city })); exportCsv(data, "Donors.csv"); } catch (e) { alert("Error"); } };
    const approveDonor = async (id: string, name: string) => { if(!confirm(`قبول ${name}؟`)) return; await updateDoc(doc(db, "blood_donors", id), { status: "approved" }); };
    const deleteDonor = async (id: string) => { if(!confirm("حذف المتبرع؟")) return; await deleteDoc(doc(db, "blood_donors", id)); };
    const markAsDonatedToday = async (id: string, name: string) => { if(!confirm(`تسجيل تبرع ${name} اليوم؟`)) return; await updateDoc(doc(db, "blood_donors", id), { lastDonation: new Date().toISOString().split('T')[0] }); };
    const handleAddRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, "blood_requests"), { ...requestForm, imageUrl: "", status: 'active', created_at: new Date().toISOString(), created_by: adminName });
            if (onSendTelegram && telegramConfig?.rules) {
                const route = resolveWamanRoute(telegramConfig, "distress");
                if (route.chatIds.length > 0) {
                    const msg = `🩸 <b>استغاثة عاجلة</b>\n👤 ${requestForm.patientName}\n💉 ${requestForm.productType} (${requestForm.bagsCount})\n🅾️ ${requestForm.bloodType}\n🏥 ${requestForm.hospitalName}\n📞 ${requestForm.contactPhone}`;
                    sendTelegramToChatIds(onSendTelegram, route.chatIds, msg, route.botToken);
                }
            }
            setShowForm(false);
            setRequestForm({ patientName: "", bloodType: "A+", productType: "دم كامل", bagsCount: 1, governorate: "سوهاج", hospitalName: "", fileNumber: "", urgency: "عاجل الآن", contactPhone: "", notes: "" });
        } catch (err: any) { alert("حدث خطأ."); }
    };
    const deleteRequest = async (id: string) => { if(!confirm("حذف الاستغاثة؟")) return; await deleteDoc(doc(db, "blood_requests", id)); };

    // Lists & Filters
    const pendingDonors = donors.filter(d => d.status === 'pending');
    const approvedDonors = donors.filter(d => d.status === 'approved' || d.status === 'eligible');
    const eligibleDonors = approvedDonors.filter(d => isDonorEligible(d.lastDonation));
    const activeRequests = requests.filter(r => r.status === 'active');
    const governoratesList = Array.from(new Set(approvedDonors.map(d => d.governorate).filter(Boolean))).sort();
    const allCitiesForFilter = Array.from(new Set([...SOHAG_CENTERS, ...approvedDonors.map(d => d.city).filter(Boolean)])).sort();
    
    const listToShow = activeTab === 'pending' ? pendingDonors : activeTab === 'supply' ? approvedDonors : [];
    const filteredList = listToShow.filter(d => { 
        const matchesSearch = !searchTerm || (d.name?.includes(searchTerm) || d.phone1?.includes(searchTerm) || d.city?.includes(searchTerm) || d.bloodType?.includes(searchTerm)); 
        const matchesGov = filterGov ? d.governorate === filterGov : true; 
        const matchesCity = filterCity ? d.city === filterCity : true; 
        const matchesType = filterBloodType ? d.bloodType === filterBloodType : true; 
        const matchesEligible = filterEligibleOnly ? isDonorEligible(d.lastDonation) : true; 
        return matchesSearch && matchesGov && matchesCity && matchesType && matchesEligible; 
    });

    const updateTaskCategory = () => {}; // placeholder

    if (error) return <div className="text-center p-8 text-red-500 font-bold">{error}</div>;

    // ─── VIEW: LANDING ────────────────────────────────────────────────────────
    if (viewMode === 'landing') return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 p-4">
            <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-red-500/30">
                    <Activity size={40} className="text-white"/>
                </div>
                <h2 className="text-4xl font-black text-gray-800 dark:text-white">ومن أحياها</h2>
                <p className="text-gray-400 mt-2">نظام إدارة التبرع بالدم</p>
            </div>
            <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
                <button onClick={() => setViewMode('guest')} className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 hover:opacity-90 transition">
                    <UserPlus size={20}/> تسجيل كمتبرع
                </button>
                <button onClick={() => setViewMode('login')} className="bg-gray-800 dark:bg-gray-700 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-700 transition">
                    <Lock size={20}/> دخول الإدارة
                </button>
            </div>
        </div>
    );
    
    // ─── VIEW: GUEST FORM ─────────────────────────────────────────────────────
    if (viewMode === 'guest') return (
        <div className="max-w-lg mx-auto animate-fade-in-up my-4 pb-8"> 
            {showSuccessModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl text-center shadow-2xl max-w-sm w-full mx-4">
                        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} className="text-emerald-600"/>
                        </div>
                        <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2">شكراً لك!</h3>
                        <p className="text-gray-500 text-sm mb-6">تم تسجيلك كمتبرع بنجاح. سيتواصل معك فريقنا قريباً.</p>
                        <button onClick={closeSuccessModal} className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-8 py-3 rounded-xl font-bold w-full">عودة</button>
                    </div>
                </div>
            )}
            
            {/* Form Header */}
            <div className="bg-gradient-to-br from-red-600 to-rose-700 p-6 rounded-2xl mb-4 text-white shadow-lg shadow-red-500/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black">تسجيل متبرع</h2>
                        <p className="text-red-200 text-sm mt-1">كن سبباً في إنقاذ حياة</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                            <Droplet size={28} className="text-white"/>
                        </div>
                        {!forceGuestMode && (
                            <button onClick={() => setViewMode('landing')} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition">
                                <X size={16}/>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <form onSubmit={handleGuestDonorSubmit} className="space-y-5">
                    {/* Personal Info */}
                    <div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-5 h-5 bg-red-100 text-red-600 rounded-md flex items-center justify-center text-[10px] font-black">1</span> البيانات الشخصية</h3>
                        <div className="space-y-2.5">
                            <input className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="الاسم الثلاثي *" value={donorForm.name} onChange={e=>setDonorForm({...donorForm, name:e.target.value})} required/>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" value={donorForm.birthDate} onChange={e=>{const age=calculateAge(e.target.value); setDonorForm({...donorForm, birthDate:e.target.value, age})}} required/>
                                <input className="p-3 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 dark:text-white rounded-xl text-sm text-center font-bold" placeholder="السن" value={donorForm.age ? `${donorForm.age} سنة` : ''} readOnly/>
                            </div>
                            <input className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="رقم الهاتف (واتساب) *" value={donorForm.phone1} onChange={e=>setDonorForm({...donorForm, phone1:e.target.value})} required/>
                            <input className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="رقم هاتف احتياطي" value={donorForm.phone2} onChange={e=>setDonorForm({...donorForm, phone2:e.target.value})}/>
                        </div>
                    </div>

                    {/* Address */}
                    <div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-5 h-5 bg-red-100 text-red-600 rounded-md flex items-center justify-center text-[10px] font-black">2</span> العنوان</h3>
                        <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                                <input className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="المحافظة *" value={donorForm.governorate} onChange={e=>setDonorForm({...donorForm, governorate:e.target.value})} required/>
                                <input list="sohag_centers" className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="المركز *" value={donorForm.city} onChange={e=>setDonorForm({...donorForm, city:e.target.value})} required/>
                                <datalist id="sohag_centers">{SOHAG_CENTERS.map(c => <option key={c} value={c}/>)}</datalist>
                            </div>
                            <input className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="الحي / القرية" value={donorForm.area} onChange={e=>setDonorForm({...donorForm, area:e.target.value})}/>
                        </div>
                    </div>

                    {/* Blood Info */}
                    <div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-5 h-5 bg-red-100 text-red-600 rounded-md flex items-center justify-center text-[10px] font-black">3</span> بيانات التبرع</h3>
                        <div className="space-y-2.5">
                            <div>
                                <p className="text-xs text-gray-500 mb-2 font-medium">فصيلة الدم *</p>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {BLOOD_TYPES.filter(t => t !== 'لا أعرف').map(t => {
                                        const c = BLOOD_COLORS[t];
                                        return (
                                            <button type="button" key={t} onClick={() => setDonorForm({...donorForm, bloodType: t})} className={`py-2.5 rounded-xl text-sm font-black transition border-2 ${donorForm.bloodType === t ? `bg-gradient-to-br ${c.grad} text-white border-transparent shadow-md` : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                                {t}
                                            </button>
                                        );
                                    })}
                                    <button type="button" onClick={() => setDonorForm({...donorForm, bloodType: 'لا أعرف'})} className={`col-span-4 py-2 rounded-xl text-xs font-bold transition border-2 ${donorForm.bloodType === 'لا أعرف' ? 'bg-gray-700 text-white border-transparent' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                                        لا أعرف فصيلتي
                                    </button>
                                </div>
                            </div>
                            <label className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 accent-red-600" checked={donorForm.neverDonated} onChange={e => setDonorForm({...donorForm, neverDonated: e.target.checked})}/>
                                <span className="text-sm font-medium dark:text-white">لم أتبرع من قبل</span>
                            </label>
                            {!donorForm.neverDonated && (
                                <input type="date" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="تاريخ آخر تبرع" value={donorForm.lastDonation} onChange={e=>setDonorForm({...donorForm, lastDonation:e.target.value})}/>
                            )}
                        </div>
                    </div>

                    {/* Health */}
                    <div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-5 h-5 bg-red-100 text-red-600 rounded-md flex items-center justify-center text-[10px] font-black">4</span> الحالة الصحية والموافقات</h3>
                        <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setDonorForm({...donorForm, hasDisease: 'no'})} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition ${donorForm.hasDisease === 'no' ? 'bg-emerald-500 text-white border-transparent' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500'}`}>✓ لا أعاني أمراضاً مزمنة</button>
                                <button type="button" onClick={() => setDonorForm({...donorForm, hasDisease: 'yes'})} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition ${donorForm.hasDisease === 'yes' ? 'bg-red-500 text-white border-transparent' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500'}`}>⚠ أعاني من أمراض مزمنة</button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setDonorForm({...donorForm, emergencyConsent: 'yes'})} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition ${donorForm.emergencyConsent === 'yes' ? 'bg-blue-500 text-white border-transparent' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500'}`}>موافق على الطوارئ</button>
                                <button type="button" onClick={() => setDonorForm({...donorForm, emergencyConsent: 'no'})} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition ${donorForm.emergencyConsent === 'no' ? 'bg-orange-500 text-white border-transparent' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500'}`}>غير موافق على الطوارئ</button>
                            </div>
                            <label className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl cursor-pointer border border-red-100 dark:border-red-900/30">
                                <input type="checkbox" className="w-4 h-4 accent-red-600 mt-0.5 shrink-0" checked={donorForm.agreement} onChange={e => setDonorForm({...donorForm, agreement: e.target.checked})} required/>
                                <span className="text-xs text-red-700 dark:text-red-400 font-medium leading-relaxed">أوافق على مشاركة بياناتي الشخصية مع فريق التبرع بالدم وأقر بصحة المعلومات المُدخلة *</span>
                            </label>
                        </div>
                    </div>

                    <button type="submit" disabled={!donorForm.agreement || !donorForm.bloodType} className="w-full bg-gradient-to-r from-red-600 to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black text-base shadow-lg shadow-red-500/30 hover:opacity-90 transition">
                        تسجيل التبرع 🩸
                    </button>
                </form>
            </div>
        </div>
    );

    // ─── VIEW: LOGIN ──────────────────────────────────────────────────────────
    if (viewMode === 'login') return (
        <div className="flex items-center justify-center min-h-[70vh] p-4">
            <div className="w-full max-w-sm">
                {/* Header card */}
                <div className="relative bg-gradient-to-br from-red-600 to-rose-800 p-6 rounded-3xl mb-4 text-white text-center shadow-xl shadow-red-500/30 overflow-hidden">
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none"/>
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                        <Lock size={30}/>
                    </div>
                    <h2 className="text-xl font-black">دخول الإدارة</h2>
                    <p className="text-red-200 text-xs mt-1">نظام ومن أحياها — إدارة التبرع بالدم</p>
                </div>

                {/* Form card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <form onSubmit={handleAdminLogin} className="space-y-3">
                        {/* Username */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">اسم المستخدم</label>
                            <input
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 font-mono"
                                placeholder="username"
                                dir="ltr"
                                value={adminUsername}
                                onChange={e => setAdminUsername(e.target.value)}
                                required
                                autoComplete="username"
                            />
                        </div>
                        {/* Password */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">كلمة المرور</label>
                            <input
                                type="password"
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500"
                                placeholder="••••••••"
                                value={adminPass}
                                onChange={e => setAdminPass(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {/* Error message */}
                        {loginError && (
                            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 text-xs font-bold px-3 py-2.5 rounded-xl">
                                <AlertTriangle size={13}/> {loginError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loginLoading}
                            className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white py-3 rounded-xl font-bold shadow-md shadow-red-500/20 hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {loginLoading
                                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> جاري التحقق...</>
                                : 'دخول'
                            }
                        </button>
                    </form>
                    <button onClick={() => setViewMode('guest')} className="w-full mt-3 py-2 text-xs text-gray-400 hover:text-red-600 transition font-medium">أريد التسجيل كمتبرع فقط →</button>
                </div>
            </div>
        </div>
    );


    // ─── VIEW: ADMIN ──────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 animate-fade-in-up" dir="rtl">
            
            {/* ── Gradient Dashboard Header ── */}
            <div className="relative bg-gradient-to-l from-red-600 via-rose-700 to-red-800 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_70%)]"/>
                <div className="relative px-4 pt-4 pb-0">
                    {/* Title Row */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                                <Activity size={20} className="text-white"/>
                            </div>
                            <div>
                                <h1 className="font-black text-white text-base leading-tight">ومن أحياها</h1>
                                <p className="text-red-200 text-[10px]">إدارة التبرع بالدم</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button onClick={copyFormLink} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition" title="نسخ رابط الاستمارة"><Share2 size={15}/></button>
                            {!standaloneAdminMode && <button onClick={copyAdminLink} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-yellow-200 transition" title="رابط الإدارة"><Shield size={15}/></button>}
                            {isSuperAdmin && <button onClick={() => setShowSettings(true)} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition"><Settings size={15}/></button>}
                        </div>
                    </div>

                    {/* Live Stats Row */}
                    <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
                        <StatCard icon={Droplet}    label="إجمالي المتبرعين"  value={approvedDonors.length}  color="from-white/20 to-white/10" sub="مسجل"/>
                        <StatCard icon={Zap}         label="متاحون الآن"       value={eligibleDonors.length}  color="from-white/20 to-white/10" sub="جاهز للتبرع"/>
                        <StatCard icon={AlertTriangle} label="استغاثات نشطة"  value={activeRequests.length}  color="from-white/20 to-white/10" sub="تحتاج دماً"/>
                        <StatCard icon={UserCheck}   label="طلبات انضمام"      value={pendingDonors.length}   color="from-white/20 to-white/10" sub="بانتظار القبول"/>
                    </div>

                    {/* Tab Switcher — pills on gradient */}
                    <div className="flex gap-1 pb-0">
                        {[
                            { id: 'demand',  label: 'الاستغاثات',        count: activeRequests.length,  icon: AlertTriangle },
                            { id: 'supply',  label: 'سجل المتبرعين',     count: approvedDonors.length,  icon: Droplet },
                            { id: 'pending', label: 'طلبات الانضمام',    count: pendingDonors.length,   icon: UserCheck },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs font-bold transition relative ${activeTab === tab.id ? 'bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                            >
                                <tab.icon size={13}/>
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center ${activeTab === tab.id ? 'bg-red-100 text-red-700' : 'bg-white/20 text-white'}`}>{tab.count}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-3 sm:p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] animate-fade-in-up flex flex-col">
                        {/* Modal Header */}
                        <div className="relative bg-gradient-to-br from-red-600 to-rose-700 p-5 pb-8 overflow-hidden shrink-0">
                            <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"/>
                            <button onClick={() => setShowSettings(false)} className="absolute top-4 left-4 w-7 h-7 bg-white/20 hover:bg-white/30 flex items-center justify-center rounded-full text-white transition"><X size={14}/></button>
                            <div className="text-center">
                                <div className="w-14 h-14 bg-white/20 border-2 border-white/40 rounded-2xl flex items-center justify-center mx-auto mb-2 text-white shadow-lg"><Settings size={26}/></div>
                                <p className="text-white font-black text-base">إعدادات الإشعارات</p>
                                <p className="text-red-200 text-xs mt-0.5">إدارة مستقبلي التنبيهات</p>
                            </div>
                        </div>
                        <div className="mx-4 my-4 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800 space-y-4 custom-scrollbar">
                            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                                <button onClick={() => setActiveConfigTab('donors')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${activeConfigTab === 'donors' ? 'bg-white dark:bg-gray-600 shadow text-red-600' : 'text-gray-500'}`}>🩸 متبرعون</button>
                                <button onClick={() => setActiveConfigTab('distress')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${activeConfigTab === 'distress' ? 'bg-white dark:bg-gray-600 shadow text-red-600' : 'text-gray-500'}`}>🆘 استغاثات</button>
                            </div>
                            <div className="flex gap-2">
                                <input className="flex-1 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500" placeholder="الاسم" value={newRecipient.name} onChange={e=>setNewRecipient({...newRecipient, name:e.target.value})}/>
                                <input className="flex-1 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500" placeholder="Chat ID" value={newRecipient.chatId} onChange={e=>setNewRecipient({...newRecipient, chatId:e.target.value})}/>
                                <button onClick={handleAddRecipient} className="w-9 h-9 bg-red-600 text-white rounded-xl flex items-center justify-center hover:bg-red-700 transition shrink-0"><Plus size={16}/></button>
                            </div>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                                {(activeConfigTab === 'donors' ? bloodConfig.donorRecipients : bloodConfig.distressRecipients).map((r, idx) => (
                                    <div key={`${r.id}-${idx}`} className="flex justify-between bg-gray-50 dark:bg-gray-700 p-2.5 rounded-xl items-center">
                                        <span className="text-sm dark:text-white font-medium">{r.name}</span>
                                        <button onClick={() => handleRemoveRecipient(r.id, activeConfigTab)} className="text-red-400 hover:text-red-600 transition p-1"><UserMinus size={14}/></button>
                                    </div>
                                ))}
                                {(activeConfigTab === 'donors' ? bloodConfig.donorRecipients : bloodConfig.distressRecipients).length === 0 && (
                                    <p className="text-center text-xs text-gray-400 py-4">لا يوجد مستلمون مضافون</p>
                                )}
                            </div>
                            <button onClick={handleSaveConfig} className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white py-3 rounded-xl font-bold shadow-md shadow-red-500/20 hover:opacity-90 transition">حفظ الإعدادات</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Content ── */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                {/* ── TAB: Demand (Requests) ── */}
                {activeTab === 'demand' && (
                    <div className="space-y-4">
                        {/* Add Request Button */}
                        <button
                            onClick={() => setShowForm(true)}
                            className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 hover:opacity-90 transition"
                        >
                            <Plus size={20}/> إضافة استغاثة جديدة
                        </button>

                        {/* Request Form Modal */}
                        {showForm && (
                            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4" onClick={() => setShowForm(false)}>
                                <div className="bg-white dark:bg-gray-900 w-full md:max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden max-h-[calc(100dvh-1rem)] md:max-h-[calc(100dvh-2rem)] shadow-2xl animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
                                    {/* Modal Header */}
                                    <div className="relative bg-gradient-to-br from-red-600 to-rose-700 p-5 pb-8 overflow-hidden shrink-0">
                                        <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"/>
                                        <button onClick={() => setShowForm(false)} className="absolute top-4 left-4 w-7 h-7 bg-white/20 hover:bg-white/30 flex items-center justify-center rounded-full text-white transition"><X size={14}/></button>
                                        <div className="text-center">
                                            <div className="w-14 h-14 bg-white/20 border-2 border-white/40 rounded-2xl flex items-center justify-center mx-auto mb-2 text-white shadow-lg"><Ambulance size={26}/></div>
                                            <p className="text-white font-black text-base">استغاثة جديدة</p>
                                            <p className="text-red-200 text-xs mt-0.5">أدخل بيانات الحالة</p>
                                        </div>
                                    </div>
                                    <div className="mx-4 my-4 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800 custom-scrollbar">
                                        <form onSubmit={handleAddRequest} className="space-y-3">
                                            <input required className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="اسم المريض *" value={requestForm.patientName} onChange={e => setRequestForm({...requestForm, patientName: e.target.value})}/>
                                            
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">فصيلة الدم *</p>
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    {BLOOD_TYPES.filter(t => t !== 'لا أعرف').map(t => {
                                                        const c = BLOOD_COLORS[t];
                                                        return <button type="button" key={t} onClick={() => setRequestForm({...requestForm, bloodType: t})} className={`py-2.5 rounded-xl text-xs font-black transition border-2 ${requestForm.bloodType === t ? `bg-gradient-to-br ${c.grad} text-white border-transparent` : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500'}`}>{t}</button>;
                                                    })}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <select className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500" value={requestForm.productType} onChange={e => setRequestForm({...requestForm, productType: e.target.value})}>{PRODUCT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
                                                <input type="number" min="1" className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="عدد الأكياس" value={requestForm.bagsCount} onChange={e => setRequestForm({...requestForm, bagsCount: Number(e.target.value)})}/>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input required className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="المستشفى *" value={requestForm.hospitalName} onChange={e => setRequestForm({...requestForm, hospitalName: e.target.value})}/>
                                                <input className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="المحافظة" value={requestForm.governorate} onChange={e => setRequestForm({...requestForm, governorate: e.target.value})}/>
                                            </div>
                                            <select className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm font-bold text-red-600 outline-none focus:ring-2 focus:ring-red-500" value={requestForm.urgency} onChange={e => setRequestForm({...requestForm, urgency: e.target.value})}>{URGENCY_LEVELS.map(t=><option key={t} value={t}>{t}</option>)}</select>
                                            <input required className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="رقم التواصل *" value={requestForm.contactPhone} onChange={e => setRequestForm({...requestForm, contactPhone: e.target.value})}/>
                                            <textarea rows={2} className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none" placeholder="ملاحظات إضافية..." value={requestForm.notes} onChange={e => setRequestForm({...requestForm, notes: e.target.value})}/>
                                            <button className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white py-3.5 rounded-xl font-black shadow-lg shadow-red-500/30 hover:opacity-90 transition">نشر الاستغاثة 🆘</button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Requests List */}
                        {requests.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                                <Droplet size={40} className="text-gray-200 mx-auto mb-3"/>
                                <p className="text-gray-400 font-bold">لا توجد استغاثات حالياً</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {requests.map((req, idx) => <RequestCard key={`${req.id}-${idx}`} req={req} deleteRequest={deleteRequest}/>)}
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: Supply & Pending (Donors) ── */}
                {(activeTab === 'supply' || activeTab === 'pending') && (
                    <div className="space-y-4">
                        {/* Search + Filter Bar */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-3 space-y-3 shadow-sm">
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/>
                                <input className="w-full p-2.5 pr-9 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="بحث بالاسم، الهاتف، أو المدينة..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                            </div>

                            {/* Blood Type Pills */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                                <button onClick={() => setFilterBloodType("")} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition shrink-0 ${!filterBloodType ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>الكل</button>
                                {BLOOD_TYPES.filter(t => t !== 'لا أعرف').map(t => {
                                    const c = BLOOD_COLORS[t];
                                    const isActive = filterBloodType === t;
                                    return (
                                        <button key={t} onClick={() => setFilterBloodType(isActive ? "" : t)} className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition shrink-0 border ${isActive ? `bg-gradient-to-br ${c.grad} text-white border-transparent shadow-md` : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                            {t}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Additional Filters */}
                            <div className="flex gap-2 flex-wrap">
                                <select className="flex-1 min-w-[100px] p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl text-xs outline-none" value={filterCity} onChange={e => setFilterCity(e.target.value)}>
                                    <option value="">كل المراكز</option>
                                    {allCitiesForFilter.map((c: any) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button onClick={() => setFilterEligibleOnly(!filterEligibleOnly)} className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${filterEligibleOnly ? 'bg-emerald-500 text-white border-transparent' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                                    {filterEligibleOnly ? '✓ ' : ''}متاح للتبرع
                                </button>
                                {(filterBloodType || filterCity || filterEligibleOnly || searchTerm) && (
                                    <button onClick={() => { setFilterBloodType(""); setFilterCity(""); setFilterEligibleOnly(false); setSearchTerm(""); }} className="px-3 py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 transition">
                                        <X size={12} className="inline"/> مسح
                                    </button>
                                )}
                            </div>

                            {/* Export Button */}
                            {activeTab === 'supply' && (
                                <button onClick={handleExportDonors} className="w-full py-2 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 transition flex items-center justify-center gap-1.5">
                                    <Download size={13}/> تصدير Excel ({filteredList.length} متبرع)
                                </button>
                            )}
                        </div>

                        {/* Results Count */}
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 font-medium">
                                {filteredList.length} نتيجة {filteredList.length !== listToShow.length ? `من ${listToShow.length}` : ''}
                            </p>
                        </div>

                        {/* Donors Grid */}
                        {filteredList.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                                <Droplet size={40} className="text-gray-200 mx-auto mb-3"/>
                                <p className="text-gray-400 font-bold">لا توجد نتائج</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {filteredList.map((donor, idx) => (
                                    <DonorCard
                                        key={`${donor.id}-${idx}`}
                                        donor={donor}
                                        activeTab={activeTab}
                                        approveDonor={approveDonor}
                                        deleteDonor={deleteDonor}
                                        markAsDonatedToday={markAsDonatedToday}
                                        isDonorEligible={isDonorEligible}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Internal Tasks Section ── */}
                {!standaloneAdminMode && (
                    <div className="mt-8 pt-6 border-t-2 border-gray-200 dark:border-gray-700 pb-24">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                                <Briefcase size={18} className="text-white"/>
                            </div>
                            <h3 className="text-lg font-black text-gray-800 dark:text-white">المهام الداخلية</h3>
                        </div>
                        <TaskBoard 
                            activeDeptId="waman_ahyaaha" 
                            tasks={tasks} 
                            newTask={newTask} 
                            setNewTask={setNewTask} 
                            handleAddTask={handleAddTask} 
                            toggleStatus={toggleStatus} 
                            deleteTask={deleteTask} 
                            setSelectedTask={setSelectedTask} 
                            updateTaskCategory={updateTaskCategory}
                            user={user} 
                            onOpenAddTask={onOpenAddTask}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
