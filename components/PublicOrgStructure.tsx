import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, query, onSnapshot } from "firebase/firestore";
import { Crown, Shield, Users as UsersGroup, Network, AlertTriangle } from "lucide-react";
import { DEPARTMENTS } from "../utils/constants";

export default function PublicOrgStructure() {
    const [structures, setStructures] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, "org_structure"));
        const unsub = onSnapshot(q, (snapshot) => {
            const data: Record<string, any> = {};
            snapshot.docs.forEach(doc => {
                data[doc.id] = doc.data();
            });
            setStructures(data);
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error("Org Structure Access Error:", err);
            let msg = "تعذر عرض البيانات.";
            if (err.code === 'permission-denied') msg = "عفواً، لا تملك صلاحية لعرض هذه البيانات.";
            setError(msg);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const StaffNode = ({ title, name, icon: Icon, colorClass, isMain = false }: any) => {
        if (!name) return null;
        return (
            <div className="flex flex-col items-center mt-3 md:mt-6 relative animate-fade-in-up">
                <div className="w-px h-4 md:h-6 bg-gray-300 dark:bg-gray-600"></div>
                <div className={`relative p-2 md:p-3 rounded-xl border ${isMain ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 shadow-sm' : 'bg-gray-50 dark:bg-gray-900 border-dashed border-gray-300 dark:border-gray-700'} flex items-center gap-3 w-[160px] md:min-w-[180px] md:max-w-[220px]`}>
                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center ${colorClass} text-white shadow-sm shrink-0`}>
                        <Icon size={12} className="md:hidden" />
                        <Icon size={14} className="hidden md:block" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase">{title}</p>
                        <p className="text-[10px] md:text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{name}</p>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>;
    
    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full mb-4 text-red-500"><AlertTriangle size={32} /></div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">خطأ في التحميل</h3>
            <p className="text-gray-500 max-w-md">{error}</p>
        </div>
    );

    const generalManagerInfo = structures['management'] || {};
    const generalManagers = Array.isArray(generalManagerInfo.managers) && generalManagerInfo.managers.length > 0
        ? generalManagerInfo.managers
        : (generalManagerInfo.manager ? [generalManagerInfo.manager] : ["د. محمود الهناوي"]);

    return (
        <div className="w-full h-full pb-20 pt-6 px-2 md:px-4 bg-[#F3F4F6] dark:bg-gray-900 bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')] bg-fixed overflow-y-auto custom-scrollbar">
            
            {/* Header */}
            <div className="text-center mb-10 relative z-10">
                <div className="inline-flex items-center justify-center p-3 md:p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-xl mb-3 text-white">
                    <Network size={24} className="md:hidden" />
                    <Network size={32} className="hidden md:block" />
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-white mb-1">الهيكل الإداري</h1>
                <p className="text-gray-500 text-xs md:text-sm">التسلسل الإداري والمرجعي لفريق معوان</p>
            </div>

            <div className="flex flex-col items-center">
                {/* Level 1: GM (Supports multiple if needed) */}
                <div className="flex flex-col items-center relative z-10 mb-8">
                    {generalManagers.map((gm: string, i: number) => (
                        <div key={i} className={`relative bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-xl border-2 border-yellow-400 text-center w-[220px] md:min-w-[280px] ${i > 0 ? 'mt-4' : ''}`}>
                            <div className="absolute -top-5 md:-top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white dark:border-gray-900">
                                <Crown size={18} className="md:hidden" />
                                <Crown size={24} className="hidden md:block" />
                            </div>
                            <h3 className="mt-3 md:mt-4 font-bold text-gray-800 dark:text-white text-base md:text-lg">{gm}</h3>
                            <p className="text-[10px] md:text-xs font-bold text-yellow-600 uppercase tracking-widest mt-1">المدير العام</p>
                        </div>
                    ))}
                </div>

                {/* Level 2: Departments - Desktop Row / Mobile Grid */}
                <div className="w-full overflow-x-auto md:overflow-visible pb-10 px-2 scrollbar-hide">
                    <div className="flex md:flex-row flex-col gap-8 md:gap-4 md:items-start items-center">
                        
                        {/* Desktop Connector Line */}
                        <div className="hidden md:block absolute left-10 right-10 top-[280px] h-px bg-gray-300 dark:bg-gray-600"></div>

                        {DEPARTMENTS.filter(d => d.id !== 'management').map((dept, idx, arr) => {
                            const info = structures[dept.id] || {};
                            const managers = Array.isArray(info.managers) && info.managers.length > 0 
                                ? info.managers 
                                : (info.manager ? [info.manager] : []);
                            
                            // Desktop-only connector logic handled via CSS generally, but we keep it simple here.
                            return (
                                <div key={dept.id} className="flex flex-col items-center relative w-full md:w-auto">
                                    {/* Mobile Vertical Connector */}
                                    <div className="md:hidden w-px h-8 bg-gray-300 dark:bg-gray-600 absolute -top-8"></div>
                                    
                                    {/* Desktop Top Connector */}
                                    <div className="hidden md:block absolute -top-8 w-px h-8 bg-gray-300 dark:bg-gray-600"></div>

                                    {/* Department Card */}
                                    <div className={`relative bg-white dark:bg-gray-800 rounded-3xl p-1 shadow-md hover:shadow-2xl transition-all duration-300 w-[220px] md:min-w-[240px] md:max-w-[240px] border-t-4 ${'border-' + dept.primaryColor.split('-')[1] + '-500'}`}>
                                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-[1.3rem] p-4 md:p-5 flex flex-col items-center text-center h-full">
                                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-white mb-3 shadow-md ${dept.bgClass.split(' ')[0]}`}>
                                                <dept.icon size={18} className="md:hidden"/>
                                                <dept.icon size={22} className="hidden md:block"/>
                                            </div>
                                            <h3 className="font-bold text-gray-800 dark:text-white text-sm md:text-base mb-1">{dept.name}</h3>
                                            
                                            {/* Manager(s) List */}
                                            <div className="mt-2 md:mt-3 w-full bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <p className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">رئيس القسم</p>
                                                {managers.length > 0 ? (
                                                    managers.map((m: string, i: number) => (
                                                        <p key={i} className="text-xs md:text-sm font-bold text-gray-800 dark:text-white truncate border-b last:border-0 border-gray-100 dark:border-gray-700 pb-1 last:pb-0 mb-1 last:mb-0">
                                                            {m}
                                                        </p>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-300 italic text-xs">-- شاغر --</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Staff Tree Downwards */}
                                    <div className="flex flex-col items-center w-full">
                                        <StaffNode title="النائب" name={info.deputy} icon={Shield} colorClass="bg-blue-500" isMain={true} />
                                        <StaffNode title="إشراف / أعضاء" name={info.supervisor} icon={UsersGroup} colorClass="bg-purple-500" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}