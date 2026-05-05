
import React, { useState, useEffect, useMemo } from "react";
import { 
    MessageCircle, Plus, Trash2, Bot, Users, Settings, 
    Bell, Check, X, Shield, Send, AlertTriangle, 
    Droplet, ChevronDown, UserCheck, RefreshCw, Smartphone
} from "lucide-react";
import { db } from "../services/firebase";
import { collection, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
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
    source?: "manual" | "site";
}

interface SiteUserEntry {
    id: string;
    uid?: string;
    displayName?: string;
    email?: string;
    telegramId?: string;
    chatId?: string;
    telegramChatId?: string;
}

interface CustomRouteTarget {
    departmentId: string;
    recipientMode: "manager_only" | "manager_and_deputy" | "custom";
    recipientIds: string[];
}

interface CustomRouteEntry {
    id: string;
    name: string;
    botId: string;
    scope: "general" | "departments";
    recipientMode: "custom" | "manager_only" | "manager_and_deputy";
    recipientIds: string[];
    targets: CustomRouteTarget[];
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
        customRoutes?: CustomRouteEntry[];
    };
    defaultBotToken?: string;
}

const normalizeRecipientRule = (rule: any = {}) => ({
    recipientIds: Array.isArray(rule?.recipientIds) ? rule.recipientIds : [],
    botId: rule?.botId || ""
});

