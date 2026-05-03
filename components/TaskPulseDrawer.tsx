import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../services/firebase";
import { updateDoc, doc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { 
    X, MessageSquare, Send, Edit2, Save, Palette, CheckCircle2, 
    Circle, Plus, Trash2, Clock, User, Share2, Zap, Hash, 
    Calendar, Flag, Paperclip, MessageCircle, MoreHorizontal,
    ArrowLeft, History, Filter, FileText, Activity, Check, XCircle
} from "lucide-react";
import { DEPARTMENTS, PRIORITIES } from "../utils/constants";
import TaskPipeline from "./TaskPipeline";

interface TaskPulseDrawerProps {
    task: any;
    user: any;
    userProfile: any;
    onClose: () => void;
    telegramConfig?: any;
    onSendTelegram?: (target: string, text: string) => void;
    handleAcceptTask?: (task: any) => void;
    handleRejectTask?: (task: any, reason: string) => void;
    deptSettings?: any;
}

const TaskPulseDrawer = ({ 
    task, user, userProfile, onClose, telegramConfig, onSendTelegram,
    handleAcceptTask, handleRejectTask, deptSettings 
}: TaskPulseDrawerProps) => {
    const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'pulse'>('details');
    const [comment, setComment] = useState("");
    const [pulseEntries, setPulseEntries] = useState<any[]>([]);
    const [subtasks, setSubtasks] = useState<any[]>(task.subtasks || []);
    const [newSubtask, setNewSubtask] = useState("");

    const [performerChatId, setPerformerChatId] = useState<string | null>(null);

    // Resolve Performer Telegram ID
    useEffect(() => {
        if (!telegramConfig || !task.performerName) return;
        
        // Search in people
        const person = telegramConfig.people?.find((p: any) => p.name === task.performerName);
        if (person?.chatId) {
            setPerformerChatId(person.chatId);
            return;
        }

        // Search in volunteer contacts
        let foundId = null;
        telegramConfig.volunteerContacts?.forEach((dept: any) => {
            const contact = dept.contacts?.find((c: any) => c.name === task.performerName);
            if (contact?.chatId) foundId = contact.chatId;
        });
        
        setPerformerChatId(foundId);
    }, [telegramConfig, task.performerName]);
    const [isEditing, setIsEditing] = useState(false);
    const [editedTask, setEditedTask] = useState({ 
        title: task.title, 
        details: task.details, 
        cardColor: task.cardColor || '#ffffff' 
    });

    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch Pulse Feed (Comments + Activity)
    useEffect(() => {
        if (!task.id) return;
        const q = query(collection(db, "tasks", task.id, "pulse"), orderBy("timestamp", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            setPulseEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [task.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [pulseEntries]);

    const handleAddSubtask = async () => {
        if (!newSubtask.trim()) return;
        const sub = { id: Date.now().toString(), text: newSubtask, completed: false };
        const updated = [...subtasks, sub];
        setSubtasks(updated);
        await updateDoc(doc(db, "tasks", task.id), { subtasks: updated });
        
        // Log to Pulse
        await addDoc(collection(db, "tasks", task.id, "pulse"), {
            type: 'activity',
            text: `أضاف مهمة فرعية: ${newSubtask}`,
            user: userProfile?.displayName || user.email,
            timestamp: serverTimestamp()
        });
        
        setNewSubtask("");
    };

    const toggleSubtask = async (id: string) => {
        const updated = subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s);
        setSubtasks(updated);
        await updateDoc(doc(db, "tasks", task.id), { subtasks: updated });
    };

    const updateInternalCategory = async (catId: string) => {
        try {
            await updateDoc(doc(db, "tasks", task.id), { 
                internalCategory: catId 
            });
            // Log to Pulse
            await addDoc(collection(db, "tasks", task.id, "pulse"), {
                type: 'activity',
                text: `قام بنقل المهمة إلى قسم: ${catId === 'uncategorized' ? 'غير مصنف' : catId}`,
                user: userProfile?.displayName || user.email,
                timestamp: serverTimestamp()
            });
            toast.success("تم نقل المهمة بنجاح");
        } catch (error) {
            console.error("Error updating internal category:", error);
            toast.error("فشل في نقل المهمة");
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!comment.trim()) return;
        
        await addDoc(collection(db, "tasks", task.id, "pulse"), {
            type: 'comment',
            text: comment,
            user: userProfile?.displayName || user.email,
            userAvatar: userProfile?.photoURL,
            timestamp: serverTimestamp()
        });
        
        setComment("");
        setActiveTab('pulse');
    };

    const handleSaveDetails = async () => {
        try {
            await updateDoc(doc(db, 'tasks', task.id), {
                title: editedTask.title,
                details: editedTask.details,
                cardColor: editedTask.cardColor
            });
            setIsEditing(false);
        } catch (e) {
            console.error(e);
            alert("خطأ أثناء الحفظ");
        }
    };

    // Detect screen size for responsive drawer
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const progress = subtasks.length > 0 
        ? Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)
        : 0;

    const sourceDept = DEPARTMENTS.find(d => d.id === task.sourceDept);
    const targetDept = DEPARTMENTS.find(d => d.id === task.targetDept);
    const priorityMeta = PRIORITIES[task.priority] || PRIORITIES.normal;

    return (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-stretch justify-end" onClick={onClose}>
            {/* Backdrop */}
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Panel (Responsive Bottom Sheet / Side Drawer) */}
            <motion.div 
                initial={isMobile ? { y: "100%" } : { x: "100%" }}
                animate={isMobile ? { y: 0 } : { x: 0 }}
                exit={isMobile ? { y: "100%" } : { x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 220 }}
                className="relative w-full sm:max-w-md h-[95vh] sm:h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden rounded-t-[2.5rem] sm:rounded-t-none"
                onClick={e => e.stopPropagation()}
                drag={isMobile ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                onDragEnd={(e, { offset, velocity }) => {
                    if (offset.y > 150 || velocity.y > 500) onClose();
                }}
            >
                {/* Mobile Handle */}
                <div className="sm:hidden w-full pt-3 pb-1 flex justify-center shrink-0">
                    <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                </div>
                {/* Header Section */}
                <div className="p-6 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl bg-gradient-to-br ${sourceDept?.primaryColor || 'bg-gray-500'} text-white shadow-lg`}>
                                {sourceDept ? <sourceDept.icon size={20}/> : <Hash size={20}/>}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                                    {sourceDept?.nameAr || 'مهمة عامة'} {targetDept && `← ${targetDept.nameAr}`}
                                </span>
                                {isEditing ? (
                                    <input 
                                        className="text-lg font-black bg-white dark:bg-gray-800 border-none rounded-lg dark:text-white p-0 focus:ring-0"
                                        value={editedTask.title}
                                        onChange={e => setEditedTask({...editedTask, title: e.target.value})}
                                    />
                                ) : (
                                    <h2 className="text-xl font-black text-gray-800 dark:text-white leading-tight">
                                        {task.title}
                                    </h2>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition">
                            <X size={20}/>
                        </button>
                    </div>

                    {/* Meta Row */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black ${priorityMeta.color} bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm`}>
                            <Flag size={12}/> {priorityMeta.label}
                        </div>
                        {task.deadline && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 shadow-sm">
                                <Calendar size={12}/> {task.deadline}
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 shadow-sm">
                            <Zap size={12}/> {progress}% مكتمل
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-6">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className={`h-full bg-gradient-to-r ${sourceDept?.primaryColor || 'from-indigo-500 to-purple-600'}`}
                        />
                    </div>

                    {/* Task Pipeline Visualization */}
                    <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 p-2 shadow-inner">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-2 mb-1">مسار المهمة عبر الأقسام</p>
                        <TaskPipeline task={task} currentDeptId={task.targetDept} />
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b dark:border-gray-800 px-4 pt-2">
                    {[
                        { id: 'details', label: 'التفاصيل', icon: FileText },
                        { id: 'subtasks', label: 'الخطوات', icon: CheckCircle2, badges: subtasks.length },
                        { id: 'pulse', label: 'النبض', icon: Activity, badges: pulseEntries.length }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition relative ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <tab.icon size={14}/>
                            {tab.label}
                            {tab.badges > 0 && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                    {tab.badges}
                                </span>
                            )}
                            {activeTab === tab.id && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"/>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" ref={scrollRef}>
                    
                    {activeTab === 'details' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">وصف المهمة</h4>
                                <button onClick={() => setIsEditing(!isEditing)} className="text-indigo-600 text-[10px] font-black hover:underline">
                                    {isEditing ? 'إلغاء' : 'تعديل'}
                                </button>
                            </div>
                            {isEditing ? (
                                <div className="space-y-4">
                                    <textarea 
                                        className="w-full h-40 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={editedTask.details}
                                        onChange={e => setEditedTask({...editedTask, details: e.target.value})}
                                    />
                                    <button onClick={handleSaveDetails} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none">
                                        حفظ التعديلات
                                    </button>
                                </div>
                            ) : (
                                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                                    {task.details || 'لا توجد تفاصيل إضافية لهذا التكليف.'}
                                </p>
                            )}
                            
                            {/* Attachments Placeholder */}
                            <div className="p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center opacity-40">
                                <Paperclip size={24} className="mb-2"/>
                                <span className="text-xs font-bold">لا توجد ملفات مرفقة</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'subtasks' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex gap-2 mb-6">
                                <input 
                                    className="flex-1 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    placeholder="إضافة خطوة تنفيذ..."
                                    value={newSubtask}
                                    onChange={e => setNewSubtask(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                                />
                                <button onClick={handleAddSubtask} className="p-3 bg-gray-900 dark:bg-indigo-600 text-white rounded-xl shadow-lg">
                                    <Plus size={20}/>
                                </button>
                            </div>

                            <div className="space-y-2">
                                {subtasks.length === 0 ? (
                                    <div className="text-center py-8 opacity-20">
                                        <CheckCircle2 size={40} className="mx-auto mb-2"/>
                                        <p className="text-xs font-bold">لم تضف خطوات بعد</p>
                                    </div>
                                ) : (
                                    subtasks.map((s, idx) => (
                                        <div 
                                            key={s.id} 
                                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${s.completed ? 'bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 opacity-60' : 'bg-white dark:bg-gray-800 border-gray-50 dark:border-gray-700'}`}
                                        >
                                            <button onClick={() => toggleSubtask(s.id)} className={`shrink-0 transition-colors ${s.completed ? 'text-indigo-600' : 'text-gray-300'}`}>
                                                {s.completed ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
                                            </button>
                                            <span className={`flex-1 text-sm font-bold ${s.completed ? 'line-through text-indigo-900' : 'text-gray-700 dark:text-gray-200'}`}>
                                                {s.text}
                                            </span>
                                            <button className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'pulse' && (
                        <div className="space-y-4 animate-fade-in flex flex-col h-full">
                            <div className="flex-1 space-y-4">
                                {pulseEntries.map((entry, idx) => (
                                    <div key={idx} className={`flex ${entry.type === 'activity' ? 'justify-center' : 'items-start gap-3'}`}>
                                        {entry.type === 'activity' ? (
                                            <div className="bg-gray-100 dark:bg-gray-800/50 px-4 py-1 rounded-full text-[10px] font-bold text-gray-500 flex items-center gap-2">
                                                <History size={10}/>
                                                <span className="font-black text-indigo-600">{entry.user}</span>
                                                <span>{entry.text}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                                                    {entry.userAvatar ? <img src={entry.userAvatar} className="w-full h-full rounded-full"/> : <User size={16} className="text-indigo-600"/>}
                                                </div>
                                                <div className="flex flex-col gap-1 max-w-[85%]">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-gray-800 dark:text-gray-200">{entry.user}</span>
                                                        <span className="text-[9px] text-gray-400">
                                                            {entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'}) : 'الآن'}
                                                        </span>
                                                    </div>
                                                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tr-none border border-gray-100 dark:border-gray-700 shadow-sm">
                                                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                                                            {entry.text}
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {pulseEntries.length === 0 && (
                                    <div className="text-center py-12 opacity-20">
                                        <MessageSquare size={40} className="mx-auto mb-2"/>
                                        <p className="text-xs font-bold">لا يوجد نشاط مسجل</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-800">
                    {activeTab === 'pulse' || activeTab === 'details' ? (
                        <form onSubmit={handleAddComment} className="flex gap-2">
                            <input 
                                className="flex-1 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                placeholder="اكتب تعليقاً أو استفساراً..."
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                            />
                            <button type="submit" className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:scale-105 active:scale-95 transition">
                                <Send size={20}/>
                            </button>
                        </form>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {/* Departmental Handoff Controls (Acceptance Gate) */}
                            {task.status === 'pending_acceptance' && task.targetDept === userProfile?.departmentId && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleAcceptTask?.(task)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-black text-xs shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition"
                                    >
                                        <Check size={16}/> قبول المهمة وبدء العمل
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const reason = prompt("يرجى ذكر سبب الرفض:");
                                            if (reason) handleRejectTask?.(task, reason);
                                        }}
                                        className="px-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 py-3 rounded-xl font-black text-xs hover:bg-rose-100 transition"
                                    >
                                        <XCircle size={16}/> رفض
                                    </button>
                                </div>
                            )}

                            {/* Matrix 4.0: Internal Categorization */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Filter size={12}/> تصنيف المهمة داخلياً (خاص بقسمك)
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    <button 
                                        onClick={() => updateInternalCategory('uncategorized')}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${(!task.internalCategory || task.internalCategory === 'uncategorized') ? 'bg-gray-900 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 border dark:border-gray-700'}`}
                                    >
                                        غير مصنف
                                    </button>
                                    {(deptSettings?.customCategories?.[task.sourceDept] || []).map((cat: string) => (
                                        <button 
                                            key={cat}
                                            onClick={() => updateInternalCategory(cat)}
                                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${task.internalCategory === cat ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 border dark:border-gray-700'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-3 text-[9px] text-gray-400 italic">هذا التصنيف يظهر لجميع أعضاء قسمك لتسهيل توزيع العمل.</p>
                            </div>

                            <div className="flex gap-2">
                                <button className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 py-3 rounded-xl font-black text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition">
                                    <Share2 size={16}/> تحويل المهمة
                                </button>
                                {performerChatId ? (
                                    <button 
                                        onClick={() => onSendTelegram!(performerChatId, `تذكير بمهمة: ${task.title}`)} 
                                        className="p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 transition"
                                        title={`مراسلة ${task.performerName} على تيليجرام`}
                                    >
                                        <MessageCircle size={20}/>
                                    </button>
                                ) : (
                                    <button 
                                        className="p-3 bg-gray-100 text-gray-300 rounded-xl cursor-not-allowed"
                                        title="لم يتم العثور على معرف التيليجرام للعضو"
                                    >
                                        <MessageCircle size={20}/>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default TaskPulseDrawer;
