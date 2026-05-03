
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { db } from "../services/firebase";
import { collection, onSnapshot, updateDoc, deleteDoc, doc, setDoc, getDoc } from "firebase/firestore";
import { 
  Heart, Quote, Settings, UserPlus, X, Send, Share2, 
  Megaphone, User as UserIcon, AlertCircle, Trash2, Eye, EyeOff, PlayCircle, Users, UserCheck, UserX, Fingerprint, Mail, Search, Bell, Plus,
  Layout, Check, ChevronUp, ChevronDown, Crown, Shield, Clock, LayoutDashboard, Activity, Save, MessageCircle, LogOut,
  Home, Radio, ArrowLeft, FileText, Calendar, Image, CheckCircle2, Flag
} from "lucide-react";
import { DEPARTMENTS, TELEGRAM_ROLES, SUPER_ADMIN_EMAIL, CHARITY_ROLES, USER_ROLES } from "../utils/constants";


export const WelcomeModal = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in-up">
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-0 max-w-lg w-full text-center relative shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
             <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 pt-10 relative">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] "></div>
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg">
                    <div className="bg-indigo-50 dark:bg-gray-700 p-4 rounded-full">
                         <Heart size={36} className="text-indigo-600 dark:text-indigo-400 fill-current" />
                    </div>
                </div>
             </div>
             <div className="pt-14 pb-8 px-8">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3 font-sans">
                    أهلاً بك في عائلة معوان
                </h2>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-2xl mb-6 relative mt-4 border border-orange-100 dark:border-orange-800/30">
                    <Quote size={20} className="text-orange-400 absolute top-4 right-4 opacity-50" />
                    <p className="text-gray-700 dark:text-gray-200 leading-relaxed font-medium text-lg pt-2">
                       "إنما الأعمال بالنيات"
                    </p>
                    <div className="w-16 h-1 bg-orange-200 mx-auto my-3 rounded-full"></div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-7">
                        نُذكرك وننفسنا بتجديد النية وإخلاص العمل لله تعالى. <br/>
                        اجعل من وقتك وجهدك في قضاء حوائج الناس باباً للأجر والرفعة، واحتسب كل دقيقة في ميزان حسناتكم.
                    </p>
                </div>
                <button onClick={onClose} className="w-full bg-gray-900 dark:bg-indigo-600 text-white py-4 rounded-xl font-bold hover:opacity-90 transition shadow-lg text-lg">
                   بسم الله توكلت على الله
                </button>
             </div>
        </div>
    </div>
);