const normalizeCustomRoutes = (routes: any[] = []): CustomRouteEntry[] =>
    routes.map((route) => ({
        id: route?.id || `route_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: route?.name || "مسار إرسال مخصص",
        botId: route?.botId || "",
        scope: route?.scope === "departments" ? "departments" : "general",
        recipientMode: ["custom", "manager_only", "manager_and_deputy"].includes(route?.recipientMode) ? route.recipientMode : "custom",
        recipientIds: Array.isArray(route?.recipientIds) ? route.recipientIds : [],
        targets: Array.isArray(route?.targets)
            ? route.targets.map((target: any) => ({
                departmentId: target?.departmentId || "general",
                recipientMode: ["custom", "manager_only", "manager_and_deputy"].includes(target?.recipientMode) ? target.recipientMode : "manager_and_deputy",
                recipientIds: Array.isArray(target?.recipientIds) ? target.recipientIds : []
            }))
            : []
    }));

const getSiteUserChatId = (user: SiteUserEntry) =>
    String(user.telegramId || user.chatId || user.telegramChatId || "").trim();

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
            },
            customRoutes: []
        }
    });

    const [activeTab, setActiveTab] = useState<'bots' | 'people' | 'rules'>('bots');
    const [activeRuleSubTab, setActiveRuleSubTab] = useState<'depts' | 'volunteers' | 'waman' | 'custom'>('depts');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [siteUsers, setSiteUsers] = useState<SiteUserEntry[]>([]);
    const [testingPersonId, setTestingPersonId] = useState<string | null>(null);
    const [activeBotTestMenuId, setActiveBotTestMenuId] = useState<string | null>(null);

    // Form States
    const [newBot, setNewBot] = useState({ name: "", token: "" });
    const [newPerson, setNewPerson] = useState({ name: "", chatId: "" });
    const [newCustomRouteName, setNewCustomRouteName] = useState("");

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
                        volunteers: Object.fromEntries(
                            Object.entries(data.rules?.volunteers || {}).map(([deptId, rule]) => [
                                deptId,
                                normalizeRecipientRule(rule)
                            ])
                        ),
                        wamanAhyaaha: {
                            distress: normalizeRecipientRule(data.rules?.wamanAhyaaha?.distress),
                            donors: normalizeRecipientRule(data.rules?.wamanAhyaaha?.donors)
                        },
                        customRoutes: normalizeCustomRoutes(data.rules?.customRoutes || []),
                    },
                    defaultBotToken: data.defaultBotToken || ""
                };
                setConfig(normalized);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
            setSiteUsers(snapshot.docs.map((userDoc) => ({
                id: userDoc.id,
                ...(userDoc.data() as any)
            })));
        }, (error) => {
            console.warn("Unable to load site users for Telegram recipients", error);
        });
        return () => unsub();
    }, []);

    const availablePeople = useMemo<PersonEntry[]>(() => {
        const people: PersonEntry[] = [];
        const seenIds = new Set<string>();
        const seenChatIds = new Set<string>();

        (config.people || []).forEach((person) => {
            if (!person?.id) return;
            const chatId = String(person.chatId || "").trim();
            people.push({ ...person, chatId, source: person.source || "manual" });
            seenIds.add(person.id);
            if (chatId) seenChatIds.add(chatId);
        });

        siteUsers.forEach((siteUser) => {
            const uid = siteUser.uid || siteUser.id;
            const id = `site_${uid}`;
            const chatId = getSiteUserChatId(siteUser);
            if (!chatId) return;
            if (seenIds.has(id) || (chatId && seenChatIds.has(chatId))) return;

            people.push({
                id,
                name: siteUser.displayName || siteUser.email || "مستخدم بدون اسم",
                chatId,
                source: "site"
            });
            seenIds.add(id);
            if (chatId) seenChatIds.add(chatId);
        });

        return people.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    }, [config.people, siteUsers]);

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
        } else if (category === 'customRoutes') {
            updated.rules.customRoutes = (updated.rules.customRoutes || []).map((route) => (
                route.id === subKey ? { ...route, ...updates } : route
            ));
        }
        const selectedIds = new Set<string>();
        Object.values(updated.rules.departments || {}).forEach((rule: any) => {
            if (rule?.managerId) selectedIds.add(rule.managerId);
            (Array.isArray(rule?.deputyIds) ? rule.deputyIds : []).forEach((id: string) => selectedIds.add(id));
            if (rule?.deputyId) selectedIds.add(rule.deputyId);
        });
        Object.values(updated.rules.volunteers || {}).forEach((rule: any) => {
            (Array.isArray(rule?.recipientIds) ? rule.recipientIds : []).forEach((id: string) => selectedIds.add(id));
        });
        Object.values(updated.rules.wamanAhyaaha || {}).forEach((rule: any) => {
            (Array.isArray(rule?.recipientIds) ? rule.recipientIds : []).forEach((id: string) => selectedIds.add(id));
        });
        (updated.rules.customRoutes || []).forEach((route: any) => {
            (Array.isArray(route?.recipientIds) ? route.recipientIds : []).forEach((id: string) => selectedIds.add(id));
            (Array.isArray(route?.targets) ? route.targets : []).forEach((target: any) => {
                (Array.isArray(target?.recipientIds) ? target.recipientIds : []).forEach((id: string) => selectedIds.add(id));
            });
        });

        const peopleById = new Map((updated.people || []).map((person) => [person.id, person]));
        availablePeople.forEach((person) => {
            if (selectedIds.has(person.id) && person.chatId && !peopleById.has(person.id)) {
                peopleById.set(person.id, {
                    id: person.id,
                    name: person.name,
                    chatId: person.chatId,
                    source: person.source
                });
            }
        });
        updated.people = Array.from(peopleById.values());
        setConfig(updated);
        saveConfig(updated);
    };

    const addCustomRoute = () => {
        const name = newCustomRouteName.trim();
        if (!name) {
            toast.error("اكتب اسم المسار أولا");
            return;
        }

        const route: CustomRouteEntry = {
            id: `custom_${Date.now()}`,
            name,
            botId: "",
            scope: "general",
            recipientMode: "custom",
            recipientIds: [],
            targets: DEPARTMENTS.map((dept) => ({
                departmentId: dept.id,
                recipientMode: "manager_and_deputy",
                recipientIds: []
            }))
        };
        const updated = {
            ...config,
            rules: {
                ...config.rules,
                customRoutes: [...(config.rules.customRoutes || []), route]
            }
        };
        setConfig(updated);
        saveConfig(updated);
        setNewCustomRouteName("");
    };

    const deleteCustomRoute = (routeId: string) => {
        const updated = {
            ...config,
            rules: {
                ...config.rules,
                customRoutes: (config.rules.customRoutes || []).filter((route) => route.id !== routeId)
            }
        };
        setConfig(updated);
        saveConfig(updated);
    };

    const updateCustomRouteTarget = (routeId: string, departmentId: string, updates: Partial<CustomRouteTarget>) => {
        const route = (config.rules.customRoutes || []).find((item) => item.id === routeId);
        if (!route) return;
        const existingTargets = route.targets || [];
        const target = existingTargets.find((item) => item.departmentId === departmentId) || {
            departmentId,
            recipientMode: "manager_and_deputy",
            recipientIds: []
        };
        const nextTargets = [
            ...existingTargets.filter((item) => item.departmentId !== departmentId),
            { ...target, ...updates }
        ].sort((a, b) => DEPARTMENTS.findIndex((dept) => dept.id === a.departmentId) - DEPARTMENTS.findIndex((dept) => dept.id === b.departmentId));
        updateRule("customRoutes", routeId, { targets: nextTargets });
    };

    const applyBotToDepartmentRules = (botId: string) => {
        const departments = Object.fromEntries(
            DEPARTMENTS.map((dept) => [
                dept.id,
                {
                    managerId: config.rules.departments[dept.id]?.managerId || "",
                    deputyId: config.rules.departments[dept.id]?.deputyId || "",
                    deputyIds: Array.isArray(config.rules.departments[dept.id]?.deputyIds)
                        ? config.rules.departments[dept.id].deputyIds
                        : (config.rules.departments[dept.id]?.deputyId ? [config.rules.departments[dept.id].deputyId] : []),
                    forwardNotifyMode: config.rules.departments[dept.id]?.forwardNotifyMode || "manager_and_deputy",
                    botId
                }
            ])
        );
        const updated = { ...config, rules: { ...config.rules, departments } };
        setConfig(updated);
        saveConfig(updated);
    };

    const applyBotToVolunteerRules = (botId: string) => {
        const volunteers = Object.fromEntries(
            DEPARTMENTS.filter((dept) => dept.id !== "hr").map((dept) => [
                dept.id,
                {
                    recipientIds: config.rules.volunteers[dept.id]?.recipientIds || [],
                    botId
                }
            ])
        );
        const updated = { ...config, rules: { ...config.rules, volunteers } };
        setConfig(updated);
        saveConfig(updated);
    };

    const applyBotToWamanRules = (botId: string) => {
        const updated = {
            ...config,
            rules: {
                ...config.rules,
                wamanAhyaaha: {
                    distress: { ...config.rules.wamanAhyaaha.distress, botId },
                    donors: { ...config.rules.wamanAhyaaha.donors, botId }
                }
            }
        };
        setConfig(updated);
        saveConfig(updated);
    };

    const getTestBotToken = (botToken?: string) => botToken || config.defaultBotToken || config.bots[0]?.token || "";

    const parseTelegramError = async (res: Response) => {
        try {
            const data = await res.json();
            return data?.description || `HTTP ${res.status}`;
        } catch {
            return `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
        }
    };

    const testPerson = async (person: PersonEntry, botToken?: string) => {
        const tokenToUse = getTestBotToken(botToken);
        if (!tokenToUse) {
            toast.error("لا يوجد بوت للاختبار. أضف Bot Token الأول.");
            return;
        }
        if (!person.chatId) {
            toast.error(`لا يوجد Telegram Chat ID لـ ${person.name}`);
            return;
        }

        setTestingPersonId(person.id);
        const toastId = toast.loading(`جاري إرسال رسالة اختبار إلى ${person.name}...`);
        try {
            const botName = config.bots.find(b => b.token === tokenToUse)?.name || "البوت";
            const res = await fetch(`https://api.telegram.org/bot${tokenToUse}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: person.chatId,
                    text: `رسالة اختبار من ${botName}\n\nلو وصلت الرسالة دي يبقى إعدادات تيليجرام شغالة لهذا الشخص.`
                })
            });

            toast.dismiss(toastId);
            if (res.ok) {
                toast.success(`وصلت رسالة الاختبار إلى ${person.name}`);
            } else {
                toast.error(`فشل الإرسال إلى ${person.name}: ${await parseTelegramError(res)}`, { duration: 7000 });
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(`فشل الإرسال إلى ${person.name}: ${e?.message || "خطأ غير معروف"}`, { duration: 7000 });
        } finally {
            setTestingPersonId(null);
        }
    };

    const testBot = async (botToken: string) => {
        const botId = config.bots.find((bot) => bot.token === botToken)?.id || null;
        if (availablePeople.length) {
            setActiveBotTestMenuId(activeBotTestMenuId === botId ? null : botId);
            return;
        }
        if (!availablePeople.length) {
            toast.error("أضف شخصاً واحداً على الأقل للاختبار");
            return;
        }
        await testPerson(availablePeople[0], botToken);
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
                                <div key={bot.id} className="relative bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-sky-100 dark:bg-sky-900/30 p-2 rounded-lg text-sky-600"><Bot size={20}/></div>
                                        <div>
                                            <p className="font-bold text-sm">{bot.name}</p>
                                            <p className="text-[10px] text-gray-400 font-mono truncate w-40">{bot.token}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {activeBotTestMenuId === bot.id && (
                                            <div className="absolute left-4 top-14 z-30 w-64 max-h-72 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl p-2">
                                                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 border-b border-gray-100 dark:border-gray-700 mb-1">
                                                    اختر شخصا للاختبار
                                                </div>
                                                {availablePeople.map(person => (
                                                    <button
                                                        key={person.id}
                                                        onClick={async () => {
                                                            await testPerson(person, bot.token);
                                                            setActiveBotTestMenuId(null);
                                                        }}
                                                        disabled={testingPersonId === person.id}
                                                        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-right hover:bg-green-50 dark:hover:bg-green-900/20 transition disabled:opacity-50"
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="block text-xs font-bold text-gray-700 dark:text-gray-100 truncate">{person.name}</span>
                                                            <span className="block text-[10px] text-gray-400 font-mono truncate">{person.chatId}</span>
                                                        </span>
                                                        {testingPersonId === person.id ? <RefreshCw size={14} className="animate-spin text-green-600 shrink-0" /> : <Send size={14} className="text-green-600 shrink-0" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
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
                            {availablePeople.map(person => (
                                <div key={person.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-xl flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="font-bold text-xs">{person.name}</p>
                                        <p className="text-[10px] text-gray-400">ID: {person.chatId}</p>
                                        <p className="text-[10px] text-gray-300 mt-0.5">{person.source === "site" ? "مستخدم في الموقع" : "مدخل يدوي"}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => testPerson(person)}
                                            disabled={testingPersonId === person.id}
                                            className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition disabled:opacity-50"
                                            title="اختبار إرسال"
                                        >
                                            {testingPersonId === person.id ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14}/>}
                                        </button>
                                        {person.source !== "site" && (
                                            <button onClick={() => deletePerson(person.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition" title="حذف"><Trash2 size={14}/></button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {availablePeople.length === 0 && <div className="md:col-span-3 text-center py-12 text-gray-400 font-bold">لا يوجد أشخاص لديهم Telegram ID حالياً</div>}
                        </div>
                    </div>
                )}

                {/* 3. MAPPING RULES */}
                {activeTab === 'rules' && (
                    <div className="space-y-8">
                        {/* Sub Tabs for Rules */}
                        <div className="hidden">
                            <button onClick={() => setActiveRuleSubTab('custom')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'custom' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>مسارات مخصصة</button>
                            <button onClick={() => setActiveRuleSubTab('depts')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'depts' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>رؤساء الأقسام</button>
                            <button onClick={() => setActiveRuleSubTab('volunteers')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'volunteers' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>طلبات التطوع</button>
                            <button onClick={() => setActiveRuleSubTab('waman')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'waman' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>نظام ومن أحياها</button>
                        </div>

                        <div className="flex gap-2 border-b dark:border-gray-700 pb-2 overflow-x-auto no-scrollbar">
                            <button onClick={() => setActiveRuleSubTab('depts')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'depts' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>بوت التاسكات / العام</button>
                            <button onClick={() => setActiveRuleSubTab('volunteers')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'volunteers' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>بوت طلبات التطوع</button>
                            <button onClick={() => setActiveRuleSubTab('waman')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'waman' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>بوت ومن أحياها</button>
                            <button onClick={() => setActiveRuleSubTab('custom')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeRuleSubTab === 'custom' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>مسارات مخصصة</button>
                        </div>

                        {/* A. DEPARTMENTS RULES */}
                        {activeRuleSubTab === 'depts' && (
                            <div className="space-y-6">
                                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-4">
                                    <label className="text-[10px] font-bold text-indigo-500 block mb-2">البوت المستخدم لإشعارات التاسكات / العام:</label>
                                    <select
                                        className="w-full p-3 bg-white dark:bg-gray-800 rounded-xl text-sm outline-none border border-indigo-100 dark:border-indigo-800"
                                        value={DEPARTMENTS.map((dept) => config.rules.departments[dept.id]?.botId || "").find(Boolean) || ""}
                                        onChange={e => applyBotToDepartmentRules(e.target.value)}
                                    >
                                        <option value="">اختر البوت...</option>
                                        {config.bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
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
                                                        <option value="manager_and_deputy">الرئيس والنواب</option>
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
                                                            {availablePeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">النواب (متعدد):</label>
                                                        <div className="flex flex-wrap gap-1.5 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                                            {availablePeople.map(person => {
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
                            </div>
                        )}

                        {/* B. VOLUNTEERS RULES */}
                        {activeRuleSubTab === 'volunteers' && (
                            <div className="space-y-4">
                                <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-2xl p-4">
                                    <label className="text-[10px] font-bold text-orange-500 block mb-2">البوت المستخدم لإشعارات طلبات التطوع:</label>
                                    <select
                                        className="w-full p-3 bg-white dark:bg-gray-800 rounded-xl text-sm outline-none border border-orange-100 dark:border-orange-800"
                                        value={DEPARTMENTS.filter((dept) => dept.id !== "hr").map((dept) => config.rules.volunteers[dept.id]?.botId || "").find(Boolean) || ""}
                                        onChange={e => applyBotToVolunteerRules(e.target.value)}
                                    >
                                        <option value="">اختر البوت...</option>
                                        {config.bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800 rounded-xl px-4 py-3 text-xs font-bold">
                                    لو لم تختار مستلمين لطلبات التطوع، سيتم الإرسال تلقائيا لرئيس القسم ونوابه من تبويب رؤساء الأقسام.
                                </div>
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
                                                {availablePeople.map(person => {
                                                    return (
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
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* C. WAMAN AHYAAHA RULES */}
                        {activeRuleSubTab === 'waman' && (
                            <div className="space-y-6">
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-2xl p-4">
                                    <label className="text-[10px] font-bold text-red-500 block mb-2">البوت المستخدم لإشعارات ومن أحياها:</label>
                                    <select
                                        className="w-full p-3 bg-white dark:bg-gray-800 rounded-xl text-sm outline-none border border-red-100 dark:border-red-800"
                                        value={config.rules.wamanAhyaaha.distress.botId || config.rules.wamanAhyaaha.donors.botId || ""}
                                        onChange={e => applyBotToWamanRules(e.target.value)}
                                    >
                                        <option value="">اختر البوت...</option>
                                        {config.bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800 rounded-xl px-4 py-3 text-xs font-bold">
                                    لو لم تختار مستلمين هنا، سيتم الإرسال لرئيس ونواب قسم ومن أحياها من تبويب رؤساء الأقسام.
                                </div>
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
                                        {availablePeople.map(person => {
                                            return (
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
                                            );
                                        })}
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
                                        {availablePeople.map(person => {
                                            return (
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
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeRuleSubTab === 'custom' && (
                            <div className="space-y-6">
                                <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                    <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-3 flex items-center gap-2"><Plus size={16}/> إضافة مسار إرسال جديد</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                                        <input
                                            className="p-3 bg-white dark:bg-gray-800 rounded-xl border-none outline-none shadow-sm text-sm"
                                            placeholder="اسم المسار (مثلا: بوت الميزان، بوت الإعلام، بوت الطوارئ)"
                                            value={newCustomRouteName}
                                            onChange={e => setNewCustomRouteName(e.target.value)}
                                        />
                                        <button onClick={addCustomRoute} className="bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition px-6 py-3">إضافة مسار</button>
                                    </div>
                                </div>

                                {(config.rules.customRoutes || []).map((route) => (
                                    <div key={route.id} className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-5">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <div>
                                                <p className="font-bold text-sm">{route.name}</p>
                                                <p className="text-[10px] text-gray-400">اربط المسار ببوت من المكتبة وحدد هل الإرسال عام أو حسب كل قسم.</p>
                                            </div>
                                            <button onClick={() => deleteCustomRoute(route.id)} className="self-start md:self-auto p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="حذف"><Trash2 size={18}/></button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <input
                                                className="p-2 bg-white dark:bg-gray-800 rounded-lg text-xs outline-none border border-gray-100 dark:border-gray-700"
                                                value={route.name}
                                                onChange={e => updateRule('customRoutes', route.id, { name: e.target.value })}
                                            />
                                            <select
                                                className="p-2 bg-white dark:bg-gray-800 rounded-lg text-xs outline-none border border-gray-100 dark:border-gray-700"
                                                value={route.botId}
                                                onChange={e => updateRule('customRoutes', route.id, { botId: e.target.value })}
                                            >
                                                <option value="">اختر البوت...</option>
                                                {config.bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                            <select
                                                className="p-2 bg-white dark:bg-gray-800 rounded-lg text-xs outline-none border border-gray-100 dark:border-gray-700"
                                                value={route.scope}
                                                onChange={e => updateRule('customRoutes', route.id, { scope: e.target.value })}
                                            >
                                                <option value="general">عام</option>
                                                <option value="departments">حسب القسم</option>
                                            </select>
                                        </div>

                                        {route.scope === 'general' ? (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-gray-400 block">المستلمون العامون:</label>
                                                <div className="flex flex-wrap gap-2 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                                    {availablePeople.map(person => {
                                                        const active = route.recipientIds.includes(person.id);
                                                        return (
                                                            <button
                                                                key={person.id}
                                                                onClick={() => {
                                                                    const recipientIds = active
                                                                        ? route.recipientIds.filter((id) => id !== person.id)
                                                                        : [...route.recipientIds, person.id];
                                                                    updateRule('customRoutes', route.id, { recipientIds, recipientMode: 'custom' });
                                                                }}
                                                                className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition ${active ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}
                                                            >
                                                                {person.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {DEPARTMENTS.map((dept) => {
                                                    const target = route.targets.find((item) => item.departmentId === dept.id) || { departmentId: dept.id, recipientMode: 'manager_and_deputy', recipientIds: [] };
                                                    return (
                                                        <div key={dept.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`${dept.bgClass} ${dept.primaryColor} p-1.5 rounded-lg`}><dept.icon size={16}/></div>
                                                                <p className="text-xs font-bold">{dept.nameAr}</p>
                                                            </div>
                                                            <select
                                                                className="w-full p-2 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs outline-none border border-gray-100 dark:border-gray-700"
                                                                value={target.recipientMode}
                                                                onChange={e => updateCustomRouteTarget(route.id, dept.id, { recipientMode: e.target.value as any })}
                                                            >
                                                                <option value="manager_and_deputy">الرئيس والنواب</option>
                                                                <option value="manager_only">الرئيس فقط</option>
                                                                <option value="custom">مخصص</option>
                                                            </select>
                                                            {target.recipientMode === 'custom' && (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {availablePeople.map(person => {
                                                                        const active = target.recipientIds.includes(person.id);
                                                                        return (
                                                                            <button
                                                                                key={person.id}
                                                                                onClick={() => {
                                                                                    const recipientIds = active
                                                                                        ? target.recipientIds.filter((id) => id !== person.id)
                                                                                        : [...target.recipientIds, person.id];
                                                                                    updateCustomRouteTarget(route.id, dept.id, { recipientIds });
                                                                                }}
                                                                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${active ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}
                                                                            >
                                                                                {person.name}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {(config.rules.customRoutes || []).length === 0 && (
                                    <div className="text-center py-12 text-gray-400 font-bold">لا توجد مسارات مخصصة بعد</div>
                                )}
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
