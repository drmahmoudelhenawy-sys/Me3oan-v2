import React, { useState, useEffect } from "react";
import { 
  Users, Network, Palette, MessageCircle, Table as TableIcon, 
  UserPlus, ShieldCheck, Settings, X, ChevronRight, LayoutGrid, ClipboardList,
  Droplet, Eye, EyeOff, Plus, Edit2, Trash2, Save, Key, RefreshCw, Check, Copy
} from "lucide-react";
import UserManagement from "./UserManagement";
import OrgStructureSystem from "./OrgStructureSystem";
import IdentitySystem from "./IdentitySystem";
import AdminTable from "./AdminTable";
import JoinRequests from "./JoinRequests";
import TelegramMotherPanel from "./TelegramMotherPanel";
import { SUPER_ADMIN_EMAIL } from "../utils/constants";
import { db } from "../services/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ─── Blood Bank Users Panel ─────────────────────────────────────────────────
interface BloodUser { id: string; displayName: string; username: string; password: string; }

function BloodBankUsersPanel() {
    const [users, setUsers]     = useState<BloodUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [saved, setSaved]     = useState(false);
    const [editId, setEditId]   = useState<string | null>(null);
    const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});
    const [newUser, setNewUser] = useState({ displayName: '', username: '', password: '' });
    const [showAdd, setShowAdd] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'app_settings', 'blood_bank_users'));
                if (snap.exists()) setUsers(snap.data().users || []);
            } catch(e) { console.error(e); }
            setLoading(false);
        })();
    }, []);

    const save = async (updatedUsers: BloodUser[]) => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'app_settings', 'blood_bank_users'), { users: updatedUsers });
            setUsers(updatedUsers);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch(e) { alert('خطأ في الحفظ'); }
        setSaving(false);
    };

    const addUser = () => {
        if (!newUser.displayName || !newUser.username || !newUser.password) return alert('يرجى تعبئة كل الحقول');
        const u: BloodUser = { id: Date.now().toString(), ...newUser };
        save([...users, u]);
        setNewUser({ displayName: '', username: '', password: '' });
        setShowAdd(false);
    };

    const updateUser = (id: string, field: keyof BloodUser, val: string) => {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: val } : u));
    };

    const saveEdit = (id: string) => {
        save(users);
        setEditId(null);
    };

    const deleteUser = (id: string) => {
        if (!confirm('حذف هذا المستخدم؟')) return;
        save(users.filter(u => u.id !== id));
    };

    const genPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
        return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"/></div>;

    return (
        <div className="p-6 space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-black text-gray-800 dark:text-white text-lg flex items-center gap-2">
                        <Droplet size={20} className="text-red-500"/> حسابات مستخدمي بنك الدم
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">هذه الحسابات تُستخدم لتسجيل الدخول في صفحة إدارة ومن أحياها.</p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-700 text-white px-4 py-2.5 rounded-2xl text-sm font-bold shadow-md shadow-red-200 hover:opacity-90 transition">
                    <Plus size={15}/> إضافة مستخدم
                </button>
            </div>

            {/* Add Form */}
            {showAdd && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-2xl p-5 space-y-3">
                    <p className="text-xs font-black text-red-600 uppercase tracking-wider">بيانات المستخدم الجديد</p>
                    <div className="grid md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">الاسم الكامل (يظهر في الترحيب)</label>
                            <input value={newUser.displayName} onChange={e => setNewUser(p => ({...p, displayName: e.target.value}))}
                                className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 dark:text-white"
                                placeholder="مثال: د. أحمد محمد"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">اسم المستخدم (للدخول)</label>
                            <input value={newUser.username} onChange={e => setNewUser(p => ({...p, username: e.target.value}))}
                                className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 dark:text-white font-mono"
                                placeholder="مثال: ahmed.blood" dir="ltr"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">كلمة المرور</label>
                            <div className="flex gap-1">
                                <input value={newUser.password} onChange={e => setNewUser(p => ({...p, password: e.target.value}))}
                                    className="flex-1 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 dark:text-white font-mono"
                                    placeholder="كلمة المرور" dir="ltr"/>
                                <button onClick={() => setNewUser(p => ({...p, password: genPassword()}))}
                                    className="px-2 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 hover:text-red-500 transition" title="توليد تلقائي">
                                    <RefreshCw size={13}/>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button onClick={addUser}
                            className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 text-white font-bold rounded-xl text-sm shadow-md hover:opacity-90 transition">
                            حفظ المستخدم
                        </button>
                        <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold rounded-xl text-sm">إلغاء</button>
                    </div>
                </div>
            )}

            {/* Users Table */}
            {users.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Droplet size={32} className="mx-auto mb-2 opacity-30"/>
                    <p className="font-medium text-sm">لا يوجد مستخدمون بعد</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {users.map(u => (
                        <div key={u.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-4">
                            {/* Avatar */}
                            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0">
                                {u.displayName?.[0] || '?'}
                            </div>

                            {/* Fields */}
                            {editId === u.id ? (
                                <div className="flex-1 grid md:grid-cols-3 gap-2">
                                    <input value={u.displayName} onChange={e => updateUser(u.id, 'displayName', e.target.value)}
                                        className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 dark:text-white" placeholder="الاسم الكامل"/>
                                    <input value={u.username} onChange={e => updateUser(u.id, 'username', e.target.value)}
                                        className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 dark:text-white font-mono" placeholder="اسم المستخدم" dir="ltr"/>
                                    <div className="flex gap-1">
                                        <input value={u.password} onChange={e => updateUser(u.id, 'password', e.target.value)}
                                            className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 dark:text-white font-mono" placeholder="كلمة المرور" dir="ltr"/>
                                        <button onClick={() => updateUser(u.id, 'password', genPassword())}
                                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-400 hover:text-red-500 transition"><RefreshCw size={12}/></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 grid md:grid-cols-3 gap-2">
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">الاسم الكامل</p>
                                        <p className="text-sm font-bold text-gray-800 dark:text-white">{u.displayName}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">اسم المستخدم</p>
                                        <p className="text-sm font-mono text-gray-700 dark:text-gray-300" dir="ltr">{u.username}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">كلمة المرور</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-mono text-gray-700 dark:text-gray-300" dir="ltr">
                                                {showPwd[u.id] ? u.password : '••••••••'}
                                            </p>
                                            <button onClick={() => setShowPwd(p => ({...p, [u.id]: !p[u.id]}))} className="text-gray-300 hover:text-gray-500 transition">
                                                {showPwd[u.id] ? <EyeOff size={12}/> : <Eye size={12}/>}
                                            </button>
                                            <button onClick={() => { navigator.clipboard.writeText(u.password); }} className="text-gray-300 hover:text-blue-500 transition"><Copy size={12}/></button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                                {editId === u.id ? (
                                    <button onClick={() => saveEdit(u.id)} className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-100 transition">
                                        <Check size={14}/>
                                    </button>
                                ) : (
                                    <button onClick={() => setEditId(u.id)} className="w-8 h-8 bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-indigo-600 rounded-xl flex items-center justify-center transition">
                                        <Edit2 size={14}/>
                                    </button>
                                )}
                                <button onClick={() => deleteUser(u.id)} className="w-8 h-8 bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-red-500 rounded-xl flex items-center justify-center transition">
                                    <Trash2 size={14}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Save status */}
            {saving && <p className="text-center text-xs text-gray-400 animate-pulse">جاري الحفظ...</p>}
            {saved  && <p className="text-center text-xs text-emerald-500 font-bold flex items-center justify-center gap-1"><Check size={12}/> تم الحفظ بنجاح</p>}
        </div>
    );
}



interface ControlCenterProps {
  user: any;
  userProfile: any;
  onClose?: () => void;
  initialTab?: string;
}

type AdminTab = 'users' | 'org' | 'identity' | 'telegram' | 'admin_table' | 'volunteers' | 'blood_bank';

export default function ControlCenter({ user, userProfile, onClose, initialTab }: ControlCenterProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>((initialTab as AdminTab) || 'users');
  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase(); // Using the official constant

  const tabs = [
    { id: 'users', label: 'إدارة المستخدمين', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', desc: 'التحكم في أعضاء الفريق وصلاحياتهم', roles: ['full'] },
    { id: 'admin_table', label: 'جداول البيانات', icon: TableIcon, color: 'text-indigo-600', bg: 'bg-indigo-50', desc: 'إدارة جداول المهمات العامة والخاصة', roles: ['full', 'partial'] },
    { id: 'org', label: 'الهيكلة الإدارية', icon: Network, color: 'text-purple-600', bg: 'bg-purple-50', desc: 'عرض وتنظيم شجرة الهيكل الإداري', roles: ['full', 'partial'] },
    { id: 'identity', label: 'الهوية البصرية', icon: Palette, color: 'text-pink-600', bg: 'bg-pink-50', desc: 'تخصيص اللوجوهات والألوان والشعارات', roles: ['all'] },
    { id: 'volunteers', label: 'طلبات التطوع', icon: UserPlus, color: 'text-orange-600', bg: 'bg-orange-50', desc: 'مراجعة المتقدمين الجدد للانضمام', roles: ['all'] },
    { id: 'blood_bank', label: 'مستخدمو بنك الدم', icon: Droplet, color: 'text-red-600', bg: 'bg-red-50', desc: 'إدارة حسابات دخول نظام ومن أحياها', roles: ['full'] },
    { id: 'telegram', label: 'إعدادات البوت', icon: MessageCircle, color: 'text-sky-600', bg: 'bg-sky-50', desc: 'ضبط توكن البوت وقنوات التلجرام', roles: ['full'] },
  ];


  const visibleTabs = tabs.filter(tab => {
    if (isSuperAdmin) return true; // Super Admin sees everything
    if (userProfile?.controlAccess === 'full') return true;
    if (tab.roles.includes('all')) return true;
    if (userProfile?.controlAccess === 'partial' && tab.roles.includes('partial')) return true;
    return false;
  });

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeTab)) {
        setActiveTab(visibleTabs[0].id as AdminTab);
    }
  }, [visibleTabs, activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'users': return <UserManagement />;
      case 'admin_table': return <AdminTable user={user} mode="general" />;
      case 'org': return <OrgStructureSystem />;
      case 'identity': return <IdentitySystem user={user} userProfile={userProfile} />;
      case 'volunteers': return <JoinRequests user={user} userProfile={userProfile} />;
      case 'blood_bank': return <BloodBankUsersPanel />;
      case 'telegram': 
        return <TelegramMotherPanel />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900/50 animate-fade-in pb-20">
      {/* Header Area */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          <div>
            <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-3">
              <ShieldCheck className="text-indigo-600" size={32} />
              مركز التحكم والإدارة
            </h1>
            <p className="text-sm text-gray-500 mt-1">إدارة شاملة لكافة جوانب تطبيق معوان في مكان واحد</p>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-800'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {/* Tab Information Header */}
          <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`${visibleTabs.find(t => t.id === activeTab)?.bg} ${visibleTabs.find(t => t.id === activeTab)?.color} p-4 rounded-2xl shadow-sm`}>
                {React.createElement(visibleTabs.find(t => t.id === activeTab)?.icon || Settings, { size: 28 })}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">{visibleTabs.find(t => t.id === activeTab)?.label}</h2>
                <p className="text-sm text-gray-500">{visibleTabs.find(t => t.id === activeTab)?.desc}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[600px]">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
