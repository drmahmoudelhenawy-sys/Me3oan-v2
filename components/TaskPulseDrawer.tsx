import TaskChat from "./TaskChat";
import TaskDeliveryCenter from "./TaskDeliveryCenter";
import TaskAttachments from "./TaskAttachments";
import TaskTimeline from "./TaskTimeline";
import React, { useState, useEffect, useRef } from "react";

import { motion, AnimatePresence } from "framer-motion";

import { db } from "../services/firebase";

import { updateDoc, doc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, getDocs } from "firebase/firestore";

import toast from "react-hot-toast";

import { 

    X, MessageSquare, Send, Edit2, Save, Palette, CheckCircle2, 

    Circle, Plus, Trash2, Clock, User, Share2, Zap, Hash, 

    Calendar, Flag, Paperclip, MessageCircle, MoreHorizontal,

    ArrowLeft, History, Filter, FileText, Activity, Check, XCircle, Link as LinkIcon

} from "lucide-react";

import { DEPARTMENTS, PRIORITIES } from "../utils/constants";
import { awardTaskCompletionPointsOnce } from "../utils/taskPoints";

import TaskPipeline from "./TaskPipeline";

import { resolveDepartmentLeadership, sendTelegramToChatIds } from "../utils/telegramRouting";



interface TaskPulseDrawerProps {

    task: any;

    user: any;

    userProfile: any;

    onClose: () => void;

    telegramConfig?: any;

    onSendTelegram?: (target: string, text: string, botToken?: string) => void;

    handleAcceptTask?: (task: any) => void;

    handleRejectTask?: (task: any, reason: string) => void;

    deptSettings?: any;

    requests?: any[];

}



