import React, { useState, useEffect } from "react";
import { auth, db } from "../services/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Users, Save, Trash2 } from "lucide-react";
import { DEPARTMENTS, USER_ROLES, CHARITY_ROLES } from "../utils/constants";

const PERMISSIONS = [
    { key: "canManageUsers", color: "accent-indigo-600" },
    { key: "canViewAdminTable", color: "accent-green-600" },
    { key: "canManageOrg", color: "accent-purple-600" },
    { key: "canEditIdentity", color: "accent-pink-600" },
    { key: "canManageVolunteers", color: "accent-orange-600" },
    { key: "canManageTelegram", color: "accent-blue-600" },
    { key: "canPostAnnouncements", color: "accent-red-600" },
    { key: "canViewReports", color: "accent-cyan-600" },
    { key: "canManagePoints", color: "accent-amber-600" },
    { key: "canAccessWamanAhyaaha", color: "accent-red-600" },
    { key: "canAccessSeniorManagement", color: "accent-slate-900" },
    { key: "canViewHR", color: "accent-rose-600" }
];

const buildUserUpdatePayload = (user: any) => ({
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
    canManagePoints: !!user.canManagePoints,
    canAccessWamanAhyaaha: !!user.canAccessWamanAhyaaha,
    canAccessSeniorManagement: !!user.canAccessSeniorManagement,
    canViewHR: !!user.canViewHR
});

const getSaveErrorMessage = (error: any) => {
    if (auth.currentUser?.isAnonymous) {
        return "فشل الحفظ لأن جلسة المدير غير موثقة. سجّل الدخول ببريد المدير ثم حاول مرة أخرى.";
    }

    if (error?.code === "permission-denied") {
        return "فشل الحفظ: حسابك الحالي لا يملك صلاحية تعديل المستخدمين في Firebase.";
    }

    if (error?.code === "not-found") {
        return "فشل الحفظ: أحد حسابات المستخدمين غير موجود في قاعدة البيانات.";
    }

    return `فشل حفظ بعض التغييرات${error?.message ? `: ${error.message}` : ""}`;
};

export default function UserManagement() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirtyUserIds, setDirtyUserIds] = useState<Set<string>>(new Set());

    const fetchUsers = async () => {
        setLoading(true);
        const usersCol = collection(db, "users");
        const userSnapshot = await getDocs(usersCol);
        const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(userList);
        setDirtyUserIds(new Set());
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const patchUserLocal = (userId: string, data: any) => {
        setUsers(prev => prev.map(user => user.id === userId ? { ...user, ...data } : user));
        setDirtyUserIds(prev => new Set(prev).add(userId));
    };

    const saveAllChanges = async () => {
        const changedUsers = users.filter(user => dirtyUserIds.has(user.id));
        if (changedUsers.length === 0) return;

        setSaving(true);
        try {
            await Promise.all(changedUsers.map(user => updateDoc(doc(db, "users", user.id), buildUserUpdatePayload(user))));
            alert(`تم حفظ صلاحيات ${changedUsers.length} مستخدم بنجاح`);
            await fetchUsers();
        } catch (error) {
            console.error(error);
            alert(getSaveErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm("هل أنت متأكد من حذف هذا المستخدم نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")) return;
        try {
            await deleteDoc(doc(db, "users", userId));
            setUsers(prev => prev.filter(u => u.id !== userId));
            setDirtyUserIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء حذف المستخدم.");
        }
    };
    const SaveAllButton = () => (
        <button
            onClick={saveAllChanges}
            disabled={saving || dirtyUserIds.size === 0}
            className="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-xs font-black shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
            <Save size={16} />
            {saving ? "جاري الحفظ..." : `حفظ كل التغييرات (${dirtyUserIds.size})`}
        </button>
    );

    return (
        <div className="p-4 md:p-8 bg-white dark:bg-gray-900 min-h-screen">
            <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                    <h2 className="text-2xl md:text-3xl font-black flex items-center gap-3 text-gray-800 dark:text-white">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                            <Users size={28} />
                        </div>
                        إدارة صلاحيات المستخدمين
                    </h2>
                    <SaveAllButton />
                </div>

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
                                                    <th className="p-4 text-center font-black text-gray-500">النقاط</th>
                                                    <th className="p-4 text-center font-black text-gray-500">ومن أحياها</th>
                                                    <th className="p-4 text-center font-black text-gray-500">إدارة عليا</th>
                                                    <th className="p-4 font-black text-gray-500 text-center">الحالة / إجراءات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700 transition-colors">
                                                {deptUsers.map(user => (
                                                    <tr key={user.id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors group">
                                                        <td className="p-4 min-w-[150px]">
                                                            <div className="font-black text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                                                                {user.displayName || "عضو جديد"}
                                                                {user.id === auth.currentUser?.uid && (
                                                                    <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">(حسابي)</span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 font-medium truncate max-w-[140px]">{user.email}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col gap-2">
                                                                <select
                                                                    value={user.departmentId || ""}
                                                                    onChange={(e) => patchUserLocal(user.id, { departmentId: e.target.value })}
                                                                    className="p-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold outline-none ring-1 ring-transparent focus:ring-indigo-500 transition"
                                                                >
                                                                    <option value="">-- القسم --</option>
                                                                    {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.nameAr || d.name}</option>)}
                                                                </select>
                                                                <select
                                                                    value={user.role || "member"}
                                                                    onChange={(e) => patchUserLocal(user.id, { role: e.target.value })}
                                                                    className="p-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold outline-none ring-1 ring-transparent focus:ring-indigo-500 transition"
                                                                >
                                                                    {USER_ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                                    {CHARITY_ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                                </select>
                                                            </div>
                                                        </td>

                                                        {PERMISSIONS.map(perm => (
                                                            <td key={perm.key} className="p-4 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!user[perm.key]}
                                                                    onChange={(e) => patchUserLocal(user.id, { [perm.key]: e.target.checked })}
                                                                    className={`w-5 h-5 cursor-pointer rounded-lg shadow-sm transition transform active:scale-95 ${perm.color}`}
                                                                />
                                                            </td>
                                                        ))}

                                                        <td className="p-4">
                                                            <div className="flex items-center justify-center gap-3">
                                                                {dirtyUserIds.has(user.id) ? (
                                                                    <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-600">غير محفوظ</span>
                                                                ) : (
                                                                    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-600">محفوظ</span>
                                                                )}
                                                                {user.id !== auth.currentUser?.uid && (
                                                                    <button 
                                                                        onClick={() => handleDeleteUser(user.id)}
                                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                        title="حذف المستخدم"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="flex justify-end">
                            <SaveAllButton />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
