import React, { useEffect, useMemo, useState } from "react";
import { db } from "../services/firebase";
import { addDoc, collection, doc, increment, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { Award, Bell, Minus, Plus, Search, Star, Trophy, Users } from "lucide-react";
import toast from "react-hot-toast";

const TASK_POINTS = 10;

const getPoints = (user: any) => Number(user.pointsTotal || 0);

const getRankClass = (rank: number) => {
  if (rank === 1) return "bg-amber-50 text-amber-700 border-amber-200";
  if (rank === 2) return "bg-slate-50 text-slate-700 border-slate-200";
  if (rank === 3) return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-gray-50 text-gray-500 border-gray-200";
};

export default function PointsManagement({ currentUserProfile }: { currentUserProfile?: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const list = snap.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }));
        setUsers(list);
        setLoading(false);
      },
      (error) => {
        console.error("Points users listener error:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const rankedUsers = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    return [...users]
      .filter((user) => {
        if (!queryText) return true;
        return `${user.displayName || ""} ${user.email || ""} ${user.username || ""}`.toLowerCase().includes(queryText);
      })
      .sort((a, b) => getPoints(b) - getPoints(a));
  }, [search, users]);

  const totals = useMemo(() => {
    const totalPoints = users.reduce((sum, user) => sum + getPoints(user), 0);
    const topUser = [...users].sort((a, b) => getPoints(b) - getPoints(a))[0];
    return { totalPoints, topUser };
  }, [users]);

  const adjustPoints = async (direction: "bonus" | "penalty") => {
    const selectedUser = users.find((user) => user.id === selectedUserId);
    const normalizedAmount = Math.abs(Number(amount) || 0);
    if (!selectedUser || normalizedAmount <= 0) {
      toast.error("اختار الشخص واكتب عدد نقاط صحيح");
      return;
    }

    const delta = direction === "bonus" ? normalizedAmount : -normalizedAmount;
    const newTotal = Math.max(0, getPoints(selectedUser) + delta);
    const finalDelta = newTotal - getPoints(selectedUser);
    if (finalDelta === 0) {
      toast.error("لا يمكن خصم نقاط أكثر من رصيد الشخص");
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", selectedUser.id), {
        pointsTotal: newTotal,
        pointsManualTotal: increment(finalDelta),
        pointsUpdatedAt: serverTimestamp()
      });

      await addDoc(collection(db, "points_logs"), {
        userId: selectedUser.id,
        userName: selectedUser.displayName || selectedUser.email || "مستخدم",
        points: finalDelta,
        type: direction,
        reason: reason.trim() || (direction === "bonus" ? "مكافأة إضافية من الإدارة" : "خصم نقاط من الإدارة"),
        createdAt: serverTimestamp(),
        createdBy: currentUserProfile?.displayName || currentUserProfile?.email || "الإدارة"
      });

      await addDoc(collection(db, "notifications"), {
        type: "points_adjustment",
        userId: selectedUser.id,
        targetUserId: selectedUser.id,
        title: finalDelta > 0 ? "تمت إضافة نقاط لرصيدك" : "تم خصم نقاط من رصيدك",
        body: `${finalDelta > 0 ? "+" : ""}${finalDelta} نقطة${reason.trim() ? ` - ${reason.trim()}` : ""}`,
        points: finalDelta,
        isRead: false,
        createdAt: serverTimestamp()
      });

      toast.success(`تم ${finalDelta > 0 ? "إضافة" : "خصم"} ${Math.abs(finalDelta)} نقطة`);
      setReason("");
      setAmount(10);
    } catch (error) {
      console.error("Adjust points error:", error);
      toast.error("تعذر تعديل النقاط");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center bg-gray-50 dark:bg-gray-950" dir="rtl">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 md:p-8" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Trophy size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">نظام النقاط</h1>
              <p className="text-xs font-bold text-gray-400">كل مهمة مكتملة تمنح {TASK_POINTS} نقاط، مع إمكانية المكافأة أو الخصم اليدوي.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800">
              <p className="text-[10px] font-black text-gray-400">الأعضاء</p>
              <p className="text-lg font-black text-gray-900 dark:text-white">{users.length}</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-700">
              <p className="text-[10px] font-black">إجمالي النقاط</p>
              <p className="text-lg font-black">{totals.totalPoints}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 px-4 py-3 text-indigo-700">
              <p className="text-[10px] font-black">الأول</p>
              <p className="max-w-[120px] truncate text-sm font-black">{totals.topUser?.displayName || "-"}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
              <Award size={18} className="text-indigo-600" />
              تعديل رصيد شخص
            </h2>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-[11px] font-black text-gray-400">الشخص</span>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">اختار شخص</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName || user.email || "مستخدم"} ({getPoints(user)} نقطة)
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-black text-gray-400">عدد النقاط</span>
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-black text-gray-400">السبب</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثال: مكافأة مجهود إضافي أو خصم بسبب تأخير"
                  className="min-h-[96px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => adjustPoints("bonus")}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Plus size={15} />
                  إضافة
                </button>
                <button
                  onClick={() => adjustPoints("penalty")}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-black text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  <Minus size={15} />
                  خصم
                </button>
              </div>
            </div>
          </aside>

          <main className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-5 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
              <h2 className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
                <Users size={18} className="text-indigo-600" />
                ترتيب الأشخاص
              </h2>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بالاسم أو البريد"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-9 text-xs font-bold outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white md:w-72"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {rankedUsers.map((user, index) => {
                const rank = index + 1;
                const points = getPoints(user);
                return (
                  <div key={user.id} className="grid gap-3 p-4 md:grid-cols-[90px_1fr_auto] md:items-center">
                    <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${getRankClass(rank)}`}>
                      {rank <= 3 ? <Trophy size={14} /> : <Star size={14} />}
                      #{rank}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-900 dark:text-white">{user.displayName || user.username || "مستخدم بدون اسم"}</p>
                      <p className="truncate text-[11px] font-bold text-gray-400">{user.email || "لا يوجد بريد"}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <p className="text-xl font-black text-indigo-600">{points}</p>
                        <p className="text-[10px] font-black text-gray-400">نقطة</p>
                      </div>
                      {user.pointsUpdatedAt && <Bell size={15} className="text-gray-300" />}
                    </div>
                  </div>
                );
              })}

              {rankedUsers.length === 0 && (
                <div className="p-10 text-center text-sm font-bold text-gray-400">لا توجد نتائج مطابقة للبحث</div>
              )}
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
