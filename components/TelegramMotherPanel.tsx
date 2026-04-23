
import React, { useState, useEffect } from "react";
import { 
    MessageCircle, Plus, Trash2, Bot, Users, Settings, 
    Bell, Check, X, Shield, Send, AlertTriangle, 
    Droplet, ChevronDown, UserCheck, RefreshCw, Smartphone
} from "lucide-react";
import { db } from "../services/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { DEPARTMENTS } from "../utils/constants";
import toast from "react-hot-toast";

interface BotEntry {
    id: string;
    name: string;
    token: string;
}

interface PersonEntry {
    id: string;
    name: string;
    chatId: string;
}

interface TelegramConfig {
    bots: BotEntry[];
    people: PersonEntry[];
    rules: {
        departments: Record<string, { managerId: string; deputyId?: string; deputyIds?: string[]; botId: string; forwardNotifyMode?: 'manager_only' | 'manager_and_deputy' }>;
        volunteers: Record<string, { recipientIds: string[]; botId: string }>;
        wamanAhyaaha: {
            distress: { recipientIds: string[]; botId: string };
            donors: { recipientIds: string[]; botId: string };
        };
    };
    defaultBotToken?: string;
}

export default function TelegramMotherPanel() {
    const [config, setConfig] = useState<TelegramConfig>({
        bots: [],
        people: [],
        rules: {
            departments: {},
            volunteers: {},
            wamanAhyaaha: {
                distress: { recipientIds: [], botId: "" },
                donors: { recipientIds: [], botId: "" }
            }
        }
    });

    const [activeTab, setActiveTab] = useState<'bots' | 'people' | 'rules'>('bots');
    const [activeRuleSubTab, setActiveRuleSubTab] = useState<'depts' | 'volunteers' | 'waman'>('depts');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form States
    const [newBot, setNewBot] = useState({ name: "", token: "" });
    const [newPerson, setNewPerson] = useState({ name: "", chatId: "" });

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "app_settings", "telegram_config"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as TelegramConfig;
                // Ensure structures exist
                const normalized = {
                    bots: data.bots || [],
                    people: data.people || [],
                    rules: {
                        departments: Object.fromEntries(
                            Object.entries(data.rules?.departments || {}).map(([deptId, rule]: [string, any]) => ([
                                deptId,
                                {
                                    managerId: rule?.managerId || "",
                                    deputyId: rule?.deputyId || "",
                                    deputyIds: Array.isArray(rule?.deputyIds)
                                        ? rule.deputyIds
                                        : (rule?.deputyId ? [rule.deputyId] : []),
                                    botId: rule?.botId || "",
                                    forwardNotifyMode: rule?.forwardNotifyMode || 'manager_and_deputy'
                                }
                            ]))
                        ),
                        volunteers: data.rules?.volunteers || {},
                        wamanAhyaaha: data.rules?.wamanAhyaaha || {
                            distress: { recipientIds: [], botId: "" },
                            donors: { recipientIds: [], botId: "" }
                        }
                    },
                    defaultBotToken: data.defaultBotToken || ""
                };
                setConfig(normalized);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const saveConfig = async (newConfig: TelegramConfig) => {
        setSaving(true);
        try {
            await setDoc(doc(db, "app_settings", "telegram_config"), newConfig);
            toast.success("تم حفظ الإعدادات بنجاح");
        } catch (e) {
            toast.error("فشل الحفظ");
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    // --- Migration Logic ---
    const handleMigrate = async () => {
        if (!confirm("سيتم نقل المعرفات الحالية إلى سجل الأشخاص الجديد. هل أنت متأكد؟")) return;
        
        try {
            const docSnap = await getDoc(doc(db, "app_settings", "telegram_config"));
            const bloodSnap = await getDoc(doc(db, "app_settings", "blood_config"));
            
            let currentPeople = [...config.people];
            const addUniquePerson = (name: string, chatId: string) => {
                if (!chatId) return null;
                const existing = currentPeople.find(p => p.chatId === chatId);
                if (existing) return existing.id;
                const id = "p_" + Math.random().toString(36).substr(2, 9);
                currentPeople.push({ id, name: name || "مستخدم مستورد", chatId });
                return id;
            };

            // 1. Migrate Main Config
            if (docSnap.exists()) {
                const data = docSnap.data();
                // General Contacts
                data.generalContacts?.forEach((dept: any) => {
                    dept.contacts?.forEach((c: any) => addUniquePerson(c.name, c.chatId));
                });
                // Volunteer Contacts
                data.volunteerContacts?.forEach((dept: any) => {
                    dept.contacts?.forEach((c: any) => addUniquePerson(c.name, c.chatId));
                });
            }

            // 2. Migrate Blood Config
            if (bloodSnap.exists()) {
                const data = bloodSnap.data();
                data.donorRecipients?.forEach((c: any) => addUniquePerson(c.name, c.chatId));
                data.distressRecipients?.forEach((c: any) => addUniquePerson(c.name, c.chatId));
            }

            const updatedConfig = { ...config, people: currentPeople };
            setConfig(updatedConfig);
            await saveConfig(updatedConfig);
            toast.success(`تم استيراد ${currentPeople.length - config.people.length} أشخاص جدد`);
        } catch (e) {
            toast.error("خطأ أثناء النقل");
            console.error(e);
        }
    };

    // --- Handlers ---
    const addBot = () => {
        if (!newBot.name || !newBot.token) return;
        const id = "bot_" + Date.now();
        const updated = { ...config, bots: [...config.bots, { ...newBot, id }] };
        setConfig(updated);
        saveConfig(updated);
        setNewBot({ name: "", token: "" });
    };

    const deleteBot = (id: string) => {
        const updated = { ...config, bots: config.bots.filter(b => b.id !== id) };
        setConfig(updated);
        saveConfig(updated);
    };

    const addPerson = () => {
        if (!newPerson.name || !newPerson.chatId) return;
        const id = "person_" + Date.now();
        const updated = { ...config, people: [...config.people, { ...newPerson, id }] };
        setConfig(updated);
        saveConfig(updated);
        setNewPerson({ name: "", chatId: "" });
    };

    const deletePerson = (id: string) => {
        const updated = { ...config, people: config.people.filter(p => p.id !== id) };
        setConfig(updated);
        saveConfig(updated);
    };

    const updateRule = (category: string, subKey: string, updates: any) => {
        const updated = { ...config };
        if (category === 'departments') {
            updated.rules.departments[subKey] = { ...updated.rules.departments[subKey], ...updates };
        } else if (category === 'volunteers') {
            updated.rules.volunteers[subKey] = { ...updated.rules.volunteers[subKey], ...updates };
        } else if (category === 'wamanAhyaaha') {
            (updated.rules.wamanAhyaaha as any)[subKey] = { ...(updated.rules.wamanAhyaaha as any)[subKey], ...updates };
        }
        setConfig(updated);
        saveConfig(updated);
    };

    const testBot = async (botToken: string) => {
        if (!config.people.length) {
            toast.error("أضف شخصاً واحداً على الأقل للاختبار");
            return;
        }
        const testPerson = config.people[0];
        toast.loading("جاري إرسال رسالة تجريبية...");
        try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: testPerson.chatId, text: "🔄 رسالة اختبار من " + config.bots.find(b => b.token === botToken)?.name })
            });
            if (res.ok) toast.success("وصلت الرسالة لـ " + testPerson.name);
            else throw new Error();
        } catch (e) {
            toast.error("فشل الاتصال بهذا البوت");
        } finally {
            toast.dismiss();
        }
    };

    if (loading) return <div className="p-12 text-center animate-pulse">جاري تحميل الإعدادات...</div>;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 animate-fade-in" dir="rtl">
            {/* Header / Tabs */}
            <div className="flex flex-col md:flex-row items-center justify-between p-6 border-b dark:border-gray-700 gap-4">
                <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl w-full md:w-auto">
                    <button 
                        onClick={() => setActiveTab('bots')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'bots' ? 'bg-white dark:bg-gray-700 text-sky-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <Bot size={18}/> المكتبة
                    </button>
                    <button 
                        onClick={() => setActiveTab('people')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'people' ? 'bg-white dark:bg-gray-700 text-sky-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <Users size={18}/> الأشخاص
                    </button>
                    <button 
                        onClick={() => setActiveTab('rules')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'rules' ? 'bg-white dark:bg-gray-700 text-sky-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <Settings size={18}/> قواعد الإرسال
                    </button>
                </div>

                <button 
                    onClick={handleMigrate}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-100 transition"
                >
                    <RefreshCw size={14} /> استيراد البيانات القديمة
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                
                {/* 1. BOTS LIBRARY */}
                {activeTab === 'bots' && (
                    <div className="space-y-6">
                        <div className="bg-sky-50 dark:bg-sky-900/10 p-4 rounded-2xl border border-sky-100 dark:border-sky-800">
                            <h4 className="font-bold text-sky-800 dark:text-sky-300 mb-3 flex items-center gap-2"><Plus size={16}/> إضافة بوت جديد</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input 
                                    className="p-3 bg-white dark:bg-gray-800 rounded-xl border-none outline-none shadow-sm text-sm" 
                                    placeholder="اسم البوت (مثلاً: البوت العام)"
                                    value={newBot.name}
                                    onChange={e => setNewBot({...newBot, name: e.target.value})}
                                />
                                <input 
                                    className="p-3 bg-white dark:bg-gray-800 rounded-xl border-none outline-none shadow-sm text-sm font-mono" 
                                    placeholder="Bot Token"
                                    value={newBot.token}
                                    onChange={e => setNewBot({...newBot, token: e.target.value})}
                                />
                                <button onClick={addBot} className="bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition">إضافة للمكتبة</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {config.bots.map(bot => (
                                <div key={bot.id} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-sky-100 dark:bg-sky-900/30 p-2 rounded-lg text-sky-600"><Bot size={20}/></div>
                                        <div>
                                            <p className="font-bold text-sm">{bot.name}</p>
                                            <p className="text-[10px] text-gray-400 font-mono truncate w-40">{bot.token}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => testBot(bot.token)} className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition" title="اختبار"><Send size={18}/></button>
                                        <button onClick={() => deleteBot(bot.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="حذف"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            ))}
                            {config.bots.length === 0 && <div className="md:col-span-2 text-center py-12 text-gray-400 font-bold">لم يتم إضافة بوتات بعد</div>}
                        </div>
                    </div>
                )}

                {/* 2. PEOPLE REGISTRY */}
                {activeTab === 'people' && (
                    <div className="space-y-6">
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                            <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-3 flex items-center gap-2"><Plus size={16}/> إضافة شخص للسجل</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input 
                                    className="p-3 bg-white dark:bg-gray-800 rounded-xl border-none outline-none shadow-sm text-sm" 
                                    placeholder="اسم الشخص"
                                    value={newPerson.name}
                                    onChange={e => setNewPerson({...newPerson, name: e.target.value})}
                                />
                                <input 
                                    className="p-3 bg-white dark:bg-gray-800 rounded-xl border-none outline-none shadow-sm text-sm" 
                                    placeholder="Telegram Chat ID"
                                    value={newPerson.chatId}
                                    onChange={e => setNewPerson({...newPerson, chatId: e.target.value})}
                                />
                                <button onClick={addPerson} className="bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition">حفظ في السجل</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {config.people.map(person => (
                                <div key={person.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="font-bold text-xs">{person.name}</p>
                                        <p className="text-[10px] text-gray-400">ID: {person.chatId}</p>
                                    </div>
                                    <button onClick={() => deletePerson(person.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"><Trash2 size={14}/></button>
                                </div>
                            ))}
                            {config.people.length === 0 && <div className="md:col-span-3 text-center py-12 text-gray-400 font-bold">السجل فارغ حالياً</div>}
                        </div>
                    </div>
                )}

                {/* 3. MAPPING RULES */}
                {activeTab === 'rules' && (
                    <div className="space-y-8">
                        {/* Sub Tabs for Rules */}
                        <div className="flex gap-2 border-b dark:border-gray-700 pb-2 overflow-x-auto no-scrollbar">
                            <button onClick={() => setActiveRuleSubTab('depts')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'depts' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>رؤساء الأقسام</button>
                            <button onClick={() => setActiveRuleSubTab('volunteers')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'volunteers' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>طلبات التطوع</button>
                            <button onClick={() => setActiveRuleSubTab('waman')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'waman' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>نظام ومن أحياها</button>
                        </div>

                        {/* A. DEPARTMENTS RULES */}
                        {activeRuleSubTab === 'depts' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {DEPARTMENTS.map(dept => {
                                    const rule = config.rules.departments[dept.id] || { managerId: "", deputyId: "", deputyIds: [], botId: "", forwardNotifyMode: "manager_and_deputy" };
                                    const selectedDeputyIds = Array.isArray(rule.deputyIds)
                                        ? rule.deputyIds
                                        : (rule.deputyId ? [rule.deputyId] : []);
                                    return (
                                        <div key={dept.id} className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`${dept.bgClass} ${dept.primaryColor} p-2 rounded-lg`}><dept.icon size={20}/></div>
                                                <h5 className="font-bold text-sm">{dept.nameAr}</h5>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">البوت المسؤول:</label>
                                                    <select 
                                                        className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-xs outline-none"
                                                        value={rule.botId}
                                                        onChange={e => updateRule('departments', dept.id, { botId: e.target.value })}
                                                    >
                                                        <option value="">اختر بوتاً...</option>
                                                        {config.bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">مستلمو إشعار التحويل:</label>
                                                    <select
                                                        className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-xs outline-none"
                                                        value={rule.forwardNotifyMode || 'manager_and_deputy'}
                                                        onChange={e => updateRule('departments', dept.id, { forwardNotifyMode: e.target.value })}
                                                    >
                                                        <option value="manager_only">الرئيس فقط</option>
                                                        <option value="manager_and_deputy">الرئيس والنائب</option>
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">الرئيس:</label>
                                                        <select 
                                                            className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-xs outline-none"
                                                            value={rule.managerId}
                                                            onChange={e => updateRule('departments', dept.id, { managerId: e.target.value })}
                                                        >
                                                            <option value="">لا يوجد</option>
                                                            {config.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">النواب (متعدد):</label>
                                                        <div className="flex flex-wrap gap-1.5 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                                            {config.people.map(person => {
                                                                const active = selectedDeputyIds.includes(person.id);
                                                                return (
                                                                    <button
                                                                        key={person.id}
                                                                        onClick={() => {
                                                                            const deputyIds = active
                                                                                ? selectedDeputyIds.filter((id: string) => id !== person.id)
                                                                                : [...selectedDeputyIds, person.id];
                                                                            updateRule('departments', dept.id, { deputyIds, deputyId: deputyIds[0] || "" });
                                                                        }}
                                                                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${active ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}
                                                                    >
                                                                        {person.name}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* B. VOLUNTEERS RULES */}
                        {activeRuleSubTab === 'volunteers' && (
                            <div className="space-y-4">
                                {DEPARTMENTS.filter(d => d.id !== 'hr').map(dept => {
                                    const rule = config.rules.volunteers[dept.id] || { recipientIds: [], botId: "" };
                                    return (
                                        <div key={dept.id} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <UserCheck className="text-orange-500" size={18}/>
                                                <p className="text-sm font-bold">طلبات {dept.nameAr}</p>
                                            </div>
                                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                                <select 
                                                    className="p-2 bg-white dark:bg-gray-800 rounded-lg text-[10px] outline-none border border-gray-100 dark:border-gray-700"
                                                    value={rule.botId}
                                                    onChange={e => updateRule('volunteers', dept.id, { botId: e.target.value })}
                                                >
                                                    <option value="">البوت...</option>
                                                    {config.bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                </select>
                                                {config.people.map(person => (
                                                    <button 
                                                        key={person.id}
                                                        onClick={() => {
                                                            const newIds = rule.recipientIds.includes(person.id)
                                                                ? rule.recipientIds.filter(id => id !== person.id)
                                                                : [...rule.recipientIds, person.id];
                                                            updateRule('volunteers', dept.id, { recipientIds: newIds });
                                                        }}
                                                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition whitespace-nowrap ${rule.recipientIds.includes(person.id) ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-500'}`}
                                                    >
                                                        {person.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* C. WAMAN AHYAAHA RULES */}
                        {activeRuleSubTab === 'waman' && (
                            <div className="space-y-6">
                                {/* Distress Rules */}
                                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-800 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="text-red-600" size={24}/>
                                            <h5 className="font-bold text-lg text-red-800 dark:text-red-300">بلاغات الاستغاثة العاجلة</h5>
                                        </div>
                                        <select 
                                            className="p-2 bg-white dark:bg-gray-800 rounded-lg text-xs outline-none"
                                            value={config.rules.wamanAhyaaha.distress.botId}
                                            onChange={e => updateRule('wamanAhyaaha', 'distress', { botId: e.target.value })}
                                        >
                                            <option value="">اختر البوت...</option>
                                            {config.bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <p className="text-xs text-red-600/70 mb-2 font-bold">المستلمون:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {config.people.map(person => (
                                            <button 
                                                key={person.id}
                                                onClick={() => {
                                                    const ids = config.rules.wamanAhyaaha.distress.recipientIds;
                                                    const newIds = ids.includes(person.id) ? ids.filter(i => i !== person.id) : [...ids, person.id];
                                                    updateRule('wamanAhyaaha', 'distress', { recipientIds: newIds });
                                                }}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${config.rules.wamanAhyaaha.distress.recipientIds.includes(person.id) ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-100'}`}
                                            >
                                                {person.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Donor Rules */}
                                <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-2xl border border-green-100 dark:border-green-800 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Droplet className="text-green-600" size={24}/>
                                            <h5 className="font-bold text-lg text-green-800 dark:text-green-300">المتبرعين الجدد</h5>
                                        </div>
                                        <select 
                                            className="p-2 bg-white dark:bg-gray-800 rounded-lg text-xs outline-none"
                                            value={config.rules.wamanAhyaaha.donors.botId}
                                            onChange={e => updateRule('wamanAhyaaha', 'donors', { botId: e.target.value })}
                                        >
                                            <option value="">اختر البوت...</option>
                                            {config.bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <p className="text-xs text-green-600/70 mb-2 font-bold">المستلمون:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {config.people.map(person => (
                                            <button 
                                                key={person.id}
                                                onClick={() => {
                                                    const ids = config.rules.wamanAhyaaha.donors.recipientIds;
                                                    const newIds = ids.includes(person.id) ? ids.filter(i => i !== person.id) : [...ids, person.id];
                                                    updateRule('wamanAhyaaha', 'donors', { recipientIds: newIds });
                                                }}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${config.rules.wamanAhyaaha.donors.recipientIds.includes(person.id) ? 'bg-green-600 text-white' : 'bg-white text-green-600 border border-green-100'}`}
                                            >
                                                {person.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Save Overlay */}
            {saving && (
                <div className="fixed inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 shadow-xl px-6 py-3 rounded-full flex items-center gap-3">
                        <RefreshCw className="animate-spin text-sky-600" size={20}/>
                        <span className="text-sm font-bold">جاري الحفظ...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