const TaskPulseDrawer = ({ 

    task, user, userProfile, onClose, telegramConfig, onSendTelegram,

    handleAcceptTask, handleRejectTask, deptSettings, requests = []

}: TaskPulseDrawerProps) => {

    const requestLink = requests.find((r: any) => r.originalTaskId === task.id || r.id === task.linkedRequestId || r.id === task.id);
    const isForwarded = !!requestLink && requestLink.sourceDept !== requestLink.targetDept;
    const effectiveSourceDept = isForwarded ? requestLink.sourceDept : task.sourceDept;
    const effectiveTargetDept = isForwarded ? requestLink.targetDept : task.targetDept;

    const isRequest = (task.sourceDept && task.targetDept && task.sourceDept !== task.targetDept) || task.linkedRequestId;
    const collName = isRequest ? 'requests' : 'tasks';
    const docId = task.linkedRequestId || task.id;

    const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'files' | 'timeline'>('details');
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDeliveryCenter, setShowDeliveryCenter] = useState(false);

    useEffect(() => {
        if (!docId) return;
        const q = query(collection(db, collName, docId, "messages"));
        const unsubscribe = onSnapshot(q, (snap) => {
            const count = snap.docs.filter(docSnap => {
                const data = docSnap.data();
                return data.senderId !== user.uid && (!data.seenBy || !data.seenBy.includes(user.uid));
            }).length;
            setUnreadCount(count);
        });
        return () => unsubscribe();
    }, [docId, user.uid, collName]);

    const [comment, setComment] = useState("");

    const [pulseEntries, setPulseEntries] = useState<any[]>([]);

    const [subtasks, setSubtasks] = useState<any[]>(task.subtasks || []);

    const [newSubtask, setNewSubtask] = useState("");



    const [performerChatId, setPerformerChatId] = useState<string | null>(null);
    const [deptUsers, setDeptUsers] = useState<any[]>([]);

    // Bidirectional sync helper
    const syncLinkedTasks = async (reqId: string, status: string, note?: string) => {
        try {
            const normalizedStatus = status === 'revision_requested'
                ? 'revision'
                : status === 'waiting_review'
                    ? 'executed'
                    : status;
            const q = query(collection(db, "tasks"), where("linkedRequestId", "==", reqId));
            const snap = await getDocs(q);
            if (snap.empty) return;
            for (const taskDoc of snap.docs) {
                const updates: any = {
                    status: normalizedStatus,
                    updatedAt: serverTimestamp()
                };
                if (normalizedStatus === 'completed') {
                    updates.progress = 100;
                    updates.revisionRequested = false;
                    updates.revisionNote = "";
                } else if (normalizedStatus === 'executed') {
                    updates.progress = 90;
                    updates.revisionRequested = false;
                } else if (normalizedStatus === 'revision') {
                    updates.revisionRequested = true;
                    updates.revisionNote = note || "";
                    updates.progress = 90;
                }
                await updateDoc(taskDoc.ref, updates);
            }
        } catch(e) {
            console.error("Error syncing linked tasks:", e);
        }
    };

    useEffect(() => {
        if (!task?.targetDept) return;
        const fetchUsers = async () => {
            try {
                const q = query(collection(db, "users"), where("departmentId", "==", task.targetDept));
                const snap = await getDocs(q);
                const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                setDeptUsers(list);
            } catch(e) {
                console.error("Error fetching department users:", e);
            }
        };
        fetchUsers();
    }, [task?.targetDept]);



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

    const [editNote, setEditNote] = useState("");



    const scrollRef = useRef<HTMLDivElement>(null);



    // Fetch Pulse Feed (Comments + Activity)

    useEffect(() => {

        if (!task.id) return;

        const q = query(collection(db, collName, task.id, "pulse"), orderBy("timestamp", "asc"));

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

        await updateDoc(doc(db, collName, task.id), { subtasks: updated });

        

        // Log to Pulse

        await addDoc(collection(db, collName, docId, "pulse"), {

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

        await updateDoc(doc(db, collName, task.id), { subtasks: updated });

    };



    const updateInternalCategory = async (catId: string) => {

        try {

            await updateDoc(doc(db, collName, task.id), { 

                internalCategory: catId 

            });

            // Log to Pulse

            await addDoc(collection(db, collName, docId, "pulse"), {

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

        

        await addDoc(collection(db, collName, docId, "pulse"), {

            type: 'comment',

            text: comment,

            user: userProfile?.displayName || user.email,

            userAvatar: userProfile?.photoURL,

            timestamp: serverTimestamp()

        });

        

        setComment("");

        setActiveTab('chat');

    };



    const handleSaveDetails = async () => {

        try {

            const changedParts = [

                editedTask.title !== task.title ? "العنوان" : "",

                editedTask.details !== task.details ? "التفاصيل" : "",

                editedTask.cardColor !== (task.cardColor || "#ffffff") ? "لون البطاقة" : ""

            ].filter(Boolean);

            await updateDoc(doc(db, collName, task.id), {

                title: editedTask.title,

                details: editedTask.details,

                cardColor: editedTask.cardColor,

                lastEditNote: editNote.trim(),

                lastEditedAt: Date.now(),

                lastEditedBy: userProfile?.displayName || user.email

            });

            await addDoc(collection(db, collName, docId, "pulse"), {

                type: 'activity',

                text: `تم تعديل المهمة${editNote.trim() ? `: ${editNote.trim()}` : changedParts.length ? `: ${changedParts.join("، ")}` : ""}`,

                user: userProfile?.displayName || user.email,

                timestamp: serverTimestamp()

            });

            if (onSendTelegram) {

                const notifyDept = task.targetDept || task.sourceDept;

                const route = resolveDepartmentLeadership(telegramConfig, notifyDept, "manager_and_deputy");

                const editedAtText = new Date().toLocaleString('ar-EG');

                const oldDetails = typeof task.details === "string" ? task.details : JSON.stringify(task.details || "");

                const newDetails = typeof editedTask.details === "string" ? editedTask.details : JSON.stringify(editedTask.details || "");

                const msg = `✏️ <b>تم تعديل مهمة</b>\n\n📌 <b>المهمة:</b> ${editedTask.title || task.title || "-"}\n🏷️ <b>القسم:</b> ${DEPARTMENTS.find(d => d.id === notifyDept)?.nameAr || notifyDept || "-"}\n👤 <b>تم التعديل بواسطة:</b> ${userProfile?.displayName || user.email}\n🕒 <b>وقت التعديل:</b> ${editedAtText}\n\n🧾 <b>ما الذي تم تعديله:</b> ${editNote.trim() || changedParts.join("، ") || "تعديل بيانات المهمة"}\n\n📋 <b>العنوان القديم:</b> ${task.title || "-"}\n📋 <b>العنوان الجديد:</b> ${editedTask.title || "-"}\n\n📄 <b>التفاصيل القديمة:</b>\n${oldDetails || "-"}\n\n📄 <b>التفاصيل الجديدة:</b>\n${newDetails || "-"}`;

                sendTelegramToChatIds(onSendTelegram, route.chatIds, msg, route.botToken);

            }

            setEditNote("");

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

                        <TaskPipeline task={task} currentDeptId={effectiveTargetDept} />

                    </div>

                </div>



                {/* Tab Navigation */}

                <div className="flex border-b dark:border-gray-800 px-4 pt-2 overflow-x-auto">

                    {[

                        { id: 'details', label: 'التفاصيل', icon: FileText, badges: 0 },

                        { id: 'chat', label: 'المحادثة', icon: MessageSquare, badges: unreadCount },

                        { id: 'files', label: 'الملفات المرفقة', icon: Paperclip, badges: 0 },

                        { id: 'timeline', label: 'النشاط', icon: History, badges: 0 }

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

                <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" ref={scrollRef}>

                    

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

                                    <textarea

                                        className="w-full h-24 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/40 text-sm dark:text-white outline-none focus:ring-2 focus:ring-amber-500"

                                        value={editNote}

                                        onChange={e => setEditNote(e.target.value)}

                                        placeholder="اكتب هنا إيه التعديل اللي حصل عشان يوصل في إشعار التليجرام..."

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

                            {/* Matrix 4.0: Internal Categorization (Moved to scroll area) */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 mt-4 text-right">
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

                            {/* Department Internal Assignment Handoff Dropdown (Moved to scroll area) */}
                            {userProfile?.role && ['admin', 'manager', 'deputy'].includes(userProfile.role) && (
                                <div className="w-full bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 mt-4 text-right">
                                    <label className="text-[10px] font-black text-slate-400 block mb-2">إسناد وتعيين المهمة لعضو في القسم:</label>
                                    <select
                                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black"
                                        value={task.assignedTo || ''}
                                        onChange={async (e) => {
                                            const selectedUid = e.target.value;
                                            const selectedUser = deptUsers.find(u => u.id === selectedUid);
                                            const assignedName = selectedUser ? selectedUser.displayName : '';
                                            
                                            const taskRef = doc(db, collName, docId);
                                            await updateDoc(taskRef, {
                                                assignedTo: selectedUid || null,
                                                assignedToName: assignedName,
                                                performerName: assignedName,
                                                updatedAt: serverTimestamp()
                                            });
                                            
                                            await addDoc(collection(db, collName, docId, "messages"), {
                                                type: "system",
                                                message: assignedName 
                                                    ? `👤 تم إسناد المهمة إلى العضو: ${assignedName}` 
                                                    : `👤 تم إلغاء إسناد المهمة وإرجاعها للقسم العامة.`,
                                                senderId: user.uid,
                                                senderName: userProfile?.displayName || user.email,
                                                senderAvatar: userProfile?.photoURL || "",
                                                seenBy: [user.uid],
                                                createdAt: serverTimestamp()
                                            });

                                            if (selectedUser && onSendTelegram) {
                                                const contactRoute = resolveDepartmentLeadership(telegramConfig, task.targetDept, "manager_and_deputy");
                                                const personalContact = telegramConfig?.people?.find((p: any) => p.name === selectedUser.displayName || p.chatId === selectedUser.telegramChatId);
                                                const targetChatId = personalContact?.chatId || selectedUser.telegramChatId;
                                                if (targetChatId) {
                                                    const msgText = `👤 <b>مهمة جديدة مسندة إليك</b>\n\n📌 <b>المهمة:</b> ${task.title}\n📥 <b>القسم:</b> ${DEPARTMENTS.find(d => d.id === task.targetDept)?.nameAr || task.targetDept}\n👤 <b>بواسطة:</b> ${userProfile?.displayName || user.email}`;
                                                    onSendTelegram(targetChatId, msgText, contactRoute.botToken);
                                                }
                                            }

                                            toast.success("تم تحديث المسؤول عن المهمة بنجاح!");
                                        }}
                                    >
                                        <option value="">— غير مسندة (عامة للقسم) —</option>
                                        {deptUsers.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.displayName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Telegram Reminder (Moved to scroll area) */}
                            {performerChatId && (
                                <div className="mt-4 flex justify-end">
                                    <button 
                                        onClick={() => onSendTelegram!(performerChatId, `تذكير بمهمة: ${task.title}`)} 
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition text-xs font-black"
                                        title={`مراسلة ${task.performerName} على تيليجرام`}
                                    >
                                        <MessageCircle size={16}/> مراسلة وتذكير العضو على تيليجرام
                                    </button>
                                </div>
                            )}

                        </div>

                    )}



                    {activeTab === 'chat' && (
                        <div className="animate-fade-in flex flex-col h-full">
                            <TaskChat taskId={docId} collName={collName} user={user} userProfile={userProfile} />
                        </div>
                    )}
                    {activeTab === 'files' && (
                        <div className="animate-fade-in">
                            <TaskAttachments taskId={docId} collName={collName} userProfile={userProfile} />
                        </div>
                    )}
                    {activeTab === 'timeline' && (
                        <div className="animate-fade-in">
                            <TaskTimeline taskId={docId} collName={collName} />
                        </div>
                    )}

                </div>



                {/* Footer Section */}

                <div className="shrink-0 p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-800">

                    {activeTab === 'chat' ? (
                        <div className="text-[10px] text-center text-slate-400 font-bold py-1">المحادثة والدردشة نشطة الآن</div>
                    ) : (

                        <div className="flex flex-col gap-3">

                            {/* Main prominent action button at the top of footer */}
                            {(() => {
                                // 1. If task is executed and user is the sender: they can approve the design
                                if (task.status === 'executed' && effectiveSourceDept === userProfile?.departmentId) {
                                    return (
                                        <button 
                                            type="button"
                                            onClick={async () => {
                                                const taskRef = doc(db, collName, docId);
                                                const finalStatus = "completed";
                                                
                                                await updateDoc(taskRef, {
                                                    status: finalStatus,
                                                    progress: 100,
                                                    revisionRequested: false,
                                                    revisionNote: "",
                                                    completedAt: serverTimestamp(),
                                                    updatedAt: serverTimestamp()
                                                });

                                                // Log approval message
                                                await addDoc(collection(db, collName, docId, "messages"), {
                                                    type: "approval",
                                                    message: `✅ تم قبول واعتماد التصميم وغلق المهمة بنجاح.`,
                                                    senderId: user.uid,
                                                    senderName: userProfile?.displayName || user.email,
                                                    senderAvatar: userProfile?.photoURL || "",
                                                    seenBy: [user.uid],
                                                    createdAt: serverTimestamp()
                                                });

                                                if (collName === 'requests') {
                                                    await syncLinkedTasks(docId, finalStatus);
                                                    await awardTaskCompletionPointsOnce({
                                                        requestId: docId,
                                                        fallbackUserId: task.deliveredBy || task.assignedTo || user.uid,
                                                        fallbackUserName: task.deliveredByName || task.assignedToName || userProfile?.displayName || user.email,
                                                        taskTitle: task.title
                                                    });
                                                }

                                                if (collName === 'tasks' && task.linkedRequestId) {
                                                    const reqRef = doc(db, "requests", task.linkedRequestId);
                                                    await updateDoc(reqRef, {
                                                        status: finalStatus,
                                                        completedAt: serverTimestamp(),
                                                        revisionNote: "",
                                                        updatedAt: serverTimestamp()
                                                    });
                                                    await addDoc(collection(db, "requests", task.linkedRequestId, "messages"), {
                                                        type: "approval",
                                                        message: `✅ تم قبول واعتماد التصميم وغلق المهمة بنجاح.`,
                                                        senderId: user.uid,
                                                        senderName: userProfile?.displayName || user.email,
                                                        senderAvatar: userProfile?.photoURL || "",
                                                        seenBy: [user.uid],
                                                        createdAt: serverTimestamp()
                                                    });
                                                    await syncLinkedTasks(task.linkedRequestId, finalStatus);
                                                    await awardTaskCompletionPointsOnce({
                                                        requestId: task.linkedRequestId,
                                                        taskId: task.id,
                                                        fallbackUserId: task.deliveredBy || task.assignedTo || user.uid,
                                                        fallbackUserName: task.deliveredByName || task.assignedToName || userProfile?.displayName || user.email,
                                                        taskTitle: task.title
                                                    });
                                                } else if (collName === 'tasks') {
                                                    await awardTaskCompletionPointsOnce({
                                                        taskId: task.id,
                                                        fallbackUserId: task.deliveredBy || task.assignedTo || user.uid,
                                                        fallbackUserName: task.deliveredByName || task.assignedToName || userProfile?.displayName || user.email,
                                                        taskTitle: task.title
                                                    });
                                                }

                                                // ── In-app & Telegram Notifications for Approval ──
                                                try {
                                                    await addDoc(collection(db, "notifications"), {
                                                        type: 'task_completed',
                                                        targetDept: task.targetDept,
                                                        fromDept: task.sourceDept,
                                                        fromDeptName: DEPARTMENTS.find((d: any) => d.id === task.sourceDept)?.nameAr || task.sourceDept,
                                                        taskTitle: task.title,
                                                        isRead: false,
                                                        createdAt: new Date().toISOString(),
                                                        createdBy: userProfile?.displayName || user.email
                                                    });

                                                    if (onSendTelegram && telegramConfig) {
                                                        const route = resolveDepartmentLeadership(telegramConfig, task.targetDept, "manager_and_deputy");
                                                        const msg = `✅ <b>تم قبول واعتماد التصميم بنجاح</b>\n\n📌 <b>المهمة:</b> ${task.title}\n📤 <b>من القسم:</b> ${DEPARTMENTS.find((d: any) => d.id === task.sourceDept)?.nameAr || task.sourceDept}\n👤 <b>المنفذ:</b> ${task.performerName || 'العضو'}`;
                                                        sendTelegramToChatIds(onSendTelegram, route.chatIds, msg, route.botToken);
                                                    }
                                                } catch(e) { console.error('Approval notification error:', e); }

                                                toast.success("تم قبول واعتماد التصميم بنجاح!");
                                                onClose();
                                            }}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 transition"
                                        >
                                            <CheckCircle2 size={16}/> قبول واعتماد التصميم
                                        </button>
                                    );
                                }

                                // 2. If user is performer (canSubmit) and task is in progress: they can submit
                                const isSenderManager = effectiveSourceDept === userProfile?.departmentId && ['admin', 'manager', 'deputy'].includes(userProfile?.role);
                                const isExplicitAssignee = task.assignedTo === user.uid;
                                const canSubmit = effectiveTargetDept === userProfile?.departmentId && (!isSenderManager || isExplicitAssignee);

                                if (canSubmit && ['accepted', 'in_progress', 'revision'].includes(task.status)) {
                                    return (
                                        <button 
                                            type="button"
                                            onClick={() => setShowDeliveryCenter(true)}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10 transition"
                                        >
                                            تسليم المهمة (مركز التسليم)
                                        </button>
                                    );
                                }

                                return null;
                            })()}

                            {/* Secondary Action: Revision Request Panel */}
                            {effectiveSourceDept === userProfile?.departmentId && ['accepted', 'in_progress', 'executed', 'completed', 'revision'].includes(task.status) && (
                                <div className="flex flex-col gap-2.5 p-4 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-150 dark:border-indigo-900/30 rounded-2xl text-right">
                                    <h4 className="text-[11px] font-black text-indigo-700 dark:text-indigo-400">خيارات المراجعة والتعديل</h4>
                                    
                                    <button 
                                        type="button"
                                        onClick={async () => {
                                            const reason = prompt("يرجى ذكر سبب طلب التعديل (إجباري):");
                                            if (!reason || !reason.trim()) {
                                                toast.error("سبب التعديل إجباري لطلب المراجعة.");
                                                return;
                                            }

                                            const taskRef = doc(db, collName, docId);
                                            await updateDoc(taskRef, {
                                                status: "revision",
                                                revisionRequested: true,
                                                revisionNote: reason,
                                                progress: 90,
                                                updatedAt: serverTimestamp()
                                            });

                                            // Log revision message
                                            await addDoc(collection(db, collName, docId, "messages"), {
                                                type: "revision",
                                                message: `🔄 تم طلب تعديل على التصميم: ${reason}`,
                                                senderId: user.uid,
                                                senderName: userProfile?.displayName || user.email,
                                                senderAvatar: userProfile?.photoURL || "",
                                                seenBy: [user.uid],
                                                createdAt: serverTimestamp()
                                            });

                                            if (collName === 'requests') {
                                                await syncLinkedTasks(docId, 'revision', reason);
                                            }
                                            if (collName === 'tasks' && task.linkedRequestId) {
                                                const reqRef = doc(db, "requests", task.linkedRequestId);
                                                await updateDoc(reqRef, {
                                                    status: "revision",
                                                    updatedAt: serverTimestamp()
                                                });
                                                await addDoc(collection(db, "requests", task.linkedRequestId, "messages"), {
                                                    type: "revision",
                                                    message: `🔄 تم طلب تعديل على التصميم: ${reason}`,
                                                    senderId: user.uid,
                                                    senderName: userProfile?.displayName || user.email,
                                                    senderAvatar: userProfile?.photoURL || "",
                                                    seenBy: [user.uid],
                                                    createdAt: serverTimestamp()
                                                });
                                                await syncLinkedTasks(task.linkedRequestId, 'revision', reason);
                                            } else if (collName === 'tasks' && task.id) {
                                                await syncLinkedTasks(task.id, 'revision', reason);
                                            }

                                            // ── In-app & Telegram Notifications for Revision ──
                                            try {
                                                await addDoc(collection(db, "notifications"), {
                                                    type: 'task_revision',
                                                    targetDept: task.targetDept,
                                                    fromDept: task.sourceDept,
                                                    fromDeptName: DEPARTMENTS.find((d: any) => d.id === task.sourceDept)?.nameAr || task.sourceDept,
                                                    taskTitle: task.title,
                                                    isRead: false,
                                                    createdAt: new Date().toISOString(),
                                                    createdBy: userProfile?.displayName || user.email
                                                });

                                                if (onSendTelegram && telegramConfig) {
                                                    const route = resolveDepartmentLeadership(telegramConfig, task.targetDept, "manager_and_deputy");
                                                    const msg = `🔄 <b>طلب تعديل ومراجعة على التصميم</b>\n\n📌 <b>المهمة:</b> ${task.title}\n📤 <b>بواسطة القسم:</b> ${DEPARTMENTS.find((d: any) => d.id === task.sourceDept)?.nameAr || task.sourceDept}\n📝 <b>ملاحظة التعديل:</b> ${reason}`;
                                                    sendTelegramToChatIds(onSendTelegram, route.chatIds, msg, route.botToken);
                                                }
                                            } catch(e) { console.error('Revision notification error:', e); }

                                            toast.success("تم إرسال طلب التعديل بنجاح");
                                            onClose();
                                        }}
                                        className="w-full bg-rose-50 dark:bg-rose-950/20 text-rose-600 font-black text-xs py-3 rounded-xl hover:bg-rose-100 transition"
                                    >
                                        طلب تعديل
                                    </button>
                                </div>
                            )}

                            {task.status === 'pending_acceptance' && effectiveTargetDept === userProfile?.departmentId && (

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



                        </div>

                    )}

                </div>

            </motion.div>

            {showDeliveryCenter && (
                <TaskDeliveryCenter
                    isOpen={showDeliveryCenter}
                    onClose={() => setShowDeliveryCenter(false)}
                    task={task}
                    collName={collName}
                    user={user}
                    userProfile={userProfile}
                    onSuccess={() => setShowDeliveryCenter(false)}
                    telegramConfig={telegramConfig}
                    onSendTelegram={onSendTelegram}
                />
            )}

        </div>

    );

};



export default TaskPulseDrawer;
