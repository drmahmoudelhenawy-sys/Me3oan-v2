import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, collection, addDoc, deleteDoc, query, orderBy, writeBatch, getDoc } from "firebase/firestore";
import { 
    Palette, Save, Edit, Check, X, Layout, BookOpen, Image as ImageIcon,
    Type, Download, Layers, ChevronDown, ChevronUp, Plus, Trash2,
    CornerDownRight, Circle, Pen, Brush, Box, Grid, Brain, Bone,
    Stethoscope, Microscope, Beaker, Dna, Activity, Scan, Pill, Syringe,
    Glasses, Calculator, Globe, Cpu, Briefcase, Upload, Database, AlertTriangle, Folder, Link as LinkIcon, Sliders, Droplet,
    Copy, Megaphone, Heart, Users, Crown, Network, Sun, Moon
} from "lucide-react";
import { DEPARTMENTS, SUPER_ADMIN_EMAIL } from "../utils/constants";

// List of icons available for subjects
const SUBJECT_ICONS = [
    { id: 'book', icon: BookOpen, label: 'عام' },
    { id: 'anatomy', icon: Bone, label: 'تشريح' },
    { id: 'physio', icon: Activity, label: 'فسيولوجي' },
    { id: 'neuro', icon: Brain, label: 'أعصاب' },
    { id: 'micro', icon: Microscope, label: 'ميكرو' },
    { id: 'chem', icon: Beaker, label: 'كيمياء' },
    { id: 'pharma', icon: Pill, label: 'فارما' },
    { id: 'dna', icon: Dna, label: 'جينات' },
    { id: 'radio', icon: Scan, label: 'أشعة' },
    { id: 'clinic', icon: Stethoscope, label: 'كلينيكال' },
    { id: 'surgery', icon: Syringe, label: 'جراحة' },
    { id: 'tech', icon: Cpu, label: 'تكنولوجيا' },
    { id: 'calc', icon: Calculator, label: 'رياضيات' },
    { id: 'lang', icon: Globe, label: 'لغات' },
];

// --- MEDICAL CURRICULUM DATA (Arabic) ---
const BASIC_SCIENCES_SUBS = [
    { name: "Anatomy (تشريح)", color: "#ef4444" },
    { name: "Histology (أنسجة)", color: "#f97316" },
    { name: "Physiology (فسيولوجي)", color: "#eab308" },
    { name: "Biochemistry (كيمياء حيوية)", color: "#84cc16" },
    { name: "Pharmacology (أدوية)", color: "#06b6d4" },
    { name: "Pathology (أمراض)", color: "#8b5cf6" },
    { name: "Microbiology (ميكروبيولوجي)", color: "#ec4899" },
    { name: "Parasitology (طفيليات)", color: "#10b981" },
];

const FULL_YEAR_1_SUBJECTS = [
    { name: "Anatomy (تشريح)", iconId: "anatomy", color: "#ef4444" },
    { name: "Histology (أنسجة)", iconId: "micro", color: "#f97316" },
    { name: "Physiology (فسيولوجي)", iconId: "physio", color: "#eab308" },
    { name: "Biochemistry (كيمياء حيوية)", iconId: "chem", color: "#84cc16" },
    { name: "Pharmacology (أدوية)", iconId: "pharma", color: "#06b6d4" },
    { name: "Pathology (أمراض)", iconId: "book", color: "#8b5cf6" },
    { name: "Microbiology (ميكروبيولوجي)", iconId: "micro", color: "#ec4899" },
    { name: "Parasitology (طفيليات)", iconId: "book", color: "#10b981" },
];

// --- CUSTOM DEPT THEMES (For Dazzling UI) ---
const getDeptTheme = (deptId: string) => {
    switch (deptId) {
        case 'educational':
            return {
                gradient: "from-yellow-400 to-orange-500",
                shadow: "shadow-orange-500/40",
                iconBg: "bg-orange-100 text-orange-600",
                border: "border-orange-400",
                class3d: "rotate-1 hover:rotate-0"
            };
        case 'medical':
            return {
                gradient: "from-rose-400 to-pink-600",
                shadow: "shadow-pink-500/40",
                iconBg: "bg-pink-100 text-pink-600",
                border: "border-pink-400",
                class3d: "-rotate-1 hover:rotate-0"
            };
        case 'dawah':
            return {
                gradient: "from-emerald-400 to-teal-600",
                shadow: "shadow-teal-500/40",
                iconBg: "bg-teal-100 text-teal-600",
                border: "border-teal-400",
                class3d: "rotate-1 hover:rotate-0"
            };
        case 'charity':
            return {
                gradient: "from-sky-400 to-blue-600",
                shadow: "shadow-blue-500/40",
                iconBg: "bg-blue-100 text-blue-600",
                border: "border-blue-400",
                class3d: "-rotate-1 hover:rotate-0"
            };
        case 'art':
            return {
                gradient: "from-violet-400 to-purple-600",
                shadow: "shadow-purple-500/40",
                iconBg: "bg-purple-100 text-purple-600",
                border: "border-purple-400",
                class3d: "rotate-2 hover:rotate-0"
            };
        case 'hr':
            return {
                gradient: "from-amber-400 to-orange-600",
                shadow: "shadow-amber-500/40",
                iconBg: "bg-amber-100 text-amber-600",
                border: "border-amber-400",
                class3d: "-rotate-2 hover:rotate-0"
            };
        case 'waman_ahyaaha':
            return {
                gradient: "from-red-500 to-rose-700",
                shadow: "shadow-red-500/40",
                iconBg: "bg-red-100 text-red-600",
                border: "border-red-400",
                class3d: "scale-105 hover:scale-100"
            };
        case 'management':
            return {
                gradient: "from-slate-700 to-slate-900",
                shadow: "shadow-slate-500/40",
                iconBg: "bg-yellow-100 text-yellow-600",
                border: "border-yellow-400",
                class3d: ""
            };
        default:
            return {
                gradient: "from-gray-400 to-gray-600",
                shadow: "shadow-gray-500/40",
                iconBg: "bg-gray-100 text-gray-600",
                border: "border-gray-400",
                class3d: ""
            };
    }
};

