import React, { useState, useRef, useEffect } from 'react';
import { X, Calendar, Flag, Clock, Hash, Send, User, CheckCircle2, Image as ImageIcon, Plus, ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEPARTMENTS } from '../utils/constants';
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

interface AddTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (task: any) => void;
    activeDeptId: string;
    user: any;
    initialData?: any;
    existingCategories?: string[];
    projects?: any[];
}

// Priority config
const PRIORITY_META: Record<string, { label: string; color: string; bg: string; grad: string }> = {
    p1: { label: 'عاجل جداً', color: 'text-red-600',    bg: 'bg-red-50',    grad: 'from-red-500 to-rose-600' },
    p2: { label: 'عاجل',      color: 'text-orange-600', bg: 'bg-orange-50', grad: 'from-orange-500 to-amber-600' },
    p3: { label: 'متوسط',     color: 'text-blue-600',   bg: 'bg-blue-50',   grad: 'from-blue-500 to-indigo-600' },
    p4: { label: 'عادي',      color: 'text-gray-500',   bg: 'bg-gray-100',  grad: 'from-gray-400 to-gray-500' },
};

export default function AddTaskModal({ isOpen, onClose, onAdd, activeDeptId, user, initialData, existingCategories = [], projects = [] }: AddTaskModalProps) {
    const [title, setTitle] = useState(initialData?.title || "");
    const [details, setDetails] = useState(initialData?.details || "");
    const [deadline, setDeadline] = useState(initialData?.deadline || "");
    const [executionDate, setExecutionDate] = useState(initialData?.executionDate || "");
    const [priority, setPriority] = useState(initialData?.priority || "p4");
    const [targetDept, setTargetDept] = useState(initialData?.targetDept || "");
    const [isForSelf, setIsForSelf] = useState(true);
    const [isAlsoForSelf, setIsAlsoForSelf] = useState(false);
    const [category, setCategory] = useState(initialData?.category || "");
    const [performerName, setPerformerName] = useState(initialData?.performerName || "");
    const [eduBatchNumber, setEduBatchNumber] = useState("");
    const [eduCreateCover, setEduCreateCover] = useState(false);
    const [projectId, setProjectId] = useState(initialData?.projectId || "");

    // Logo Selection State
    const [brandLogos, setBrandLogos] = useState<{name: string, url: string}[]>([]);
    const [selectedLogos, setSelectedLogos] = useState<string[]>([]);
    const [showLogoSection, setShowLogoSection] = useState(false);

    // UI States
    const [showPriorityMenu, setShowPriorityMenu] = useState(false);
    const [showDeptMenu, setShowDeptMenu] = useState(false);

    const priorityRef = useRef<HTMLDivElement>(null);
    const deptRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLInputElement>(null);

    // Fetch Logos
    useEffect(() => {
        if (isOpen) {
            const fetchLogos = async () => {
                try {
                    const docRef = doc(db, "app_settings", "brand_identity");
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setBrandLogos(data.additionalLogos || []);
                    }
                } catch (e) { console.error("Error fetching logos", e); }
            };
            fetchLogos();
            setTimeout(() => titleRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Load saved data when modal opens
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                if (initialData.deadline)     setDeadline(initialData.deadline);
                if (initialData.title)        setTitle(initialData.title);
                if (initialData.details)      setDetails(initialData.details);
                if (initialData.priority)     setPriority(initialData.priority);
                if (initialData.category)     setCategory(initialData.category);
                if (initialData.performerName) setPerformerName(initialData.performerName);
                if (initialData.targetDept)   { setTargetDept(initialData.targetDept); setIsForSelf(false); }
            } else {
                const savedPerformer   = localStorage.getItem("ma3wan_last_performer");
                const savedCategory    = localStorage.getItem("ma3wan_last_category");
                const savedTargetDept  = localStorage.getItem("ma3wan_last_targetDept");
                if (savedPerformer)  setPerformerName(savedPerformer);
                if (savedCategory)   setCategory(savedCategory);
                if (savedTargetDept && savedTargetDept !== activeDeptId) { setTargetDept(savedTargetDept); setIsForSelf(false); }
            }
        }
    }, [isOpen, initialData, activeDeptId]);

    useEffect(() => {
        const isArtContext    = activeDeptId === 'art' || targetDept === 'art';
        const isDesignCategory = category.includes('تصميم') || category.includes('design') || category.includes('جرافيك');
        setShowLogoSection(isArtContext || isDesignCategory);
    }, [activeDeptId, targetDept, category]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (priorityRef.current && !priorityRef.current.contains(event.target as Node)) setShowPriorityMenu(false);
            if (deptRef.current && !deptRef.current.contains(event.target as Node)) setShowDeptMenu(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleLogo = (logoName: string) => {
        setSelectedLogos(prev => prev.includes(logoName) ? prev.filter(l => l !== logoName) : [...prev, logoName]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        if (performerName) localStorage.setItem("ma3wan_last_performer", performerName);
        if (category)      localStorage.setItem("ma3wan_last_category", category);
        if (!isForSelf && targetDept) localStorage.setItem("ma3wan_last_targetDept", targetDept);

        onAdd({ title, details, deadline, executionDate, priority, targetDept: isForSelf ? activeDeptId : targetDept, isForSelf, isAlsoForSelf: !isForSelf && isAlsoForSelf, category, performerName, eduBatchNumber, eduCreateCover, selectedLogos, projectId });
        
        // Reset
        setTitle(""); setDetails(""); setDeadline(""); setExecutionDate("");
        setPriority("p4"); setTargetDept(""); setIsForSelf(true); setIsAlsoForSelf(false);
        setCategory(""); setPerformerName(""); setEduBatchNumber(""); setEduCreateCover(false); setSelectedLogos([]);
        onClose();
    };

    const activeDept = DEPARTMENTS.find(d => d.id === activeDeptId);
    const pMeta = PRIORITY_META[priority] || PRIORITY_META.p4;
    const targetDeptName = DEPARTMENTS.find(d => d.id === targetDept)?.nameAr || 'توجيه';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
                    <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl h-[85vh] md:h-auto flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <form onSubmit={handleSubmit} className="flex flex-col h-full bg-white dark:bg-gray-900">

                            {/* ── Gradient Header ── */}
                            <div className={`relative bg-gradient-to-br ${pMeta.grad} p-5 pb-12 overflow-hidden shrink-0 transition-all duration-500`}>
                                <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"/>
                                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"/>
                                
                                 {/* Mobile drag handle */}
                                <div className="w-10 h-1 bg-white/40 rounded-full mx-auto mb-4 md:hidden"/>

                                <div className="relative z-10 flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1 opacity-80">
                                            {activeDept && <activeDept.icon size={14} className="text-white"/>}
                                            <span className="text-white text-[11px] font-bold">
                                                {activeDept?.nameAr || 'مهمة جديدة'}
                                            </span>
                                        </div>
                                        <p className="text-white font-black text-lg opacity-90">إضافة مهمة</p>
                                    </div>
                                    <button type="button" onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition shrink-0">
                                        <X size={16}/>
                                    </button>
                                </div>
                            </div>

                            {/* ── Body Card (slides over header) ── */}
                            <div className="-mt-7 mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 flex-1 overflow-y-auto custom-scrollbar mb-4">
                                <div className="p-5 space-y-4">

                                    {/* Title Input */}
                                    <input
                                        ref={titleRef}
                                        type="text"
                                        placeholder="اسم المهمة..."
                                        className="w-full text-xl font-black bg-transparent border-none focus:ring-0 outline-none p-0 placeholder-gray-300 dark:placeholder-gray-600 text-gray-800 dark:text-white"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                    />

                                    {/* Description */}
                                    <textarea
                                        placeholder="وصف تفصيلي للمهمة (اختياري)..."
                                        className="w-full text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl p-3 resize-none h-20 outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-300 dark:placeholder-gray-600 text-gray-600 dark:text-gray-300 transition"
                                        value={details}
                                        onChange={e => setDetails(e.target.value)}
                                    />

                                    {/* ── Quick Controls Row ── */}
                                    <div className="flex flex-wrap gap-2">
                                        {/* Deadline */}
                                        <label className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${deadline ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100'}`}>
                                            <Calendar size={13}/>
                                            <span>{deadline || 'الموعد النهائي'}</span>
                                            <input type="date" className="sr-only" value={deadline} onChange={e => setDeadline(e.target.value)}/>
                                        </label>

                                        {/* Execution Date */}
                                        <label className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${executionDate ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100'}`}>
                                            <Clock size={13}/>
                                            <span>{executionDate || 'تاريخ التنفيذ'}</span>
                                            <input type="date" className="sr-only" value={executionDate} onChange={e => setExecutionDate(e.target.value)}/>
                                        </label>

                                        {/* Priority Picker */}
                                        <div className="relative" ref={priorityRef}>
                                            <button type="button" onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition ${priority !== 'p4' ? `${pMeta.bg} dark:bg-opacity-20 border-transparent ${pMeta.color}` : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100'}`}
                                            >
                                                <Flag size={13}/>
                                                {pMeta.label}
                                                <ChevronDown size={11} className="opacity-60"/>
                                            </button>
                                            <AnimatePresence>
                                                {showPriorityMenu && (
                                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                                                        className="absolute top-full right-0 mt-1 w-36 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-30 py-1">
                                                        {Object.entries(PRIORITY_META).map(([key, meta]) => (
                                                            <button key={key} type="button" onClick={() => { setPriority(key); setShowPriorityMenu(false); }}
                                                                className={`w-full text-right px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${meta.color}`}>
                                                                <Flag size={11}/> {meta.label}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Target Department */}
                                        <div className="relative" ref={deptRef}>
                                            <button type="button" onClick={() => setShowDeptMenu(!showDeptMenu)}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition ${!isForSelf ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-600' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100'}`}
                                            >
                                                {isForSelf ? <User size={13}/> : <Send size={13}/>}
                                                {isForSelf ? 'لنفسي' : targetDeptName}
                                                <ChevronDown size={11} className="opacity-60"/>
                                            </button>
                                            <AnimatePresence>
                                                {showDeptMenu && (
                                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                                                        className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-30 max-h-52 overflow-y-auto custom-scrollbar py-1">
                                                        <button type="button" onClick={() => { setIsForSelf(true); setTargetDept(""); setShowDeptMenu(false); }}
                                                            className="w-full text-right px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                                                            <User size={12}/> لنفسي
                                                        </button>
                                                        {DEPARTMENTS.filter(d => d.id !== activeDeptId).map(dept => (
                                                            <button key={dept.id} type="button"
                                                                onClick={() => { setIsForSelf(false); setTargetDept(dept.id); setShowDeptMenu(false); }}
                                                                className="w-full text-right px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                                                <dept.icon size={12} className={dept.primaryColor}/>
                                                                {dept.nameAr || dept.name}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Also for self checkbox */}
                                        {!isForSelf && (
                                            <label className="flex items-center gap-1.5 cursor-pointer px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                                <input type="checkbox" checked={isAlsoForSelf} onChange={e => setIsAlsoForSelf(e.target.checked)} className="rounded text-indigo-600 w-3.5 h-3.5"/>
                                                أضف لي أيضاً؟
                                            </label>
                                        )}
                                    </div>

                                    {/* ── Project Selection ── */}
                                    {projects && projects.length > 0 && (
                                        <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-3 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/30">
                                            <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest px-1 mb-1.5 block">المشروع المرتبط</label>
                                            <select 
                                                value={projectId}
                                                onChange={e => setProjectId(e.target.value)}
                                                className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 transition"
                                            >
                                                <option value="">بدون مشروع (عام)</option>
                                                {projects.map((p: any) => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* ── Category + Performer ── */}
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <Hash size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                            <input
                                                type="text"
                                                list="categories-list"
                                                placeholder="القسم الداخلي / الفئة"
                                                className="w-full pl-3 pr-8 py-2.5 text-xs font-bold bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                value={category}
                                                onChange={e => setCategory(e.target.value)}
                                            />
                                            <datalist id="categories-list">
                                                {existingCategories.map((cat, idx) => <option key={idx} value={cat}/>)}
                                            </datalist>
                                        </div>
                                        {(activeDeptId === 'art' || targetDept === 'art') && (
                                            <input
                                                type="text"
                                                placeholder="اسم المصمم"
                                                className="w-36 px-3 py-2.5 text-xs font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-200 dark:border-purple-800 placeholder-purple-300 focus:ring-2 focus:ring-purple-500 outline-none transition"
                                                value={performerName}
                                                onChange={e => setPerformerName(e.target.value)}
                                            />
                                        )}
                                    </div>

                                    {/* ── Logo Picker ── */}
                                    {showLogoSection && brandLogos.length > 0 && (
                                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                            <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-300 mb-3 flex items-center gap-2">
                                                <ImageIcon size={13}/> اختيار اللوجوهات المطلوبة
                                                {selectedLogos.length > 0 && (
                                                    <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{selectedLogos.length}</span>
                                                )}
                                            </h4>
                                            <div className="grid grid-cols-4 gap-2">
                                                {brandLogos.map((logo, idx) => (
                                                    <button key={idx} type="button" onClick={() => toggleLogo(logo.name)}
                                                        className={`relative aspect-square rounded-xl border-2 overflow-hidden transition-all ${selectedLogos.includes(logo.name) ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-md' : 'border-gray-200 dark:border-gray-600 opacity-60 hover:opacity-90 hover:border-gray-300'}`}>
                                                        <img src={logo.url} alt={logo.name} className="w-full h-full object-contain p-1"/>
                                                        {selectedLogos.includes(logo.name) && (
                                                            <div className="absolute top-1 right-1 bg-indigo-500 text-white rounded-full p-0.5 shadow">
                                                                <CheckCircle2 size={9}/>
                                                            </div>
                                                        )}
                                                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] py-0.5 text-center truncate px-1">
                                                            {logo.name}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Educational Fields ── */}
                                    {activeDeptId === 'educational' && (
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 flex items-center gap-3">
                                            <input
                                                type="text"
                                                placeholder="رقم الدفعة"
                                                className="flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg text-xs border-none focus:ring-1 focus:ring-indigo-500 placeholder-indigo-300 text-indigo-700 dark:text-indigo-300 outline-none"
                                                value={eduBatchNumber}
                                                onChange={e => setEduBatchNumber(e.target.value)}
                                            />
                                            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                                                <input type="checkbox" checked={eduCreateCover} onChange={e => setEduCreateCover(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"/>
                                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">إنشاء غلاف</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Footer ── */}
                            <div className="px-4 pb-6 shrink-0 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold">
                                    <Hash size={11}/>
                                    <span>{activeDeptId === 'inbox' ? 'الوارد' : (activeDept?.nameAr || 'عام')}</span>
                                    {category && (
                                        <>
                                            <span className="opacity-40">•</span>
                                            <span className="text-indigo-500">{category}</span>
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">
                                        إلغاء
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!title.trim()}
                                        className={`px-6 py-2.5 text-xs font-black text-white bg-gradient-to-r ${pMeta.grad} rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg hover:opacity-90 hover:scale-105 active:scale-95 flex items-center gap-2`}
                                    >
                                        <Sparkles size={13}/>
                                        إضافة مهمة
                                    </button>
                                </div>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
