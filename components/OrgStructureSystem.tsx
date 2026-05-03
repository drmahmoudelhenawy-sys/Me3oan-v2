
import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, doc, setDoc, onSnapshot, query } from "firebase/firestore";
import { Network, UserCog, CheckCircle, X, Crown, Shield, Users as UsersGroup, Edit2, AlertTriangle, UserPlus, MinusCircle, Hash, ChevronDown } from "lucide-react";
import { DEPARTMENTS } from "../utils/constants";

export default function OrgStructureSystem() {
    const [structures, setStructures]       = useState<Record<string, any>>({});
    const [editingDept, setEditingDept]     = useState<string | null>(null);
    const [formData, setFormData]           = useState<{ managers: string[]; deputy: string; deputyId: string; supervisor: string }>({ managers: [], deputy: "", deputyId: "", supervisor: "" });
    const [error, setError]                 = useState<string | null>(null);
    const [newManagerName, setNewManagerName] = useState("");
    const [saving, setSaving]               = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(query(collection(db, "org_structure")), (snap) => {
            const data: Record<string, any> = {};
            snap.docs.forEach(d => { data[d.id] = d.data(); });
            setStructures(data);
            setError(null);
        }, (err) => {
            console.error(err);
            setError("فشل تحميل البيانات.");
        });
        return () => unsub();
    }, []);

    const openEditModal = (deptId: string) => {
        const current = structures[deptId] || {};
        let managers: string[] = Array.isArray(current.managers) ? current.managers : (current.manager ? [current.manager] : []);
        setFormData({ managers, deputy: current.deputy || "", deputyId: current.deputyId || "", supervisor: current.supervisor || "" });
        setEditingDept(deptId);
        setNewManagerName("");
    };

    const handleAddManager = () => {
        if (!newManagerName.trim()) return;
        setFormData(p => ({ ...p, managers: [...p.managers, newManagerName.trim()] }));
        setNewManagerName("");
    };

    const handleSave = async () => {
        if (!editingDept) return;
        setSaving(true);
        try {
            await setDoc(doc(db, "org_structure", editingDept), { ...formData, updatedAt: new Date().toISOString() });
            setEditingDept(null);
        } catch { alert("حدث خطأ أثناء الحفظ"); }
        setSaving(false);
    };

    if (error) return (
        <div className="flex flex-col items-center justify-center h-40 text-center text-gray-500 p-6">
            <AlertTriangle size={32} className="text-red-400 mb-2"/>
            <p className="text-sm">{error}</p>
        </div>
    );

    // ── Dept Card ────────────────────────────────────────────────────────────
    const DeptCard = ({ dept }: any) => {
        const info = structures[dept.id] || {};
        const managers: string[] = Array.isArray(info.managers) && info.managers.length > 0
            ? info.managers : (info.manager ? [info.manager] : []);
        const colorBase = dept.primaryColor?.match(/-([\w]+)-/)?.[1] || 'indigo';

        return (
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                {/* top accent \u2014 use bgClass directly so simple colors like bg-orange-400 work */}
                <div className={`h-1 w-full ${dept.bgClass?.split(' ')[0] || 'bg-indigo-500'}`}/>

                <div className="p-4">
                    {/* Header row */}
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${dept.bgClass?.split(' ')[0] || 'bg-indigo-500'}`}>
                            <dept.icon size={16} className="text-white"/>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-gray-800 dark:text-white truncate leading-tight">{dept.nameAr || dept.name}</p>
                        </div>
                        <button
                            onClick={() => openEditModal(dept.id)}
                            className="w-7 h-7 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center justify-center transition opacity-0 group-hover:opacity-100 shrink-0"
                        >
                            <Edit2 size={13}/>
                        </button>
                    </div>

                    {/* Manager */}
                    <div className="space-y-1.5">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">رئيس القسم</p>
                        {managers.length > 0 ? (
                            managers.map((m, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <Crown size={9} className="text-amber-500 shrink-0"/>
                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">{m}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-300 dark:text-gray-600 italic">غير محدد</p>
                        )}

                        {/* Deputy */}
                        {info.deputy && (
                            <div className="flex items-center gap-1.5 mt-1">
                                <Shield size={9} className="text-blue-400 shrink-0"/>
                                <p className="text-[11px] text-blue-500 dark:text-blue-400 font-bold truncate">{info.deputy}</p>
                            </div>
                        )}

                        {/* Supervisor */}
                        {info.supervisor && (
                            <div className="flex items-center gap-1.5">
                                <UsersGroup size={9} className="text-purple-400 shrink-0"/>
                                <p className="text-[10px] text-purple-500 dark:text-purple-400 truncate">{info.supervisor}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Top management node
    const topManager = structures['management']?.managers?.[0] || structures['management']?.manager || "المدير العام";
    const topDeputy  = structures['management']?.deputy;
    const depts      = DEPARTMENTS.filter(d => d.id !== 'management');

    return (
        <div className="h-full flex flex-col animate-fade-in-up" dir="rtl">

            {/* ── Page Header ── */}
            <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl px-5 py-4 mb-5 text-white overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(250,204,21,0.12),transparent_60%)] pointer-events-none"/>
                <div className="flex items-center justify-between gap-4 relative z-10">
                    <div>
                        <h3 className="text-lg font-black flex items-center gap-2 text-yellow-400">
                            <Network size={20}/> الهيكل الإداري
                        </h3>
                        <p className="text-slate-400 text-xs mt-0.5">اضغط على أي بطاقة لتعديل رئيس القسم والنائب</p>
                    </div>
                    <UserCog size={28} className="text-yellow-500/60 shrink-0 hidden sm:block"/>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">

                {/* ── Top Management ── */}
                <div className="flex flex-col items-center mb-6">
                    <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border-2 border-amber-400/60 rounded-2xl px-6 py-3 text-center shadow-md max-w-xs w-full">
                        <p className="text-[9px] font-black text-amber-400 uppercase tracking-wider mb-0.5">الإدارة العليا</p>
                        <p className="text-base font-black text-gray-800 dark:text-white">{topManager}</p>
                        {topDeputy && (
                            <p className="text-xs text-blue-500 font-bold flex items-center justify-center gap-1 mt-1">
                                <Shield size={10}/> {topDeputy}
                            </p>
                        )}
                        <button
                            onClick={() => openEditModal('management')}
                            className="absolute -top-2.5 -left-2.5 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition"
                        >
                            <Edit2 size={12}/>
                        </button>
                    </div>
                    {/* connector line */}
                    <div className="w-px h-6 bg-amber-300/50 dark:bg-amber-700/50"/>
                    <ChevronDown size={16} className="text-amber-400/60 -mt-2"/>
                </div>

                {/* ── Departments Grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 px-1 pb-6">
                    {depts.map(dept => (
                        <DeptCard key={dept.id} dept={dept}/>
                    ))}
                </div>
            </div>

            {/* ── Edit Modal ── */}
            {editingDept && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={() => setEditingDept(null)}>
                    <div
                        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        {(() => {
                            const dept = DEPARTMENTS.find(d => d.id === editingDept);
                            return (
                                <div className={`relative bg-gradient-to-r from-indigo-600 to-violet-700 p-5 pb-6 overflow-hidden shrink-0`}>
                                    <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none"/>
                                    <div className="w-8 h-1 bg-white/30 rounded-full mx-auto mb-3 sm:hidden"/>
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-3">
                                            {dept && (
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${dept.bgClass?.split(' ')[0] || 'bg-indigo-500'}`}>
                                                    <dept.icon size={16} className="text-white"/>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-white/70 text-[10px] font-bold">تعديل الهيكل</p>
                                                <h3 className="text-white font-black text-base">
                                                    {editingDept === 'management' ? 'الإدارة العليا' : dept?.nameAr || dept?.name}
                                                </h3>
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingDept(null)} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition">
                                            <X size={15}/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Modal Body */}
                        <div className="min-h-0 overflow-y-auto bg-white dark:bg-gray-800 pt-5 px-5 pb-6 space-y-4 custom-scrollbar">
                            {/* Managers */}
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2">الرئيس / المدير</label>
                                <div className="flex gap-2 mb-2">
                                    <div className="relative flex-1">
                                        <Crown className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" size={14}/>
                                        <input
                                            className="w-full py-2.5 pr-9 pl-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm"
                                            value={newManagerName}
                                            onChange={e => setNewManagerName(e.target.value)}
                                            placeholder="أضف رئيساً..."
                                            onKeyDown={e => e.key === 'Enter' && handleAddManager()}
                                        />
                                    </div>
                                    <button onClick={handleAddManager} className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition">
                                        <UserPlus size={16}/>
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {formData.managers.map((m, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-100 dark:border-amber-800">
                                            {m}
                                            <button onClick={() => setFormData(p => ({ ...p, managers: p.managers.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600">
                                                <MinusCircle size={12}/>
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Deputy */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">النائب</label>
                                    <div className="relative">
                                        <Shield className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" size={13}/>
                                        <input
                                            className="w-full py-2.5 pr-8 pl-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm"
                                            value={formData.deputy}
                                            onChange={e => setFormData({ ...formData, deputy: e.target.value })}
                                            placeholder="الاسم"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">رقم تعريفي</label>
                                    <div className="relative">
                                        <Hash className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13}/>
                                        <input
                                            className="w-full py-2.5 pr-8 pl-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm font-mono"
                                            value={formData.deputyId}
                                            onChange={e => setFormData({ ...formData, deputyId: e.target.value })}
                                            placeholder="ID"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Supervisor */}
                            {editingDept !== 'management' && (
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">أعضاء بارزون / مشرفون</label>
                                    <div className="relative">
                                        <UsersGroup className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" size={13}/>
                                        <input
                                            className="w-full py-2.5 pr-8 pl-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm"
                                            value={formData.supervisor}
                                            onChange={e => setFormData({ ...formData, supervisor: e.target.value })}
                                            placeholder="أسماء الأعضاء..."
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> جاري الحفظ...</> : <><CheckCircle size={16}/> حفظ التغييرات</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