// --- Reusable Components ---

const ColorDisplay = ({ color, label, size = "md" }: { color: string, label?: string, size?: "sm" | "md" }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(color);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : "w-10 h-10 text-xs";

    return (
        <div className="flex items-center gap-3 group cursor-pointer" onClick={handleCopy} title="نسخ الكود">
            <div className={`relative ${sizeClass} rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 shrink-0 overflow-hidden`}>
                <div className="absolute inset-0" style={{ backgroundColor: color }}></div>
            </div>
            <div className="flex flex-col">
                {label && <span className="font-bold text-gray-700 dark:text-gray-200 text-sm leading-tight">{label}</span>}
                <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                    <span className="font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 text-xs">{color}</span>
                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
                </div>
            </div>
        </div>
    );
};

export default function IdentitySystem({ user, userProfile, isPublicView = false }: { user: any, userProfile?: any, isPublicView?: boolean }) {
    const isOwner = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() || userProfile?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const [activeTab, setActiveTab] = useState<'brand' | 'departments' | 'educational'>('brand');
    const [dataError, setDataError] = useState<string | null>(null);

    // --- State: General Brand ---
    const [brandConfig, setBrandConfig] = useState<any>({
        logoUrl: "https://od.lk/s/ODZfNzM1MTAwOTVf/%D9%84%D9%88%D8%AC%D9%88%20%D9%85%D8%B9%D9%88%D8%A7%D9%86.png", 
        primaryColor: "#4f46e5",
        secondaryColor: "#10b981",
        accentColor: "#f59e0b",
        mainFontName: "Cairo",
        mainFontUrl: "",
        authLogoSize: 112, 
        navLogoSize: 64,   
        invertInDarkMode: true,
        additionalLogos: [],
        allowedEditors: [] 
    });
    
    const safeAllowedEditors = Array.isArray(brandConfig.allowedEditors) ? brandConfig.allowedEditors : [];
    const safeAdditionalLogos = Array.isArray(brandConfig.additionalLogos) ? brandConfig.additionalLogos : [];
    const canEdit = isOwner || safeAllowedEditors.includes(user?.email) || userProfile?.canEditIdentity;
    const [isEditingBrand, setIsEditingBrand] = useState(false);
    const [newEditorEmail, setNewEditorEmail] = useState("");
    
    // State for Adding New Logo to Library
    const [newLogo, setNewLogo] = useState({ name: "", url: "" });

    // --- State: Departments Identity ---
    const [deptIdentities, setDeptIdentities] = useState<Record<string, any>>({});
    const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
    const [tempDeptData, setTempDeptData] = useState<any>({});

    // --- State: Educational ---
    const [years, setYears] = useState<any[]>([]);
    const [expandedYear, setExpandedYear] = useState<string | null>(null);
    const [newYearName, setNewYearName] = useState("");
    
    // Add Subject Form State
    const [showAddSubject, setShowAddSubject] = useState<string | null>(null); // Year ID
    const [newSubject, setNewSubject] = useState<{
        name: string;
        color: string;
        iconId: string;
        customIconUrl?: string;
        type: 'single' | 'grouped';
        subSubjects: {name: string, color: string}[];
    }>({ 
        name: "", 
        color: "#3b82f6", 
        iconId: "book",
        customIconUrl: "",
        type: 'single', 
        subSubjects: [] 
    });
    const [tempSubSubject, setTempSubSubject] = useState({ name: "", color: "#ef4444" });

    // Edit Subject State
    const [editingSubject, setEditingSubject] = useState<{ yearId: string, data: any } | null>(null);

    // --- Load Data ---
    useEffect(() => {
        const handleError = (err: any) => {
            console.error("IdentitySystem Access Error:", err);
            setDataError("تعذر الوصول للبيانات.");
        };

        const unsubBrand = onSnapshot(doc(db, "app_settings", "brand_identity"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setBrandConfig({ 
                    ...data, 
                    additionalLogos: Array.isArray(data.additionalLogos) ? data.additionalLogos : [],
                    authLogoSize: data.authLogoSize || 112,
                    navLogoSize: data.navLogoSize || 64,
                    invertInDarkMode: data.invertInDarkMode !== undefined ? data.invertInDarkMode : true,
                    allowedEditors: Array.isArray(data.allowedEditors) ? data.allowedEditors : []
                });
            }
        }, handleError);
        
        const unsubDepts = onSnapshot(doc(db, "app_settings", "dept_identities"), (doc) => {
            if (doc.exists()) setDeptIdentities(doc.data());
        }, handleError);
        
        const qYears = query(collection(db, "edu_identity_years"), orderBy("createdAt", "asc"));
        const unsubYears = onSnapshot(qYears, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setYears(data);
        }, handleError);

        return () => { unsubBrand(); unsubDepts(); unsubYears(); };
    }, []);

    // --- Handlers (Same as before) ---
    // ... (Handlers kept compact for brevity) ...
    const saveBrandConfig = async () => { await setDoc(doc(db, "app_settings", "brand_identity"), brandConfig); setIsEditingBrand(false); alert("تم الحفظ"); };
    const addLogoToLibrary = () => { if (!newLogo.name || !newLogo.url) return; setBrandConfig({ ...brandConfig, additionalLogos: [...safeAdditionalLogos, newLogo] }); setNewLogo({ name: "", url: "" }); };
    const removeLogoFromLibrary = (idx: number) => { const updated = [...safeAdditionalLogos]; updated.splice(idx, 1); setBrandConfig({ ...brandConfig, additionalLogos: updated }); };
    const handleDownloadImage = async (url: string, filename: string) => { window.open(url, '_blank'); };
    const startEditDept = (deptId: string) => { setEditingDeptId(deptId); setTempDeptData(deptIdentities[deptId] || { color: "#000000", fontName: "", fontUrl: "" }); };
    const saveDeptIdentity = async (deptId: string) => { await setDoc(doc(db, "app_settings", "dept_identities"), { ...deptIdentities, [deptId]: tempDeptData }); setEditingDeptId(null); };
    const addYear = async (e: React.FormEvent) => { e.preventDefault(); if (!newYearName.trim()) return; await addDoc(collection(db, "edu_identity_years"), { name: newYearName, createdAt: Date.now(), subjects: [] }); setNewYearName(""); };
    const deleteYear = async (id: string) => { if (!confirm("حذف السنة؟")) return; await deleteDoc(doc(db, "edu_identity_years", id)); };
    const addSubSubjectToTemp = () => { if (!tempSubSubject.name) return; setNewSubject({ ...newSubject, subSubjects: [...newSubject.subSubjects, tempSubSubject] }); setTempSubSubject({ name: "", color: "#ef4444" }); };
    const removeSubSubjectFromTemp = (idx: number) => { const updated = [...newSubject.subSubjects]; updated.splice(idx, 1); setNewSubject({ ...newSubject, subSubjects: updated }); };
    const saveSubject = async (yearId: string) => { if (!newSubject.name) return; const subjectData = { id: Date.now().toString(), ...newSubject }; const yearRef = doc(db, "edu_identity_years", yearId); await updateDoc(yearRef, { subjects: arrayUnion(subjectData) }); setShowAddSubject(null); setNewSubject({ name: "", color: "#3b82f6", iconId: "book", customIconUrl: "", type: 'single', subSubjects: [] }); };
    const openEditSubject = (yearId: string, subject: any) => { setEditingSubject({ yearId, data: subject }); };
    const handleUpdateSubject = async () => { if (!editingSubject) return; const yearRef = doc(db, "edu_identity_years", editingSubject.yearId); const yearDoc = await getDoc(yearRef); if (yearDoc.exists()) { const updatedSubjects = yearDoc.data().subjects.map((sub: any) => sub.id === editingSubject.data.id ? editingSubject.data : sub); await updateDoc(yearRef, { subjects: updatedSubjects }); setEditingSubject(null); alert("تم التحديث"); } };
    const deleteSubject = async (yearId: string, subject: any) => { if(!confirm("حذف؟")) return; const yearRef = doc(db, "edu_identity_years", yearId); await updateDoc(yearRef, { subjects: arrayRemove(subject) }); };
    const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            if (editingSubject) {
                setEditingSubject({ ...editingSubject, data: { ...editingSubject.data, customIconUrl: reader.result as string, iconId: 'custom' } });
            } else {
                setNewSubject({ ...newSubject, customIconUrl: reader.result as string, iconId: 'custom' });
            }
        };
        reader.readAsDataURL(file);
    };
    const seedMedicalCurriculum = async () => { if (!confirm("تأكيد الإضافة التلقائية؟")) return; const batch = writeBatch(db); const timestamp = Date.now(); batch.set(doc(collection(db, "edu_identity_years")), { name: "الفرقة الأولى (Year 1)", createdAt: timestamp, subjects: FULL_YEAR_1_SUBJECTS.map((s, i) => ({ id: `y1_${i}`, name: s.name, color: s.color, iconId: s.iconId, type: 'single', subSubjects: [] })) }); batch.set(doc(collection(db, "edu_identity_years")), { name: "الفرقة الثانية (Year 2)", createdAt: timestamp + 1, subjects: ["SMY", "HIC", "ERD", "VERTICAL (IPC)", "GIT", "CVS", "HEM"].map((b, i) => ({ id: `y2_${i}`, name: b, color: "#3b82f6", iconId: "book", type: 'grouped', subSubjects: BASIC_SCIENCES_SUBS })) }); batch.set(doc(collection(db, "edu_identity_years")), { name: "الفرقة الثالثة - أكاديمي (Year 3)", createdAt: timestamp + 2, subjects: ["RESPIRATORY", "RENAL", "CNS"].map((b, i) => ({ id: `y3a_${i}`, name: b, color: "#8b5cf6", iconId: "book", type: 'grouped', subSubjects: BASIC_SCIENCES_SUBS })) }); await batch.commit(); alert("تم"); };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewLogo({ ...newLogo, url: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    const addEditor = async () => {
        if (!newEditorEmail || !newEditorEmail.includes('@')) return;
        const updatedEditors = [...safeAllowedEditors, newEditorEmail.trim()];
        setBrandConfig({ ...brandConfig, allowedEditors: updatedEditors });
        setNewEditorEmail("");
        await updateDoc(doc(db, "app_settings", "brand_identity"), { allowedEditors: updatedEditors });
    };

    const removeEditor = async (email: string) => {
        const updatedEditors = safeAllowedEditors.filter((e: string) => e !== email);
        setBrandConfig({ ...brandConfig, allowedEditors: updatedEditors });
        await updateDoc(doc(db, "app_settings", "brand_identity"), { allowedEditors: updatedEditors });
    };

    // --- Editor Components ---
    const ColorPicker = ({ label, color, onChange, readOnly }: any) => (
        <div className="flex flex-col gap-2 w-full">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/50 p-2 rounded-xl border border-gray-200 dark:border-slate-700">
                <div className="relative w-12 h-12 rounded-lg shadow-sm overflow-hidden border border-gray-300 dark:border-slate-600 shrink-0">
                    <div className="absolute inset-0" style={{ backgroundColor: color }}></div>
                    {!readOnly && <input type="color" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={color} onChange={(e) => onChange(e.target.value)} />}
                </div>
                <div className="flex-1 flex justify-between items-center bg-white dark:bg-slate-900/50 rounded-lg px-3 py-2 border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs font-mono">#</span>
                        {!readOnly ? (
                            <input type="text" className="w-full bg-transparent text-sm font-mono font-bold uppercase outline-none text-gray-800 dark:text-white" value={color.replace('#', '')} onChange={(e) => { const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6); onChange(`#${val}`); }} />
                        ) : (
                            <span className="text-sm font-mono font-bold text-gray-800 dark:text-white uppercase">{color.replace('#', '')}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const IconPicker = ({ selected, onChange }: { selected: string, onChange: (id: string) => void }) => (
        <div className="p-1">
            <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                {SUBJECT_ICONS.map(item => (
                    <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border ${selected === item.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-200 dark:hover:bg-slate-600'}`} title={item.label}>
                        <item.icon size={18} />
                    </button>
                ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-600">
                <label className="flex items-center justify-center gap-2 cursor-pointer p-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 transition w-full">
                    <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} /> <Upload size={14} /> رفع أيقونة
                </label>
            </div>
        </div>
    );

    const TabButton = ({ id, icon: Icon, label }: any) => (
        <button 
            onClick={() => setActiveTab(id)} 
            className={`relative px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 overflow-hidden group whitespace-nowrap shrink-0 border ${activeTab === id ? 'text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xl shadow-indigo-900/30 border-transparent scale-105' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-800 border-transparent'}`}
        >
            <Icon size={18} className={`relative z-10 transition-transform ${activeTab === id ? 'scale-110' : ''}`} />
            <span className="relative z-10">{label}</span>
        </button>
    );

    if (dataError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
                <AlertTriangle size={48} className="text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">خطأ في الاتصال</h3>
                <p className="text-gray-500 dark:text-slate-400 max-w-md">{dataError}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen font-sans pb-20 -m-4 md:-m-8 p-4 md:p-8 overflow-x-hidden relative bg-gray-50 dark:bg-[#020617] text-gray-800 dark:text-slate-200 transition-colors duration-300">
            {/* Ambient Background Effects */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-200/20 dark:bg-indigo-600/10 rounded-full blur-[150px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-200/20 dark:bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '2s'}}></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] dark:opacity-[0.05]"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-8 mb-12 animate-fade-in-up">
                    <div className="text-center md:text-right space-y-4">
                        <div className="inline-flex items-center gap-2 bg-white/70 dark:bg-slate-800/80 px-4 py-1.5 rounded-full border border-indigo-100 dark:border-slate-700/50 backdrop-blur-md shadow-sm">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                            </span>
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-200 uppercase tracking-[0.2em]">نظام الهوية البصرية</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                            Identity <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500">Hub</span>
                        </h1>
                        <p className="text-gray-500 dark:text-slate-400 text-sm md:text-lg max-w-lg mx-auto md:mx-0 font-medium leading-relaxed">
                            المرجع الشامل لأصول العلامة التجارية، الألوان، وأنظمة التصميم لفريق معوان.
                        </p>
                    </div>
                    
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 blur-2xl rounded-full opacity-20 dark:opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
                        <div className="relative w-32 h-32 md:w-40 md:h-40 bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2rem] border border-gray-100 dark:border-slate-700/50 flex items-center justify-center shadow-2xl transform rotate-3 group-hover:rotate-0 transition-all duration-500 group-hover:scale-105">
                            <img src={brandConfig.logoUrl} alt="Logo" className="w-20 md:w-24 object-contain drop-shadow-xl dark:brightness-0 dark:invert opacity-95" />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="sticky top-4 z-40 mb-10 flex justify-center md:justify-start">
                    <div className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-2xl p-2 rounded-[1.5rem] border border-gray-200 dark:border-slate-800 shadow-xl flex gap-2 overflow-x-auto no-scrollbar max-w-full">
                        <TabButton id="brand" icon={Box} label="الهوية العامة" />
                        <TabButton id="departments" icon={Grid} label="الأقسام" />
                        <TabButton id="educational" icon={BookOpen} label="التعليمي" />
                    </div>
                </div>

                {/* Content */}
                <div className="animate-fade-in-up">
                    {/* --- BRAND TAB --- */}
                    {activeTab === 'brand' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Logo Card */}
                                <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2rem] p-8 border border-gray-100 dark:border-slate-700/50 shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition duration-500 transform group-hover:scale-110"><Layout size={150} /></div>
                                    <div className="flex justify-between items-center mb-8 relative z-10">
                                        <h3 className="font-bold text-2xl text-gray-800 dark:text-white flex items-center gap-3"><Layout size={24} className="text-indigo-500"/> الشعار الرئيسي</h3>
                                        {canEdit && !isEditingBrand && <button onClick={() => setIsEditingBrand(true)} className="p-3 bg-gray-100 dark:bg-slate-700/50 hover:bg-indigo-600 rounded-2xl text-gray-500 dark:text-slate-300 hover:text-white transition shadow-lg"><Pen size={16}/></button>}
                                    </div>

                                    {isEditingBrand ? (
                                        <div className="space-y-4 relative z-10 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-gray-200 dark:border-slate-700/50 shadow-inner">
                                            {/* Edit Fields (Simplified for brevity) */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-gray-500 dark:text-slate-400 uppercase font-bold">Logo URL</label>
                                                <input className="w-full p-4 text-xs bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 focus:border-indigo-500 outline-none text-gray-800 dark:text-white font-mono" value={brandConfig.logoUrl} onChange={e => setBrandConfig({...brandConfig, logoUrl: e.target.value})} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-700"><span className="text-[9px] text-gray-500 dark:text-slate-400 block mb-1">Nav Size</span><input type="number" className="w-full bg-transparent text-gray-800 dark:text-white font-bold text-center outline-none" value={brandConfig.navLogoSize} onChange={e => setBrandConfig({...brandConfig, navLogoSize: Number(e.target.value)})} /></div>
                                                <div className="bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-700"><span className="text-[9px] text-gray-500 dark:text-slate-400 block mb-1">Auth Size</span><input type="number" className="w-full bg-transparent text-gray-800 dark:text-white font-bold text-center outline-none" value={brandConfig.authLogoSize} onChange={e => setBrandConfig({...brandConfig, authLogoSize: Number(e.target.value)})} /></div>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
                                                <input type="checkbox" checked={brandConfig.invertInDarkMode} onChange={e => setBrandConfig({...brandConfig, invertInDarkMode: e.target.checked})} className="w-4 h-4 accent-indigo-500 rounded cursor-pointer" /> 
                                                <span className="text-xs text-gray-600 dark:text-slate-300 font-bold">Invert in Dark Mode (White Logo)</span>
                                            </div>
                                            <button onClick={saveBrandConfig} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm mt-2 hover:bg-indigo-500 shadow-lg shadow-indigo-900/50 transition">حفظ التغييرات</button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-8 relative z-10 bg-white/50 dark:bg-slate-900/30 rounded-3xl border border-gray-100 dark:border-white/5">
                                            <img src={brandConfig.logoUrl} alt="Logo" style={{ height: `${brandConfig.navLogoSize * 1.5}px` }} className={`object-contain transition-all duration-500 ${brandConfig.invertInDarkMode ? 'dark:brightness-0 dark:invert dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]' : ''}`}/>
                                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-6 font-mono bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-800">Size: {brandConfig.navLogoSize}px</p>
                                        </div>
                                    )}
                                </div>

                                {/* Colors Card */}
                                <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2rem] p-8 border border-gray-100 dark:border-slate-700/50 shadow-xl flex flex-col">
                                    <h3 className="font-bold text-2xl text-gray-800 dark:text-white flex items-center gap-3 mb-8"><Palette size={24} className="text-purple-500"/> الألوان الأساسية</h3>
                                    <div className="space-y-6 flex-1">
                                        <ColorPicker label="Primary Color (الأساسي)" color={brandConfig.primaryColor} onChange={(val: string) => setBrandConfig({...brandConfig, primaryColor: val})} readOnly={!isEditingBrand} />
                                        <ColorPicker label="Secondary Color (الثانوي)" color={brandConfig.secondaryColor} onChange={(val: string) => setBrandConfig({...brandConfig, secondaryColor: val})} readOnly={!isEditingBrand} />
                                        <ColorPicker label="Accent Color (التمييز)" color={brandConfig.accentColor} onChange={(val: string) => setBrandConfig({...brandConfig, accentColor: val})} readOnly={!isEditingBrand} />
                                    </div>
                                </div>
                            </div>

                            {/* Assets Library */}
                            <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2rem] p-8 border border-gray-100 dark:border-slate-700/50 shadow-xl">
                                <h3 className="font-bold text-2xl text-gray-800 dark:text-white mb-6 flex items-center gap-3"><Folder size={24} className="text-blue-500"/> مكتبة الأصول</h3>
                                {isEditingBrand && (
                                    <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white dark:bg-slate-900/80 p-3 rounded-2xl border border-gray-200 dark:border-slate-700">
                                        <input className="flex-1 bg-transparent text-sm text-gray-800 dark:text-white outline-none px-3 py-2" placeholder="Asset Name" value={newLogo.name} onChange={e => setNewLogo({...newLogo, name: e.target.value})} />
                                        <div className="flex flex-1 gap-2">
                                            <input className="flex-1 bg-transparent text-sm text-gray-800 dark:text-white outline-none px-3 border-r border-gray-200 dark:border-slate-700 dir-ltr" placeholder="Image URL" value={newLogo.url} onChange={e => setNewLogo({...newLogo, url: e.target.value})} />
                                            <label className="cursor-pointer bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 px-3 rounded-xl flex items-center justify-center text-gray-500 dark:text-slate-300 transition">
                                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                                <Upload size={16} />
                                            </label>
                                        </div>
                                        <button onClick={addLogoToLibrary} className="bg-blue-600 px-6 py-2 rounded-xl text-sm font-bold text-white hover:bg-blue-500 shadow-lg">Add</button>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {safeAdditionalLogos.map((logo: any, idx: number) => (
                                        <div key={idx} className="bg-white dark:bg-slate-900/60 rounded-2xl p-4 border border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-600 transition group relative flex flex-col items-center shadow-sm">
                                            {isEditingBrand && <button onClick={() => removeLogoFromLibrary(idx)} className="absolute top-2 right-2 bg-red-500/20 text-red-400 p-1.5 rounded-full hover:bg-red-500 hover:text-white transition"><X size={12}/></button>}
                                            <div className="h-24 w-full flex items-center justify-center mb-3 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] rounded-xl opacity-80 border border-gray-100 dark:border-white/5">
                                                <img src={logo.url} className="max-h-full max-w-full object-contain drop-shadow-md" />
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-slate-300 font-bold truncate w-full text-center mb-3">{logo.name}</p>
                                            <button onClick={() => handleDownloadImage(logo.url, `${logo.name}.png`)} className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition font-bold border border-gray-200 dark:border-slate-700">
                                                <Download size={12}/> تحميل
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Collaborators Management (Owner Only) */}
                            {isOwner && (
                                <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2rem] p-8 border border-gray-100 dark:border-slate-700/50 shadow-xl mt-8">
                                    <h3 className="font-bold text-2xl text-gray-800 dark:text-white mb-6 flex items-center gap-3"><Users size={24} className="text-green-500"/> إدارة الفريق (Collaborators)</h3>
                                    <div className="flex gap-3 mb-6">
                                        <input 
                                            className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500 text-gray-800 dark:text-white" 
                                            placeholder="أدخل البريد الإلكتروني للمسؤول الإضافي..." 
                                            value={newEditorEmail}
                                            onChange={e => setNewEditorEmail(e.target.value)}
                                        />
                                        <button onClick={addEditor} className="bg-green-600 text-white px-6 rounded-xl font-bold hover:bg-green-700 transition shadow-lg">إضافة</button>
                                    </div>
                                    <div className="space-y-2">
                                        {safeAllowedEditors.map((email: string, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                                <span className="font-mono text-sm text-gray-700 dark:text-slate-300">{email}</span>
                                                <button onClick={() => removeEditor(email)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                        {safeAllowedEditors.length === 0 && (
                                            <p className="text-gray-400 text-sm text-center py-4">لا يوجد مسؤولين إضافيين.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- DEPARTMENTS TAB (DAZZLING UI) --- */}
                    {activeTab === 'departments' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {DEPARTMENTS.map(dept => {
                                const identity = deptIdentities[dept.id] || {};
                                const isEditing = editingDeptId === dept.id;
                                const theme = getDeptTheme(dept.id); // Get custom theme

                                return (
                                    <div key={dept.id} className={`group relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-[2.5rem] p-1 border border-gray-100 dark:border-slate-700/50 hover:border-gray-300 dark:hover:border-slate-500 transition-all duration-500 ${theme.shadow} hover:shadow-2xl hover:-translate-y-2`}>
                                        {/* Background Gradient Blob */}
                                        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${theme.gradient} rounded-full blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity`}></div>

                                        <div className="relative z-10 bg-white/50 dark:bg-slate-900/40 rounded-[2.3rem] p-6 h-full flex flex-col">
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex items-center gap-4">
                                                    {/* 3D Icon Container */}
                                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform duration-500 ${theme.class3d} bg-gradient-to-br ${theme.gradient} border border-white/20`}>
                                                        <dept.icon size={32} className="text-white drop-shadow-md" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-xl text-gray-800 dark:text-white tracking-tight">{dept.nameAr || dept.name}</h4>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-300 uppercase tracking-wider`}>
                                                            {dept.id}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {/* Edit Controls */}
                                                {canEdit && (
                                                    !isEditing ? (
                                                        <button onClick={() => startEditDept(dept.id)} className="p-2.5 bg-white dark:bg-slate-800 hover:bg-indigo-600 rounded-xl text-gray-400 dark:text-slate-400 hover:text-white transition shadow-sm hover:shadow-lg"><Pen size={16}/></button>
                                                    ) : (
                                                        <div className="flex flex-col gap-2">
                                                            <button onClick={() => saveDeptIdentity(dept.id)} className="p-2 bg-green-500 text-white rounded-lg shadow-lg hover:scale-110 transition"><Check size={16}/></button>
                                                            <button onClick={() => setEditingDeptId(null)} className="p-2 bg-red-500 text-white rounded-lg shadow-lg hover:scale-110 transition"><X size={16}/></button>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                            
                                            {/* Config Area */}
                                            <div className="mt-auto bg-gray-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
                                                {isEditing ? (
                                                    <div className="space-y-4">
                                                        <ColorPicker label="Theme Color" color={tempDeptData.color || '#000000'} onChange={(val: string) => setTempDeptData({...tempDeptData, color: val})} />
                                                        <div>
                                                            <label className="text-[10px] text-gray-500 dark:text-slate-500 uppercase font-bold mb-1.5 block">Font URL</label>
                                                            <input className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs text-gray-800 dark:text-white focus:border-indigo-500 outline-none" value={tempDeptData.fontUrl || ""} onChange={e => setTempDeptData({...tempDeptData, fontUrl: e.target.value})} placeholder="https://..." />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <ColorDisplay label="Theme Color" color={identity.color || '#333'} />
                                                        <div className="h-px w-full bg-gray-200 dark:bg-slate-800"></div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] text-gray-500 dark:text-slate-500 uppercase font-bold">Typography</span>
                                                            <span className="text-xs font-bold text-gray-700 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded border border-gray-200 dark:border-slate-800">{identity.fontName || "Cairo"}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* --- EDUCATIONAL TAB --- */}
                    {activeTab === 'educational' && (
                        <div className="space-y-8">
                            {canEdit && (
                                <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-md p-4 rounded-[2rem] border border-gray-100 dark:border-slate-700/50 flex flex-wrap gap-3 items-center shadow-lg">
                                    <input className="flex-1 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white text-sm rounded-2xl px-6 py-3 outline-none placeholder-gray-400 dark:placeholder-slate-500 focus:border-indigo-500 transition" placeholder="New Year Name..." value={newYearName} onChange={e => setNewYearName(e.target.value)} />
                                    <button onClick={addYear} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-900/50 transition flex items-center gap-2"><Plus size={18}/> إضافة سنة</button>
                                    <button onClick={seedMedicalCurriculum} className="bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/30 px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 border border-emerald-500/30 transition"><Database size={18}/> Auto-Fill</button>
                                </div>
                            )}

                            <div className="space-y-6">
                                {years.map(year => {
                                    const isExpanded = expandedYear === year.id;
                                    return (
                                        <div key={year.id} className={`bg-white/60 dark:bg-slate-800/40 backdrop-blur-md rounded-[2rem] border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-indigo-500/50 shadow-2xl shadow-indigo-900/10 dark:shadow-indigo-900/20 bg-white dark:bg-slate-800/60' : 'border-gray-200 dark:border-slate-700/50 hover:border-gray-300 dark:hover:border-slate-600'}`}>
                                            <div className="p-6 md:p-8 flex justify-between items-center cursor-pointer transition" onClick={() => setExpandedYear(isExpanded ? null : year.id)}>
                                                <div className="flex items-center gap-4">
                                                    <span className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-black shadow-lg ${isExpanded ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>{year.subjects?.length || 0}</span>
                                                    <h3 className="font-black text-xl md:text-2xl text-gray-800 dark:text-white tracking-tight">{year.name}</h3>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {canEdit && <button onClick={(e) => { e.stopPropagation(); deleteYear(year.id); }} className="p-2.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition"><Trash2 size={18}/></button>}
                                                    <div className={`p-2 rounded-full border border-gray-200 dark:border-slate-600 ${isExpanded ? 'bg-indigo-500 border-indigo-500 text-white' : 'text-gray-400 dark:text-slate-400'}`}>
                                                        {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="p-6 md:p-8 border-t border-gray-100 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                        {year.subjects?.map((sub: any) => {
                                                            const IconComponent = SUBJECT_ICONS.find(i => i.id === sub.iconId)?.icon || BookOpen;
                                                            return (
                                                                <div key={sub.id} className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] border border-gray-200 dark:border-slate-700 relative group hover:border-gray-300 dark:hover:border-slate-500 hover:-translate-y-1 transition-all duration-300 shadow-md hover:shadow-xl">
                                                                    <div className="flex justify-between items-start mb-4">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shadow-inner border border-white/50 dark:border-white/5">
                                                                                <IconComponent size={24} />
                                                                            </div>
                                                                            <div>
                                                                                <h4 className="font-bold text-sm text-gray-800 dark:text-white line-clamp-1">{sub.name}</h4>
                                                                                <span className="text-[10px] text-gray-500 dark:text-slate-500 font-bold uppercase tracking-wider">{sub.type === 'single' ? 'مادة منفردة' : 'مجموعة (Block)'}</span>
                                                                            </div>
                                                                        </div>
                                                                        {canEdit && (
                                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition duration-300">
                                                                                <button onClick={() => openEditSubject(year.id, sub)} className="p-1.5 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition"><Edit size={14}/></button>
                                                                                <button onClick={() => deleteSubject(year.id, sub)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition"><Trash2 size={14}/></button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {sub.type === 'single' ? (
                                                                        <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/30 border border-gray-100 dark:border-slate-600/50">
                                                                            <ColorDisplay color={sub.color} label="لون المادة" size="sm" />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-3 mt-3">
                                                                            <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-700/30 border border-gray-100 dark:border-slate-600/50">
                                                                                <ColorDisplay color={sub.color} label="لون البلوك (الأساسي)" size="sm" />
                                                                            </div>
                                                                            
                                                                            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                                                                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">المواد الفرعية</p>
                                                                                {sub.subSubjects?.map((ss: any, i: number) => (
                                                                                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 group/sub">
                                                                                        <span className="font-bold text-gray-700 dark:text-slate-300 truncate max-w-[50%]">{ss.name}</span>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="font-mono text-[9px] text-gray-400 dark:text-slate-500 opacity-0 group-hover/sub:opacity-100 transition-opacity">{ss.color}</span>
                                                                                            <div className="w-3 h-3 rounded-full shadow-sm ring-1 ring-gray-200 dark:ring-slate-600" style={{backgroundColor: ss.color}}></div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    
                                                    {canEdit && (
                                                        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700/50">
                                                            {!showAddSubject ? (
                                                                <button onClick={() => setShowAddSubject(year.id)} className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl text-gray-400 dark:text-slate-400 font-bold hover:border-indigo-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition flex items-center justify-center gap-2">
                                                                    <Plus size={20}/> إضافة مادة دراسية
                                                                </button>
                                                            ) : showAddSubject === year.id && (
                                                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-500/50 animate-fade-in-up shadow-2xl">
                                                                    <div className="space-y-4">
                                                                        <div className="flex justify-between items-center mb-2">
                                                                            <h4 className="font-bold text-gray-800 dark:text-white">بيانات المادة الجديدة</h4>
                                                                            <button onClick={() => setShowAddSubject(null)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-white"><X size={20}/></button>
                                                                        </div>
                                                                        
                                                                        <input className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-800 dark:text-white focus:border-indigo-500 outline-none" placeholder="Subject Name (e.g. Anatomy)" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} />
                                                                        
                                                                        <div className="flex gap-2 bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                                                                            <button onClick={() => setNewSubject({...newSubject, type: 'single'})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${newSubject.type === 'single' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'}`}>مادة منفردة</button>
                                                                            <button onClick={() => setNewSubject({...newSubject, type: 'grouped'})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${newSubject.type === 'grouped' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'}`}>مجمعة (Blocks)</button>
                                                                        </div>

                                                                        {newSubject.type === 'single' ? (
                                                                            <div className="space-y-4">
                                                                                <ColorPicker label="Subject Color" color={newSubject.color} onChange={(val: string) => setNewSubject({...newSubject, color: val})} />
                                                                                <div>
                                                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mb-2 block">Icon</label>
                                                                                    <div className="bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700">
                                                                                        <IconPicker selected={newSubject.iconId} onChange={(id) => setNewSubject({...newSubject, iconId: id})} />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="space-y-4">
                                                                                <ColorPicker label="Block Main Color" color={newSubject.color} onChange={(val: string) => setNewSubject({...newSubject, color: val})} />
                                                                                
                                                                                <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mb-2 block">المواد الفرعية</label>
                                                                                    <div className="flex gap-2 mb-3">
                                                                                        <input className="flex-1 bg-white dark:bg-transparent border-b border-gray-300 dark:border-slate-600 text-xs text-gray-800 dark:text-white pb-2 outline-none focus:border-indigo-500" placeholder="Sub-branch Name" value={tempSubSubject.name} onChange={e => setTempSubSubject({...tempSubSubject, name: e.target.value})} />
                                                                                        <input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent" value={tempSubSubject.color} onChange={e => setTempSubSubject({...tempSubSubject, color: e.target.value})} />
                                                                                        <button onClick={addSubSubjectToTemp} className="bg-green-600 text-white p-1.5 rounded-lg"><Plus size={16}/></button>
                                                                                    </div>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {newSubject.subSubjects.map((sub, idx) => (
                                                                                            <span key={idx} className="text-[10px] bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg text-gray-700 dark:text-slate-300 flex items-center gap-2 border border-gray-200 dark:border-slate-700 shadow-sm">
                                                                                                <span className="w-2 h-2 rounded-full" style={{backgroundColor: sub.color}}></span> {sub.name}
                                                                                                <button onClick={() => removeSubSubjectFromTemp(idx)} className="text-red-400 hover:text-red-600"><X size={10}/></button>
                                                                                            </span>
                                                                                        ))}
                                                                                        {newSubject.subSubjects.length === 0 && <span className="text-xs text-gray-400 dark:text-slate-500 italic">No sub-branches added yet.</span>}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <button onClick={() => saveSubject(year.id)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg mt-4">حفظ المادة</button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* --- EDIT SUBJECT MODAL --- */}
                    {editingSubject && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-slate-700">
                                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">تعديل المادة</h3>
                                    <button onClick={() => setEditingSubject(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"><X size={20}/></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <input 
                                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-800 dark:text-white focus:border-indigo-500 outline-none" 
                                        placeholder="Subject Name" 
                                        value={editingSubject.data.name} 
                                        onChange={e => setEditingSubject({...editingSubject, data: {...editingSubject.data, name: e.target.value}})} 
                                    />
                                    
                                    <div className="flex gap-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                                        <button onClick={() => setEditingSubject({...editingSubject, data: {...editingSubject.data, type: 'single'}})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${editingSubject.data.type === 'single' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'}`}>مادة منفردة</button>
                                        <button onClick={() => setEditingSubject({...editingSubject, data: {...editingSubject.data, type: 'grouped'}})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${editingSubject.data.type === 'grouped' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'}`}>مجمعة (Blocks)</button>
                                    </div>

                                    {editingSubject.data.type === 'single' ? (
                                        <div className="space-y-4">
                                            <ColorPicker label="Subject Color" color={editingSubject.data.color} onChange={(val: string) => setEditingSubject({...editingSubject, data: {...editingSubject.data, color: val}})} />
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mb-2 block">Icon</label>
                                                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                                                    <IconPicker selected={editingSubject.data.iconId} onChange={(id) => setEditingSubject({...editingSubject, data: {...editingSubject.data, iconId: id}})} />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <ColorPicker label="Block Main Color" color={editingSubject.data.color} onChange={(val: string) => setEditingSubject({...editingSubject, data: {...editingSubject.data, color: val}})} />
                                            
                                            <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                                <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mb-2 block">المواد الفرعية</label>
                                                <div className="flex gap-2 mb-3">
                                                    <input className="flex-1 bg-white dark:bg-transparent border-b border-gray-300 dark:border-slate-600 text-xs text-gray-800 dark:text-white pb-2 outline-none focus:border-indigo-500" placeholder="Sub-branch Name" value={tempSubSubject.name} onChange={e => setTempSubSubject({...tempSubSubject, name: e.target.value})} />
                                                    <input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent" value={tempSubSubject.color} onChange={e => setTempSubSubject({...tempSubSubject, color: e.target.value})} />
                                                    <button onClick={() => {
                                                        if (!tempSubSubject.name) return;
                                                        const updatedSubs = [...(editingSubject.data.subSubjects || []), tempSubSubject];
                                                        setEditingSubject({...editingSubject, data: {...editingSubject.data, subSubjects: updatedSubs}});
                                                        setTempSubSubject({ name: "", color: "#ef4444" });
                                                    }} className="bg-green-600 text-white p-1.5 rounded-lg"><Plus size={16}/></button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {editingSubject.data.subSubjects?.map((sub: any, idx: number) => (
                                                        <span key={idx} className="text-[10px] bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg text-gray-700 dark:text-slate-300 flex items-center gap-2 border border-gray-200 dark:border-slate-700 shadow-sm">
                                                            <span className="w-2 h-2 rounded-full" style={{backgroundColor: sub.color}}></span> {sub.name}
                                                            <button onClick={() => {
                                                                const updatedSubs = [...editingSubject.data.subSubjects];
                                                                updatedSubs.splice(idx, 1);
                                                                setEditingSubject({...editingSubject, data: {...editingSubject.data, subSubjects: updatedSubs}});
                                                            }} className="text-red-400 hover:text-red-600"><X size={10}/></button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button onClick={handleUpdateSubject} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg mt-4">حفظ التعديلات</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}