export const AddUserModal = ({ show, onClose, onUserAdded }: any) => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("member");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) {
            alert("الرجاء ملء جميع الحقول");
            return;
        }
        setIsLoading(true);
        try {
            const userRef = doc(db, "users", email.toLowerCase());
            await setDoc(userRef, {
                displayName: name,
                email: email.toLowerCase(),
                role: role,
                createdAt: new Date().toISOString(),
                isBanned: false,
            });
            alert("تمت إضافة المستخدم بنجاح!");
            onUserAdded(); // To refresh the list
            onClose();
        } catch (error) {
            console.error("Error adding user: ", error);
            alert("حدث خطأ أثناء إضافة المستخدم.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[201] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2rem] shadow-2xl animate-fade-in-up">
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl text-gray-800 dark:text-white flex items-center gap-2"><UserPlus size={24} className="text-indigo-600"/> إضافة مستخدم جديد</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-500 mb-1">الاسم الكامل</label>
                        <input 
                            className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="مثال: علي محمد"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-500 mb-1">البريد الإلكتروني</label>
                        <input 
                            type="email"
                            className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="example@mail.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-500 mb-1">الدور</label>
                        <select 
                            className="w-full p-3 rounded-xl border dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        >
                            <option value="member">عضو</option>
                            <option value="manager">مدير</option>
                        </select>
                    </div>
                    <div className="pt-2">
                        <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {isLoading ? "جاري الإضافة..." : "إضافة المستخدم"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const UserManagementModal = ({ show, onClose }: any) => {
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [showAddUser, setShowAddUser] = useState(false);

    useEffect(() => {
        if (!show) return;
        const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [show]);

    const handleForceLogout = async (userId: string, userName: string) => {
        if(!window.confirm(`هل أنت متأكد من تسجيل خروج المستخدم \"${userName}\"?`)) return;
        try {
            await updateDoc(doc(db, "users", userId), { forceLogout: true });
            alert("تم إرسال أمر تسجيل الخروج");
        } catch (e: any) { alert("حدث خطأ: " + e.message); }
    };

    const handleToggleBan = async (userItem: any) => {
        const newBanStatus = !userItem.isBanned;
        const action = newBanStatus ? "حظر" : "فك حظر";
        if(!window.confirm(`هل تريد ${action} المستخدم \"${userItem.displayName || userItem.email}\"?`)) return;
        try {
            await updateDoc(doc(db, "users", userItem.id), { isBanned: newBanStatus });
        } catch (e: any) { alert("حدث خطأ: " + e.message); }
    };

    const handleDeleteUser = async (userId: string, userName: string) => {
        if(!window.confirm(`هل أنت متأكد من حذف المستخدم \"${userName}\"?`)) return;
        try {
            await deleteDoc(doc(db, "users", userId));
            alert("تم حذف المستخدم بنجاح");
        } catch (e: any) { alert("حدث خطأ أثناء الحذف: " + e.message); }
    };

    const filteredUsers = allUsers.filter(u => 
        (u.displayName && u.displayName.toLowerCase().includes(search.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
    );

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-[2rem] shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] animate-fade-in-up overflow-hidden">
                <div className="shrink-0 p-6 border-b dark:border-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-xl text-gray-800 dark:text-white flex items-center gap-2"><Users size={24} className="text-indigo-600"/> إدارة المستخدمين</h3>
                        <button onClick={() => setShowAddUser(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-700 transition">
                            <UserPlus size={14}/> إضافة
                        </button>
                    </div>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
                </div>
                
                <div className="shrink-0 p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <div className="relative">
                        <Search className="absolute right-3 top-3 text-gray-400" size={18} />
                        <input 
                            className="w-full p-2.5 pr-10 bg-white dark:bg-gray-800 border rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white dark:border-gray-700"
                            placeholder="بحث عن مستخدم..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredUsers.map(u => (
                            <div key={u.id} className={`bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border transition-all ${u.isBanned ? 'border-red-200 dark:border-red-900 bg-red-50/50' : 'border-gray-100 dark:border-gray-700'}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${u.isBanned ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                            {u.displayName?.[0] || 'U'}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-1.5">
                                                {u.role === 'manager' && <Crown size={14} className="text-yellow-500"/>}
                                                {u.displayName || "مستخدم"}
                                            </h3>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                                                <Fingerprint size={10}/> {u.uid.slice(0, 8)}...
                                            </div>
                                        </div>
                                    </div>
                                    {u.isBanned ? (
                                        <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold">محظور</span>
                                    ) : (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'manager' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-600'}`}>
                                            {u.role === 'manager' ? 'مدير' : 'نشط'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg mb-3">
                                    <Mail size={12}/> {u.email}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleForceLogout(u.id, u.displayName || u.email)} className="flex-1 py-1.5 bg-yellow-50 text-yellow-600 rounded-lg text-xs font-bold hover:bg-yellow-100 transition flex items-center justify-center gap-2">
                                        <LogOut size={14}/> خروج
                                    </button>
                                    <button onClick={() => handleToggleBan(u)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${u.isBanned ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>
                                        {u.isBanned ? <><UserCheck size={14}/> تفعيل</> : <><UserX size={14}/> حظر</>}
                                    </button>
                                    <button onClick={() => handleDeleteUser(u.id, u.displayName || u.email)} className="flex-1 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition flex items-center justify-center gap-2">
                                        <Trash2 size={14}/> حذف
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {showAddUser && 
                    <AddUserModal 
                        show={showAddUser} 
                        onClose={() => setShowAddUser(false)} 
                        onUserAdded={() => { /* Can add a refresh logic here if needed */ }}
                    />
                }
            </div>
        </div>
    );
};

export const CustomizeDashboardModal = ({ show, onClose, widgets, setWidgets }: any) => {
    if (!show) return null;

    const toggleVisibility = (id: string) => {
        setWidgets(widgets.map((w: any) => w.id === id ? { ...w, visible: !w.visible } : w));
    };

    const moveWidget = (index: number, direction: 'up' | 'down') => {
        const newWidgets = [...widgets];
        if (direction === 'up' && index > 0) {
            [newWidgets[index], newWidgets[index - 1]] = [newWidgets[index - 1], newWidgets[index]];
        } else if (direction === 'down' && index < newWidgets.length - 1) {
            [newWidgets[index], newWidgets[index + 1]] = [newWidgets[index + 1], newWidgets[index]];
        }
        setWidgets(newWidgets);
    };

    const handleSave = () => {
        localStorage.setItem('ma3wan_dashboard_widgets', JSON.stringify(widgets));
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-fade-in-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2"><Layout size={20}/> تخصيص اللوحة</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400"/></button>
                </div>
                
                <div className="space-y-3 mb-6">
                    {widgets.map((widget: any, idx: number) => (
                        <div key={widget.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <button onClick={() => toggleVisibility(widget.id)} className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${widget.visible ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-400 bg-transparent'}`}>
                                    {widget.visible && <Check size={14}/>}
                                </button>
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{widget.label}</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => moveWidget(idx, 'up')} disabled={idx === 0} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500 disabled:opacity-30"><ChevronUp size={16}/></button>
                                <button onClick={() => moveWidget(idx, 'down')} disabled={idx === widgets.length - 1} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500 disabled:opacity-30"><ChevronDown size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg">حفظ الترتيب</button>
            </div>
        </div>
    );
};

export const SettingsModal = ({ 
    show, onClose, editProfileName, setEditProfileName, handleUpdateProfile, userEmail, onOpenUserManagement, userProfile, setUserProfile
}: any) => {
    const [showCreds, setShowCreds] = useState(false);
    const isSuperAdmin = userEmail?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    if (!show) return null;

    const currentRole = [...USER_ROLES, ...CHARITY_ROLES].find(r => r.id === userProfile?.role)?.name || 'عضو';

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-3 sm:p-4 backdrop-blur-md" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Gradient Header */}
                <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-6 pb-8 overflow-hidden shrink-0">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"/>
                    <button onClick={onClose} className="absolute top-4 left-4 w-8 h-8 bg-white/20 hover:bg-white/30 flex items-center justify-center rounded-full transition text-white">
                        <X size={16}/>
                    </button>
                    <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-white/30 to-white/10 border-2 border-white/40 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white font-black text-2xl shadow-xl backdrop-blur-sm">
                            {editProfileName?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <p className="text-white font-black text-base leading-tight">{editProfileName || 'المستخدم'}</p>
                        <p className="text-indigo-200 text-xs mt-1 font-medium">{currentRole}</p>
                    </div>
                </div>

                {/* Body */}
                <div className="mx-4 my-4 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800 custom-scrollbar">
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">الاسم المعروض</label>
                            <input
                                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition"
                                value={editProfileName}
                                onChange={(e: any) => setEditProfileName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">اللقب (الصفة)</label>
                            <select
                                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition"
                                value={userProfile?.role || 'member'}
                                onChange={(e: any) => setUserProfile({...userProfile, role: e.target.value})}
                            >
                                <optgroup label="أدوار عامة">
                                    {USER_ROLES.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                                </optgroup>
                                <optgroup label="أدوار القسم الخيري">
                                    {CHARITY_ROLES.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                                </optgroup>
                            </select>
                        </div>
                        <button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-indigo-500/30 text-sm">
                            حفظ التغييرات
                        </button>
                    </form>
                </div>

                {/* Super Admin Section */}
                {isSuperAdmin && (
                    <div className="mx-4 mt-3 mb-4 space-y-2">
                        <button
                            onClick={() => { onClose(); onOpenUserManagement(); }}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 hover:border-indigo-200 transition text-sm"
                        >
                            <Users size={16}/> إدارة المستخدمين
                        </button>
                        <button onClick={() => setShowCreds(!showCreds)} className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition w-full justify-center py-1">
                            {showCreds ? <EyeOff size={13}/> : <Eye size={13}/>}
                            بيانات المدير (للتذكير)
                        </button>
                        {showCreds && (
                            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl space-y-2 text-xs border dark:border-gray-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Super Admin:</span>
                                    <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border dark:border-gray-700 select-all text-gray-600 dark:text-gray-300">{SUPER_ADMIN_EMAIL}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Blood Bank:</span>
                                    <span className="font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border dark:border-gray-700 text-red-500 font-bold select-all">Mn ahiaha</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- HR Profile Modal ---
export const HRProfileModal = ({ 
    show, onClose, hrTempName, setHrTempName, handleCreateHRProfile, telegramConfig 
}: any) => {
    const [hrSection, setHrSection] = useState("general");
    const [hrRole, setHrRole] = useState("member"); 
    const [selectedHRId, setSelectedHRId] = useState("");

    const hrContacts = telegramConfig?.generalContacts?.find((c: any) => c.departmentId === 'hr')?.contacts || [];

    useEffect(() => {
        if (selectedHRId) {
            const contact = hrContacts.find((c: any) => c.chatId === selectedHRId);
            if (contact) {
                setHrTempName(contact.name);
                if (contact.responsibleForDept) setHrSection(contact.responsibleForDept);
                // Map role if possible, or default
                // Assuming role in telegram config matches hrRole values or similar
                // If not exact match, maybe keep default or try to map
                // For now, let's assume manual role selection or default
            }
        }
    }, [selectedHRId, hrContacts, setHrTempName]);

    if (!show) return null;
    
    // Inject extra fields into the handler
    const onSubmit = (e: React.FormEvent) => {
        // Save full details to local storage for the session
        localStorage.setItem("ma3wan_hr_section", hrSection);
        localStorage.setItem("ma3wan_hr_role", hrRole);
        
        sessionStorage.setItem("ma3wan_hr_session_active", "true"); 
        
        handleCreateHRProfile(e);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-fade-in-up relative overflow-hidden">
                {/* Close button removed to enforce login or exit */}
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus size={36} />
                    </div>
                    <h3 className="font-bold text-xl text-gray-800 dark:text-white">تسجيل دخول (HR)</h3>
                    <p className="text-gray-500 text-xs mt-2">جلسة عمل خاصة بالموارد البشرية</p>
                </div>
                <form onSubmit={onSubmit} className="space-y-4">
                    
                    {/* HR Selection from Config */}
                    {hrContacts.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-500">اختر عضويتك (إذا مسجلة)</label>
                            <select 
                                className="w-full p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-700 outline-none text-xs font-bold text-indigo-800 dark:text-indigo-300"
                                value={selectedHRId}
                                onChange={(e) => setSelectedHRId(e.target.value)}
                            >
                                <option value="">-- اختر اسمك من القائمة --</option>
                                {hrContacts.map((c: any, idx: number) => (
                                    <option key={idx} value={c.chatId}>{c.name} {c.responsibleForDept ? `(مسؤول ${DEPARTMENTS.find(d => d.id === c.responsibleForDept)?.nameAr || c.responsibleForDept})` : ''}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold mb-1 text-gray-500">الاسم (ثنائي)</label>
                        <input required className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 outline-none text-center font-bold text-gray-800 dark:text-white" placeholder="أحمد محمد" value={hrTempName} onChange={(e: any) => setHrTempName(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-500">القسم المسؤول عنه</label>
                            <select 
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 outline-none text-xs font-bold"
                                value={hrSection}
                                onChange={(e) => setHrSection(e.target.value)}
                            >
                                <option value="general">الموارد البشرية (عام)</option>
                                {DEPARTMENTS.filter(d => d.id !== 'hr' && d.id !== 'management').map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.nameAr || dept.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-500">الصفة</label>
                            <select 
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 outline-none text-xs font-bold"
                                value={hrRole}
                                onChange={(e) => setHrRole(e.target.value)}
                            >
                                <option value="member">عضو</option>
                                <option value="deputy">نائب القسم</option>
                                <option value="manager">رئيس القسم</option>
                            </select>
                        </div>
                    </div>

                    <button className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-orange-600 shadow-lg transition transform hover:scale-[1.02]">بدء الجلسة</button>
                    
                    <button type="button" onClick={onClose} className="w-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-3 rounded-xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                        خروج من القسم
                    </button>
                </form>
            </div>
        </div>
    );
};

export const ForwardTaskModal = ({ 
    modalState, setModalState, forwardNote, setForwardNote, confirmForwardTask,
    forwardMemberName, setForwardMemberName, activeDeptId
}: any) => {
    const [brandLogos, setBrandLogos]     = useState<{name: string, url: string}[]>([]);
    const [selectedLogos, setSelectedLogos] = useState<string[]>([]);
    const [urgency, setUrgency]           = useState<'normal' | 'urgent' | 'very_urgent'>('normal');
    const [showLogos, setShowLogos]       = useState(false);
    const [localTargetDeptId, setLocalTargetDeptId] = useState("");

    const targetDept = DEPARTMENTS.find(d => d.id === (modalState.targetDept || localTargetDeptId));
    const sourceDept = DEPARTMENTS.find(d => d.id === activeDeptId);

    useEffect(() => {
        if (modalState.isOpen) {
            setSelectedLogos([]);
            setUrgency('normal');
            setShowLogos(false);
            setLocalTargetDeptId(modalState.targetDept || "");
            const fetchBrand = async () => {
                try {
                    const docSnap = await getDoc(doc(db, "app_settings", "brand_identity"));
                    if (docSnap.exists()) setBrandLogos(docSnap.data().additionalLogos || []);
                } catch (e) { console.error(e); }
            };
            fetchBrand();
        }
    }, [modalState.isOpen, modalState.targetDept]);

    const toggleLogo = (n: string) => setSelectedLogos(p => p.includes(n) ? p.filter(l => l !== n) : [...p, n]);

    const urgencyConfig = {
        normal:     { label: 'عادي',    color: 'text-gray-600',   bg: 'bg-gray-100 dark:bg-gray-700',   ring: 'ring-gray-300',   grad: 'from-gray-400 to-gray-500' },
        urgent:     { label: 'عاجل',    color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', ring: 'ring-orange-400', grad: 'from-orange-500 to-amber-600' },
        very_urgent:{ label: 'عاجل جداً', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20',   ring: 'ring-red-400',    grad: 'from-red-500 to-rose-600' },
    };
    const urg = urgencyConfig[urgency];

    const handleConfirm = () => {
        if (!targetDept) return;
        // In the parent Dashboard, confirmForwardTask needs to know the targetDept
        // If it was selected locally, we'll need to pass it.
        // Let's assume confirmForwardTask is upgraded to accept it or uses modalState.targetDept
        // We'll update Dashboard.tsx next.
        confirmForwardTask(selectedLogos, urgency, localTargetDeptId);
    };

    if (!modalState.isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4" onClick={() => setModalState({ isOpen: false, task: null, targetDept: '' })}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full md:max-w-lg bg-white dark:bg-gray-800 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] border border-white/20"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* ── Premium High Header ── */}
                <div className={`relative bg-gradient-to-br ${urg.grad} p-5 sm:p-6 overflow-hidden shrink-0 transition-all duration-700`}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none animate-pulse-slow"/>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl pointer-events-none"/>
                    
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-white/30 rotate-3">
                                {targetDept ? <targetDept.icon size={22} className="text-white"/> : <Share2 size={22} className="text-white"/>}
                            </div>
                            <div>
                                <h3 className="text-white font-black text-2xl tracking-tight leading-none mb-1">تحويل مهمة</h3>
                                <div className="flex items-center gap-1.5 text-white/70 text-[10px] font-bold">
                                    <span className="bg-white/10 px-2 py-0.5 rounded-full">{sourceDept?.nameAr || 'المصدر'}</span>
                                    <Send size={8} className="rotate-180 opacity-50"/>
                                    <span className={targetDept ? "bg-white/30 text-white px-2 py-0.5 rounded-full" : "bg-red-500/30 text-red-100 px-2 py-0.5 rounded-full animate-pulse"}>
                                        {targetDept?.nameAr || 'انتظار اختيار القسم...'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setModalState({ isOpen: false, task: null, targetDept: '' })}
                            className="w-10 h-10 bg-white/10 hover:bg-red-500 rounded-2xl flex items-center justify-center text-white transition-all transform hover:rotate-90 active:scale-90 border border-white/5 shadow-inner">
                            <X size={18}/>
                        </button>
                    </div>
                </div>

                {/* ── Floating Body Card ── */}
                <div className="mx-4 my-4 min-h-0 flex-1 overflow-y-auto custom-scrollbar px-1">
                    <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/50 dark:border-gray-800 p-5 sm:p-6 space-y-6">

                        {/* Task Preview (Minified) */}
                        <div className={`p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-100 dark:border-gray-700 relative group`}>
                            <div className="absolute -top-3 right-4 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-lg text-[9px] font-black text-gray-500 uppercase tracking-widest shadow-sm">مراجعة المهمة</div>
                            <p className="text-sm font-black text-gray-800 dark:text-gray-100 leading-relaxed mb-1">
                                {modalState.task?.title}
                            </p>
                            {modalState.task?.deadline && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"/>
                                    {modalState.task.deadline}
                                </div>
                            )}
                        </div>

                        {/* Destination Selector (If needed) */}
                        {(!modalState.targetDept) && (
                            <div>
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3 flex items-center gap-2">
                                    <Layout size={12} className="text-indigo-500"/> اختر القسم المستلم
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {DEPARTMENTS.filter(d => d.id !== activeDeptId && d.id !== 'management').map(d => (
                                        <button key={d.id} onClick={() => setLocalTargetDeptId(d.id)}
                                            className={`flex flex-col items-center gap-2 p-2 rounded-2xl border-2 transition-all ${localTargetDeptId === d.id ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 scale-105 shadow-md shadow-indigo-200/20' : 'bg-gray-50 dark:bg-gray-800/50 border-transparent hover:border-gray-200 dark:hover:border-gray-700 opacity-70 hover:opacity-100'}`}>
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${d.bgClass?.split(' ')[0] || 'bg-indigo-500'}`}>
                                                <d.icon size={16} className="text-white"/>
                                            </div>
                                            <span className="text-[9px] font-black truncate w-full text-center">{d.nameAr}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Urgency Selector */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2">مستوى الإلحاح</label>
                            <div className="flex gap-2">
                                {(Object.entries(urgencyConfig) as any[]).map(([key, meta]: [string, any]) => (
                                    <button key={key} onClick={() => setUrgency(key as any)}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition border-2 ${urgency === key ? `${meta.bg} ${meta.color} border-current` : 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-transparent hover:border-gray-200'}`}>
                                        {meta.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Forward Note */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2">ملاحظات التحويل / المطلوب</label>
                            <textarea
                                autoFocus
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white h-24 resize-none text-sm placeholder-gray-300 dark:placeholder-gray-600 transition"
                                placeholder="اكتب المطلوب من القسم عند استلام المهمة..."
                                value={forwardNote}
                                onChange={(e: any) => setForwardNote(e.target.value)}
                            />
                        </div>

                        {/* Assign Member */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2">تعيين لعضو محدد (اختياري)</label>
                            <div className="relative">
                                <Users size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                <input
                                    className="w-full pr-9 pl-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white text-sm placeholder-gray-300 dark:placeholder-gray-600 transition"
                                    placeholder="اسم العضو المستلم..."
                                    value={forwardMemberName}
                                    onChange={(e: any) => setForwardMemberName(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Logos Section (toggle) */}
                        {brandLogos.length > 0 && (
                            <div>
                                <button onClick={() => setShowLogos(!showLogos)}
                                    className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-wider hover:text-indigo-500 transition">
                                    <Image size={13}/> اللوجوهات المطلوبة {selectedLogos.length > 0 && <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">{selectedLogos.length}</span>}
                                    <ChevronDown size={12} className={`transition-transform ${showLogos ? 'rotate-180' : ''}`}/>
                                </button>
                                {showLogos && (
                                    <div className="mt-2 grid grid-cols-4 gap-2">
                                        {brandLogos.map((logo, idx) => (
                                            <button key={idx} type="button" onClick={() => toggleLogo(logo.name)}
                                                className={`relative aspect-square rounded-xl border-2 overflow-hidden transition-all ${selectedLogos.includes(logo.name) ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-md' : 'border-gray-200 dark:border-gray-600 opacity-60 hover:opacity-90'}`}>
                                                <img src={logo.url} alt={logo.name} className="w-full h-full object-contain p-1"/>
                                                {selectedLogos.includes(logo.name) && (
                                                    <div className="absolute top-1 right-1 bg-indigo-500 text-white rounded-full p-0.5">
                                                        <CheckCircle2 size={9}/>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Action Footer ── */}
                <div className="bg-gray-50 dark:bg-gray-900/50 px-6 pb-8 pt-4 shrink-0 flex gap-4 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={() => setModalState({ isOpen: false, task: null, targetDept: '' })}
                        className="px-6 py-4 text-xs font-black text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-2xl transition-all">
                        تراجع
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!targetDept}
                        className={`flex-1 py-4 text-sm font-black text-white bg-gradient-to-r ${urg.grad} rounded-[1.5rem] shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale disabled:pointer-events-none relative overflow-hidden group/btn`}>
                        <div className="absolute inset-0 bg-white/20 translate-x-full group-hover/btn:-translate-x-full transition-transform duration-700 skew-x-12"/>
                        <Send size={18} className="rotate-180 drop-shadow-md"/>
                        تحويل إلى {targetDept?.nameAr || 'اختيار قسم'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export const CreateEventModal = ({ 
    show, onClose, newEvent, setNewEvent, handleCreateEvent, isEditing 
}: any) => {
    const [customVal, setCustomVal] = useState(1);
    const [customUnit, setCustomUnit] = useState('hours');

    if (!show) return null;

    const addReminder = () => {
        const val = Number(customVal);
        if (!val || val <= 0) return;
        let mins = val;
        if (customUnit === 'hours') mins = val * 60;
        if (customUnit === 'days') mins = val * 1440;
        
        const current = newEvent.notificationSettings?.reminders || [];
        if (!current.includes(mins)) {
             setNewEvent({...newEvent, notificationSettings: {...newEvent.notificationSettings, reminders: [...current, mins].sort((a:number,b:number)=>b-a)}});
        }
    };

    const removeReminder = (r: number) => {
        const current = newEvent.notificationSettings?.reminders || [];
        setNewEvent({...newEvent, notificationSettings: {...newEvent.notificationSettings, reminders: current.filter((x:number) => x !== r)}});
    };

    const formatReminder = (mins: number) => {
        if (mins % 1440 === 0) return `${mins/1440} يوم`;
        if (mins % 60 === 0) return `${mins/60} ساعة`;
        return `${mins} دقيقة`;
    };

    const updateEventDate = (date: string) => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const nextEvent = { ...newEvent, date };
        if (newEvent.isRecurring && date) {
            nextEvent.recurrenceDay = dayNames[new Date(`${date}T00:00:00`).getDay()];
        }
        setNewEvent(nextEvent);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-gray-850 w-full max-w-lg rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl animate-fade-in-up max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col border border-white/20 dark:border-gray-700/50">
                {/* Modern Header */}
                <div className="relative p-5 sm:p-8 sm:pb-6 overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-600/10 to-purple-600/10 dark:from-indigo-500/5 dark:to-transparent -z-10"></div>
                    <div className="flex justify-between items-center relative">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none rotate-3">
                                <Megaphone size={28} className="text-white -rotate-3" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl text-gray-800 dark:text-white leading-tight">
                                    {isEditing ? "تعديل الإعلان" : "نشر إعلان جديد"}
                                </h3>
                                <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">الإدارة العامة للجمعية</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-300"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleCreateEvent} className="min-h-0 flex-1 overflow-y-auto p-5 pt-2 sm:p-8 sm:pt-2 custom-scrollbar space-y-8">
                    {/* Section 1: Basic Info */}
                    <div className="space-y-6">
                        <div className="group">
                            <label className="flex items-center gap-2 text-xs font-black text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-widest pl-1">
                                <FileText size={14} className="text-indigo-500" /> موضوع الإعلان
                            </label>
                            <input 
                                required 
                                className="w-full p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 outline-none text-gray-800 dark:text-white font-bold text-lg transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600 shadow-sm"
                                value={newEvent.title} 
                                onChange={(e: any) => setNewEvent({...newEvent, title: e.target.value})} 
                                placeholder="مثال: اجتماع الجمعية العمومية..." 
                            />
                        </div>

                        {/* Recurring Switch */}
                        <div className="flex items-center justify-between p-5 bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-800/50 transition-all">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${newEvent.isRecurring ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-indigo-400'}`}>
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-300">اجتماع دوري (ثابت)</h4>
                                    <p className="text-[10px] text-indigo-600 dark:text-indigo-500 font-bold">يتكرر تلقائياً بشكل أسبوعي</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={newEvent.isRecurring || false} 
                                    onChange={(e) => setNewEvent({...newEvent, isRecurring: e.target.checked})} 
                                />
                                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[20px] after:w-[20px] after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 shadow-inner"></div>
                            </label>
                        </div>
                    </div>

                    {newEvent.isRecurring && (
                        <div className="space-y-3 rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-900/10">
                            <label className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest pl-1">
                                <Calendar size={14} /> تاريخ أول اجتماع ثابت
                            </label>
                            <input
                                type="date"
                                required
                                className="w-full p-4 bg-white dark:bg-gray-900 rounded-2xl border-2 border-transparent focus:border-indigo-500 dark:text-white font-bold text-sm outline-none shadow-sm transition-all"
                                value={newEvent.date}
                                onChange={(e: any) => updateEventDate(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Section 2: Date & Time */}
                    <div className="grid grid-cols-2 gap-5 pt-2">
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                                <Calendar size={14} /> {newEvent.isRecurring ? "يوم التكرار" : "التاريخ"}
                            </label>
                            <div className="relative">
                                {newEvent.isRecurring ? (
                                    <select 
                                        className="w-full p-4 pl-10 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-transparent focus:border-indigo-500 dark:text-white font-bold text-sm appearance-none outline-none shadow-sm transition-all"
                                        value={newEvent.recurrenceDay || 'Thursday'}
                                        onChange={(e) => setNewEvent({...newEvent, recurrenceDay: e.target.value})}
                                    >
                                        <option value="Saturday">السبت</option>
                                        <option value="Sunday">الأحد</option>
                                        <option value="Monday">الاثنين</option>
                                        <option value="Tuesday">الثلاثاء</option>
                                        <option value="Wednesday">الأربعاء</option>
                                        <option value="Thursday">الخميس</option>
                                        <option value="Friday">الجمعة</option>
                                    </select>
                                ) : (
                                    <input type="date" required={!newEvent.isRecurring} className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-transparent focus:border-indigo-500 dark:text-white font-bold text-sm outline-none shadow-sm transition-all" value={newEvent.date} onChange={(e: any) => setNewEvent({...newEvent, date: e.target.value})} />
                                )}
                                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> الوقت
                            </label>
                            <input type="time" required className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-transparent focus:border-indigo-500 dark:text-white font-bold text-sm outline-none shadow-sm transition-all" value={newEvent.time} onChange={(e: any) => setNewEvent({...newEvent, time: e.target.value})} />
                        </div>
                    </div>

                    {/* Section 3: Location Type - Segmented Control */}
                    <div className="space-y-3 pt-2">
                        <label className="flex items-center gap-2 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                            <Activity size={14} /> نوع وطبيعة اللقاء
                        </label>
                        <div className="flex bg-gray-100 dark:bg-gray-900/50 p-2 rounded-[1.25rem] relative">
                            <div 
                                className="absolute top-2 bottom-2 w-[calc(50%-12px)] bg-white dark:bg-gray-700 rounded-xl shadow-md transition-all duration-500 ease-out z-0"
                                style={{ transform: `translateX(${newEvent.type === 'online' ? (document.documentElement.dir === 'rtl' ? '-100%' : '100%') : '0'})` }}
                            ></div>
                            <button 
                                type="button" 
                                onClick={() => setNewEvent({...newEvent, type: 'offline'})} 
                                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all relative z-10 flex items-center justify-center gap-2 ${newEvent.type === 'offline' ? 'text-indigo-600 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Home size={16}/> حضوري
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setNewEvent({...newEvent, type: 'online'})} 
                                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all relative z-10 flex items-center justify-center gap-2 ${newEvent.type === 'online' ? 'text-indigo-600 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Radio size={16}/> أونلاين
                            </button>
                        </div>
                    </div>
                    
                    {/* Location/Link Input with Dynamic Icon */}
                    <div className="animate-fade-in-up">
                        <label className="flex items-center gap-2 text-xs font-black text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-widest pl-1">
                            {newEvent.type === 'online' ? <div className="flex items-center gap-2"><ArrowLeft size={14} className="rotate-135" /> رابط الاجتماع المباشر</div> : <div className="flex items-center gap-2"><Home size={14} /> الملحق / مقر اللقاء</div>}
                        </label>
                        <div className="relative group">
                            <input 
                                className={`w-full p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-transparent focus:border-indigo-500 dark:text-white font-bold text-sm shadow-sm transition-all focus:bg-white dark:focus:bg-gray-900 pl-12 ${newEvent.type === 'online' ? 'dir-ltr' : ''}`} 
                                value={newEvent.link || newEvent.details || ""} 
                                onChange={(e: any) => {
                                    if(newEvent.type === 'online') setNewEvent({...newEvent, link: e.target.value});
                                    else setNewEvent({...newEvent, details: e.target.value});
                                }} 
                                placeholder={newEvent.type === 'online' ? "https://zoom.us/j/..." : "مثال: مقر الجمعية - القاعة الرئيسية"} 
                            />
                            {newEvent.type === 'online' ? <Radio className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-500 animate-pulse" size={18} /> : <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors"><Home size={18} /></div>}
                        </div>
                    </div>

                    {/* Section 4: Notifications (Telegram) */}
                    <div className="pt-4">
                        <div className="bg-gray-50 dark:bg-gray-900/30 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
                            {/* Decorative element */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>

                            <div className="flex items-center justify-between mb-8 relative">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-sm">
                                        <Bell size={22} className={newEvent.notificationSettings?.enabled !== false ? 'animate-bounce' : ''} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 dark:text-white">إعدادات الإشعار والتنبيه</h4>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Telegram Auto-Reminders</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer scale-90">
                                    <input type="checkbox" className="sr-only peer" checked={newEvent.notificationSettings?.enabled ?? true} onChange={(e) => setNewEvent({...newEvent, notificationSettings: {...newEvent.notificationSettings, enabled: e.target.checked}})} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                                </label>
                            </div>
                            
                            {(newEvent.notificationSettings?.enabled ?? true) && (
                                <div className="space-y-6 animate-fade-in">
                                    {/* Immediate Notif Toggle */}
                                    <label className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-indigo-200 transition-all shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center">
                                                <Megaphone size={16} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-gray-700 dark:text-gray-200">إرسال إشعار فوري عند الحفظ</span>
                                                <span className="text-[9px] text-gray-400 font-bold">سيصل الإعلان مباشرة للقنوات المشتركة</span>
                                            </div>
                                        </div>
                                        <input type="checkbox" className="w-5 h-5 rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all" checked={newEvent.sendImmediateNotification ?? true} onChange={(e) => setNewEvent({...newEvent, sendImmediateNotification: e.target.checked})} />
                                    </label>

                                    {/* Automated Reminders Builder */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">التذكيرات الآلية (قبل الموعد)</span>
                                        </div>
                                        
                                        {/* Input Builder */}
                                        <div className="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm focus-within:border-indigo-500 transition-all">
                                            <input 
                                                type="number" 
                                                min="1" 
                                                className="w-16 p-2 bg-transparent dark:text-white text-center font-bold text-sm outline-none"
                                                value={customVal}
                                                onChange={(e) => setCustomVal(Number(e.target.value))}
                                            />
                                            <select 
                                                className="flex-1 bg-transparent dark:text-white text-xs font-bold outline-none border-r border-gray-100 dark:border-gray-700 mr-2 pr-3"
                                                value={customUnit}
                                                onChange={(e) => setCustomUnit(e.target.value)}
                                            >
                                                <option value="minutes">دقيقة</option>
                                                <option value="hours">ساعة</option>
                                                <option value="days">يوم</option>
                                            </select>
                                            <button 
                                                type="button" 
                                                onClick={addReminder} 
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-md shadow-indigo-100 dark:shadow-none"
                                            >
                                                <Plus size={20}/>
                                            </button>
                                        </div>

                                        {/* Reminders List (Chips) */}
                                        <div className="flex flex-wrap gap-2 min-h-[40px]">
                                            {(newEvent.notificationSettings?.reminders || []).map((r: number) => (
                                                <div key={r} className="flex items-center gap-2 bg-white dark:bg-gray-800 pl-2 pr-3 py-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm group hover:border-indigo-200 transition-all">
                                                    <Clock size={12} className="text-indigo-500" />
                                                    <span className="text-[11px] font-black text-gray-700 dark:text-gray-300">قبل {formatReminder(r)}</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeReminder(r)} 
                                                        className="w-6 h-6 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all flex items-center justify-center"
                                                    >
                                                        <X size={14}/>
                                                    </button>
                                                </div>
                                            ))}
                                            {(newEvent.notificationSettings?.reminders || []).length === 0 && (
                                                <div className="flex items-center justify-center w-full py-4 text-gray-400 font-bold text-xs italic opacity-50">لا يوجد تذكيرات مفعّلة</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Data Fields Inclusion */}
                                    <div className="grid grid-cols-1 gap-2 border-t border-gray-100 dark:border-gray-800 pt-6">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className="w-5 h-5 rounded-md border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center transition-all group-hover:border-indigo-400">
                                                <input type="checkbox" className="absolute opacity-0 cursor-pointer w-5 h-5" checked={newEvent.notificationSettings?.includeTime ?? true} onChange={(e) => setNewEvent({...newEvent, notificationSettings: {...newEvent.notificationSettings, includeTime: e.target.checked}})} />
                                                {newEvent.notificationSettings?.includeTime !== false && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                                            </div>
                                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">إظهار الوقت والتاريخ في الإشعار</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className="w-5 h-5 rounded-md border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center transition-all group-hover:border-indigo-400">
                                                <input type="checkbox" className="absolute opacity-0 cursor-pointer w-5 h-5" checked={newEvent.notificationSettings?.includeLocation ?? true} onChange={(e) => setNewEvent({...newEvent, notificationSettings: {...newEvent.notificationSettings, includeLocation: e.target.checked}})} />
                                                {newEvent.notificationSettings?.includeLocation !== false && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                                            </div>
                                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">تضمين الرابط / الموقع (Location)</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Final Action Area */}
                    <div className="pt-8 pb-4">
                        <button 
                            type="submit" 
                            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white py-5 rounded-[2rem] font-black text-lg transition-all shadow-xl shadow-indigo-200 dark:shadow-none transform active:scale-[0.98] flex items-center justify-center gap-4 group"
                        >
                            <Save size={24} className="group-hover:rotate-12 transition-transform" />
                            {isEditing ? "حفظ التعديلات الحالية" : "اعتماد العرض ونشر الإعلان"}
                        </button>
                        <p className="text-center text-[10px] text-gray-400 mt-4 font-bold uppercase tracking-widest">بمجرد الضغط على الزر سيتم إرسال كافة التنبيهات المذكورة أعلاه</p>
                    </div>
                </form>
            </div>
        </div>
    );
};


export const TelegramConfigModal = ({ isOpen, onClose, config, onSave, departments }: any) => {
    const [activeTab, setActiveTab] = useState<'general' | 'volunteer' | 'waman'>('general');
    const [localConfig, setLocalConfig] = useState<any>(null);
    const [newContact, setNewContact] = useState({ name: '', chatId: '', role: '', type: 'donor' as 'donor' | 'distress', responsibleForDept: '' });
    const [selectedDept, setSelectedDept] = useState('general');

    useEffect(() => {
        if (isOpen && config) {
            setLocalConfig(JSON.parse(JSON.stringify(config)));
        }
    }, [isOpen, config]);

    if (!isOpen || !localConfig) return null;

    const handleAddContact = () => {
        if (!newContact.name || !newContact.chatId) {
            alert("الرجاء إدخال الاسم ومعرف الدردشة");
            return;
        }

        const updated = { ...localConfig };
        const contact = { 
            name: newContact.name, 
            chatId: newContact.chatId, 
            role: newContact.role,
            responsibleForDept: newContact.responsibleForDept 
        };

        if (activeTab === 'general') {
            let dept = updated.generalContacts.find((c: any) => c.departmentId === selectedDept);
            if (!dept) {
                dept = { departmentId: selectedDept, contacts: [] };
                updated.generalContacts.push(dept);
            }
            dept.contacts.push(contact);
        } else if (activeTab === 'volunteer') {
            let dept = updated.volunteerContacts.find((c: any) => c.departmentId === selectedDept);
            if (!dept) {
                dept = { departmentId: selectedDept, contacts: [] };
                updated.volunteerContacts.push(dept);
            }
            dept.contacts.push(contact);
        } else if (activeTab === 'waman') {
            let group = updated.wamanAhyaahaContacts.find((c: any) => c.type === newContact.type);
            if (!group) {
                group = { type: newContact.type, contacts: [] };
                updated.wamanAhyaahaContacts.push(group);
            }
            group.contacts.push(contact);
        }

        setLocalConfig(updated);
        setNewContact({ ...newContact, name: '', chatId: '', role: '', responsibleForDept: '' });
    };

    const handleDeleteContact = (groupType: string, deptIdOrWamanType: string, index: number) => {
        const updated = { ...localConfig };
        if (groupType === 'general') {
            const dept = updated.generalContacts.find((c: any) => c.departmentId === deptIdOrWamanType);
            if (dept) dept.contacts.splice(index, 1);
        } else if (groupType === 'volunteer') {
            const dept = updated.volunteerContacts.find((c: any) => c.departmentId === deptIdOrWamanType);
            if (dept) dept.contacts.splice(index, 1);
        } else if (groupType === 'waman') {
            const group = updated.wamanAhyaahaContacts.find((c: any) => c.type === deptIdOrWamanType);
            if (group) group.contacts.splice(index, 1);
        }
        setLocalConfig(updated);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[201] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="shrink-0 p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-2xl flex items-center gap-3"><MessageCircle className="text-blue-500"/> إعدادات Telegram المتقدمة</h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><X/></button>
                    </div>
                    <div className="flex gap-2 mt-4 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl overflow-x-auto">
                        <button onClick={() => { setActiveTab('general'); setSelectedDept('general'); }} className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'general' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-white' : 'text-gray-500'}`}>الإشعارات العامة</button>
                        <button onClick={() => { setActiveTab('volunteer'); setSelectedDept('general'); }} className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'volunteer' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-white' : 'text-gray-500'}`}>طلبات التطوع</button>
                        <button onClick={() => { setActiveTab('waman'); }} className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'waman' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-white' : 'text-gray-500'}`}>ومن أحياها</button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        <>
                            {/* Add New Contact Form */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">إضافة جهة اتصال جديدة</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <input className="p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="الاسم (مثلاً: م. أحمد)" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                            <input className="p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Chat ID" value={newContact.chatId} onChange={e => setNewContact({...newContact, chatId: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {activeTab !== 'waman' ? (
                                <select className="p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={selectedDept} onChange={e => {
                                    setSelectedDept(e.target.value);
                                    setNewContact({...newContact, responsibleForDept: ''});
                                }}>
                                    <option value="general">الإدارة العامة</option>
                                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.nameAr}</option>)}
                                </select>
                            ) : (
                                <select className="p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={newContact.type} onChange={e => setNewContact({...newContact, type: e.target.value as any})}>
                                    <option value="donor">مستقبلي المتبرعين</option>
                                    <option value="distress">مستقبلي الاستغاثات</option>
                                </select>
                            )}
                            {activeTab === 'general' && (
                                <>
                                    <select className="p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={newContact.role} onChange={e => setNewContact({...newContact, role: e.target.value})}>
                                        <option value="">بدون دور محدد</option>
                                        {TELEGRAM_ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                    
                                    {selectedDept === 'hr' && (
                                        <select 
                                            className="p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white col-span-2"
                                            value={newContact.responsibleForDept}
                                            onChange={e => setNewContact({...newContact, responsibleForDept: e.target.value})}
                                        >
                                            <option value="">-- مسؤول عن قسم --</option>
                                            <option value="general">الموارد البشرية (عام)</option>
                                            {departments.filter((d: any) => d.id !== 'hr').map((d: any) => (
                                                <option key={d.id} value={d.id}>{d.nameAr}</option>
                                            ))}
                                        </select>
                                    )}
                                </>
                            )}
                        </div>
                        <button onClick={handleAddContact} className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Plus size={18}/> إضافة للقائمة</button>
                    </div>

                    {/* Contacts List */}
                    <div className="space-y-4">
                        {activeTab === 'general' && localConfig.generalContacts.map((dept: any) => (
                            <div key={dept.departmentId} className="space-y-2">
                                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{dept.departmentId === 'general' ? 'الإدارة العامة' : departments.find((d: any) => d.id === dept.departmentId)?.nameAr || dept.departmentId}</h5>
                                {dept.contacts.map((c: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <div>
                                            <p className="text-sm font-bold dark:text-white">
                                                {c.name} 
                                                {c.responsibleForDept && <span className="text-xs text-indigo-500 mr-2">(مسؤول {departments.find((d: any) => d.id === c.responsibleForDept)?.nameAr || c.responsibleForDept})</span>}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-mono">{c.chatId} {c.role && `• ${TELEGRAM_ROLES.find(r => r.id === c.role)?.name || c.role}`}</p>
                                        </div>
                                        <button onClick={() => handleDeleteContact('general', dept.departmentId, idx)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        ))}

                        {activeTab === 'volunteer' && localConfig.volunteerContacts.map((dept: any) => (
                            <div key={dept.departmentId} className="space-y-2">
                                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{dept.departmentId === 'general' ? 'الإدارة العامة' : departments.find((d: any) => d.id === dept.departmentId)?.nameAr || dept.departmentId}</h5>
                                {dept.contacts.map((c: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <div>
                                            <p className="text-sm font-bold dark:text-white">{c.name}</p>
                                            <p className="text-[10px] text-gray-400 font-mono">{c.chatId}</p>
                                        </div>
                                        <button onClick={() => handleDeleteContact('volunteer', dept.departmentId, idx)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        ))}

                        {activeTab === 'waman' && localConfig.wamanAhyaahaContacts.map((group: any) => (
                            <div key={group.type} className="space-y-2">
                                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{group.type === 'donor' ? 'مستقبلي المتبرعين' : 'مستقبلي الاستغاثات'}</h5>
                                {group.contacts.map((c: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <div>
                                            <p className="text-sm font-bold dark:text-white">{c.name}</p>
                                            <p className="text-[10px] text-gray-400 font-mono">{c.chatId}</p>
                                        </div>
                                        <button onClick={() => handleDeleteContact('waman', group.type, idx)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                        </>
                </div>

                <div className="flex justify-end gap-4 p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition">إلغاء</button>
                    <button onClick={() => onSave(localConfig)} className="px-8 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-500/10 transition transform hover:scale-[1.02]">
                        <Save size={16}/> حفظ جميع التغييرات
                    </button>
                </div>
            </div>
        </div>
    );
};

export const ProfileSetupModal = ({ 
    show, profileSetup, setProfileSetup, saveUserProfile 
}: any) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2rem] p-8 shadow-2xl animate-fade-in-up relative overflow-hidden">
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserIcon size={36} />
                    </div>
                    <h3 className="font-bold text-xl text-gray-800 dark:text-white">مرحباً بك في معوان!</h3>
                    <p className="text-gray-500 text-sm mt-2">نحتاج لبعض المعلومات لإكمال ملفك الشخصي.</p>
                </div>
                <form onSubmit={saveUserProfile} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">الاسم الكامل (ثنائي)</label>
                        <input 
                            required 
                            className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-bold text-gray-800 dark:text-white" 
                            placeholder="أحمد محمد" 
                            value={profileSetup.name} 
                            onChange={(e: any) => setProfileSetup({...profileSetup, name: e.target.value})} 
                            autoFocus 
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">القسم</label>
                        <select 
                            required
                            className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-bold text-gray-800 dark:text-white appearance-none"
                            value={profileSetup.departmentId}
                            onChange={(e) => setProfileSetup({...profileSetup, departmentId: e.target.value})}
                        >
                            <option value="">-- اختر القسم --</option>
                            {DEPARTMENTS.map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.nameAr || dept.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">اللقب</label>
                        <select 
                            required
                            className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-bold text-gray-800 dark:text-white appearance-none"
                            value={profileSetup.role}
                            onChange={(e) => setProfileSetup({...profileSetup, role: e.target.value})}
                        >
                            <option value="">-- اختر اللقب --</option>
                            {profileSetup.departmentId === 'charity' ? (
                                CHARITY_ROLES.map(role => <option key={role.id} value={role.id}>{role.name}</option>)
                            ) : (
                                USER_ROLES.map(role => <option key={role.id} value={role.id}>{role.name}</option>)
                            )}
                        </select>
                    </div>

                    <button className="w-full mt-4 bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-lg transition transform hover:scale-[1.02]">حفظ ومتابعة</button>
                </form>
            </div>
        </div>
    );
};
