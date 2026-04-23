import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { Users, Save } from "lucide-react";
import { DEPARTMENTS, USER_ROLES, CHARITY_ROLES } from "../utils/constants";

export default function UserManagement() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        setLoading(true);
        const usersCol = collection(db, "users");
        const userSnapshot = await getDocs(usersCol);
        const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(userList);
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const updateUser = async (userId: string, data: any) => {
        await updateDoc(doc(db, "users", userId), data);
        alert("تم تحديث البيانات بنجاح");
        fetchUsers();
    };

    return (
        <div className="p-4 md:p-8 bg-white dark:bg-gray-900 min-h-screen">
            <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100 dark:border-gray-700">
                <h2 className="text-2xl md:text-3xl font-black mb-8 flex items-center gap-3 text-gray-800 dark:text-white">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                        <Users size={28} />
                    </div>
                    إدارة صلاحيات المستخدمين
                </h2>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-bold text-gray-500 animate-pulse">جاري جلب بيانات الأعضاء...</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-gray-400 font-bold">لم يتم العثور على أي مستخدمين في النظام</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {/* Categorized Users */}
                        {[...DEPARTMENTS, { id: "unassigned", name: "أعضاء غير موزعين", nameAr: "أعضاء غير موزعين" }].map(dept => {
                            const deptUsers = dept.id === "unassigned" 
                                ? users.filter(u => !u.departmentId || !DEPARTMENTS.some(d => d.id === u.departmentId))
                                : users.filter(u => u.departmentId === dept.id);
                            
                            if (deptUsers.length === 0) return null;
                            
                            return (
                                <div key={dept.id} className="relative">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-8 w-1.5 bg-indigo-600 rounded-full"></div>
                                        <h3 className="text-xl font-black text-gray-800 dark:text-white">{dept.nameAr || dept.name}</h3>
                                        <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-3 py-1 rounded-full">{deptUsers.length}</span>
                                    </div>

                                    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <table className="w-full text-right text-xs md:text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                                    <th className="p-4 font-black text-gray-500">العضو</th>
                                                    <th className="p-4 font-black text-gray-500">القسم واللقب</th>
                                                    <th className="p-4 text-center font-black text-gray-500">المستخدمين</th>
                                                    <th className="p-4 text-center font-black text-gray-500">البيانات</th>
                                                    <th className="p-4 text-center font-black text-gray-500">الهيكلة</th>
                                                    <th className="p-4 text-center font-black text-gray-500">الهوية</th>
                                                    <th className="p-4 text-center font-black text-gray-500">متطوعين</th>
                                                    <th className="p-4 text-center font-black text-gray-500">البوت</th>
                                                    <th className="p-4 text-center font-black text-gray-500">إعلانات</th>
                                                    <th className="p-4 text-center font-black text-gray-500">تقارير</th>
                                                    <th className="p-4 text-center font-black text-gray-500">إدارة عليا</th>
                                                    <th className="p-4 font-black text-gray-500 text-center">الإجراءات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700 transition-colors">
                                                {deptUsers.map(user => (
                                                    <tr key={user.id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors group">
                                                        <td className="p-4 min-w-[150px]">
                                                            <div className="font-black text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                                {user.displayName || "عضو جديد"}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 font-medium truncate max-w-[140px]">{user.email}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col gap-2">
                                                                <select 
                                                                    value={user.departmentId || ""}
                                                                    onChange={(e) => setUsers(prev => prev.map(u => u.id === user.id ? {...u, departmentId: e.target.value} : u))}
                                                                    className="p-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold outline-none ring-1 ring-transparent focus:ring-indigo-500 transition"
                                                                >
                                                                    <option value="">-- القسم --</option>
                                                                    {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.nameAr || d.name}</option>)}
                                                                </select>
                                                                <select 
                                                                    value={user.role || "member"}
                                                                    onChange={(e) => setUsers(prev => prev.map(u => u.id === user.id ? {...u, role: e.target.value} : u))}
                                                                    className="p-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold outline-none ring-1 ring-transparent focus:ring-indigo-500 transition"
                                                                >
                                                                    {USER_ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                                    {CHARITY_ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                                </select>
                                                            </div>
                                                        </td>
                                                        
                                                        {/* Permissions Checkboxes - Premium Styled */}
                                                        {[
                                                            { key: 'canManageUsers', color: 'accent-indigo-600' },
                                                            { key: 'canViewAdminTable', color: 'accent-green-600' },
                                                            { key: 'canManageOrg', color: 'accent-purple-600' },
                                                            { key: 'canEditIdentity', color: 'accent-pink-600' },
                                                            { key: 'canManageVolunteers', color: 'accent-orange-600' },
                                                            { key: 'canManageTelegram', color: 'accent-blue-600' },
                                                            { key: 'canPostAnnouncements', color: 'accent-red-600' },
                                                            { key: 'canViewReports', color: 'accent-cyan-600' },
                                                            { key: 'canAccessSeniorManagement', color: 'accent-slate-900' }
                                                        ].map(perm => (
                                                            <td key={perm.key} className="p-4 text-center">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={!!user[perm.key]} 
                                                                    onChange={(e) => setUsers(prev => prev.map(u => u.id === user.id ? {...u, [perm.key]: e.target.checked} : u))} 
                                                                    className={`w-5 h-5 cursor-pointer rounded-lg shadow-sm transition transform active:scale-95 ${perm.color}`}
                                                                />
                                                            </td>
                                                        ))}

                                                        <td className="p-4">
                                                            <button 
                                                                onClick={() => updateUser(user.id, { 
                                                                    departmentId: user.departmentId || "", 
                                                                    role: user.role || "member", 
                                                                    canManageUsers: !!user.canManageUsers,
                                                                    canViewAdminTable: !!user.canViewAdminTable,
                                                                    canManageOrg: !!user.canManageOrg,
                                                                    canEditIdentity: !!user.canEditIdentity,
                                                                    canManageVolunteers: !!user.canManageVolunteers,
                                                                    canManageTelegram: !!user.canManageTelegram,
                                                                    canPostAnnouncements: !!user.canPostAnnouncements,
                                                                    canViewReports: !!user.canViewReports,
                                                                    canAccessSeniorManagement: !!user.canAccessSeniorManagement 
                                                                })}
                                                                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
                                                            >
                                                                <Save size={14} /> حفظ
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
