import React, { useState, useEffect } from "react";
import {
  UserCheck, Trophy, FileText, CheckSquare, Database,
  Plus, CalendarDays, ChevronDown, ChevronUp, Clock,
  BarChart2, TrendingUp, Minus as MinusIcon, CheckCircle2, XCircle, AlertCircle,
  Eye, AlertTriangle, Lightbulb, AlignLeft
} from "lucide-react";
import { db } from "../services/firebase";
import {
  collection, query, onSnapshot, updateDoc, doc, addDoc,
  setDoc, serverTimestamp, increment, orderBy, where, getDocs
} from "firebase/firestore";
import { DEPARTMENTS } from "../utils/constants";
import TaskBoard from "./TaskBoard";
import AdminTable from "./AdminTable";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type AttendanceStatus = "present" | "absent_excused" | "absent";

interface Meeting {
  id: string;
  title: string;
  date: string;      // en-CA format yyyy-mm-dd
  time: string;
  departmentId: string;
  createdBy: string;
  createdAt: string;
}

interface AttendanceRecord {
  id: string;
  meetingId: string;
  userId: string;
  userName: string;
  departmentId: string;
  status: AttendanceStatus;
  note?: string;
  updatedAt: any;
}

// DeptReport = what each department writes in DepartmentReports.tsx
interface DeptReport {
  id: string;
  deptId: string;          // matches DEPARTMENTS[n].id
  doneText: string;        // ما تم إنجازه
  futureText: string;      // الخطة القادمة
  problemsText: string;    // المشاكل والتحديات
  suggestionsText: string; // الطلبات
  managerName: string;
  roleLabel: string;
  dateString: string;
  createdAt: number;       // ms timestamp
}

interface PointsLog {
  id: string;
  userId: string;
  userName: string;
  points: number;
  reason: string;
  createdBy: string;
  createdAt: any;
}

// ─────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────
interface HRPanelProps {
  user: any;
  userProfile: any;
  telegramConfig?: any;
  onSendTelegram?: any;
  tasks?: any[];
  newTask?: any;
  setNewTask?: any;
  handleAddTask?: any;
  toggleStatus?: any;
  deleteTask?: any;
  setSelectedTask?: any;
  onOpenAddTask?: any;
  updateTaskStatus?: any;
  handleAcceptTask?: any;
  handleRejectTask?: any;
  initiateForward?: any;
  onForwardToArt?: any;
  updateTaskCategory?: any;
  updateTaskInternalCategory?: any;
  renameCategory?: any;
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  present:        { label: "حضور",           color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400", icon: <CheckCircle2 size={14} /> },
  absent_excused: { label: "غياب بعذر",     color: "bg-amber-50   text-amber-700   border-amber-200   dark:bg-amber-950/30   dark:text-amber-400",   icon: <AlertCircle  size={14} /> },
  absent:         { label: "غياب بدون عذر", color: "bg-rose-50    text-rose-700    border-rose-200    dark:bg-rose-950/30    dark:text-rose-400",    icon: <XCircle      size={14} /> },
};

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────
export default function HRPanel({
  user, userProfile, telegramConfig, onSendTelegram,
  tasks, newTask, setNewTask, handleAddTask, toggleStatus, deleteTask, setSelectedTask, onOpenAddTask,
  updateTaskStatus, handleAcceptTask, handleRejectTask, initiateForward, onForwardToArt,
  updateTaskCategory, updateTaskInternalCategory, renameCategory
}: HRPanelProps) {

  const [activeTab, setActiveTab] = useState<"tasks" | "data" | "attendance" | "points" | "reports">("tasks");
  const [loading, setLoading] = useState(true);

  // ── Users ──
  const [users, setUsers] = useState<any[]>([]);

  // ── Attendance ──
  const [meetings, setMeetings]             = useState<Meeting[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [showNewMeetingForm, setShowNewMeetingForm] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ title: "", date: "", time: "", departmentId: "all" });

  // ── Points ──
  const [pointsLogs, setPointsLogs]         = useState<PointsLog[]>([]);
  const [ptUserId, setPtUserId]             = useState("");
  const [ptAmount, setPtAmount]             = useState(10);
  const [ptReason, setPtReason]             = useState("");
  const [ptMode, setPtMode]                 = useState<"add" | "deduct">("add");

  // ── Reports (read-only from department_reports) ──
  const [deptReports, setDeptReports]       = useState<DeptReport[]>([]);
  const [reportDeptFilter, setReportDeptFilter] = useState("");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // ────────────────────────────────────────────────────────
  // Firestore listeners
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);

    const unsubs = [
      // users
      onSnapshot(query(collection(db, "users")), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }),

      // meetings
      onSnapshot(query(collection(db, "hr_meetings"), orderBy("date", "desc")), snap => {
        setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting)));
      }),

      // attendance records
      onSnapshot(query(collection(db, "hr_attendance")), snap => {
        setAttendanceRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
      }),

      // points logs
      onSnapshot(query(collection(db, "points_logs"), orderBy("createdAt", "desc")), snap => {
        setPointsLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as PointsLog)));
      }),

      // dept reports (written by each dept themselves)
      onSnapshot(
        query(collection(db, "department_reports"), orderBy("createdAt", "desc")),
        snap => {
          setDeptReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeptReport)));
        }
      ),
    ];

    return () => unsubs.forEach(u => u());
  }, []);

  // ────────────────────────────────────────────────────────
  // Attendance handlers
  // ────────────────────────────────────────────────────────
  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeeting.title || !newMeeting.date) return;
    const meetingDoc = await addDoc(collection(db, "hr_meetings"), {
      ...newMeeting,
      createdBy: userProfile?.displayName || user.email,
      createdAt: new Date().toISOString(),
    });
    setSelectedMeetingId(meetingDoc.id);
    setShowNewMeetingForm(false);
    setNewMeeting({ title: "", date: "", time: "", departmentId: "all" });
  };

  const getAttendanceStatus = (userId: string): AttendanceStatus | null => {
    if (!selectedMeetingId) return null;
    const rec = attendanceRecords.find(r => r.meetingId === selectedMeetingId && r.userId === userId);
    return rec?.status ?? null;
  };

  const handleSetAttendance = async (targetUser: any, status: AttendanceStatus) => {
    if (!selectedMeetingId) return;
    const docId = `${selectedMeetingId}_${targetUser.id}`;
    await setDoc(doc(db, "hr_attendance", docId), {
      meetingId: selectedMeetingId,
      userId: targetUser.id,
      userName: targetUser.displayName || targetUser.email || "مستخدم",
      departmentId: targetUser.departmentId || "general",
      status,
      updatedAt: serverTimestamp(),
    });
  };

  // ────────────────────────────────────────────────────────
  // Points handlers
  // ────────────────────────────────────────────────────────
  const handleAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ptUserId || !ptReason) return;
    const targetUser = users.find(u => u.id === ptUserId);
    const amount = ptMode === "deduct" ? -Math.abs(ptAmount) : Math.abs(ptAmount);

    await updateDoc(doc(db, "users", ptUserId), {
      pointsTotal: increment(amount),
      pointsUpdatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "points_logs"), {
      userId: ptUserId,
      userName: targetUser?.displayName || targetUser?.email || "عضو",
      points: amount,
      type: "hr_adjustment",
      reason: ptReason,
      createdBy: userProfile?.displayName || user.email,
      createdAt: serverTimestamp(),
    });

    await addDoc(collection(db, "notifications"), {
      type: "points_adjustment",
      userId: ptUserId,
      targetUserId: ptUserId,
      title: "تحديث رصيد النقاط",
      body: `${amount > 0 ? "+" : ""}${amount} نقطة من إدارة الموارد البشرية: ${ptReason}`,
      points: amount,
      isRead: false,
      createdAt: serverTimestamp(),
    });

    setPtReason("");
    setPtAmount(10);
  };


  // ────────────────────────────────────────────────────────
  // Derived data
  // ────────────────────────────────────────────────────────
  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);
  const meetingUsers = selectedMeeting
    ? (selectedMeeting.departmentId === "all"
        ? users
        : users.filter(u => u.departmentId === selectedMeeting.departmentId))
    : [];

  const filteredReports = deptReports.filter(r =>
    !reportDeptFilter || r.deptId === reportDeptFilter
  );

  // Group by deptId for the sidebar overview
  const deptSummary = DEPARTMENTS.map(dept => ({
    dept,
    count: deptReports.filter(r => r.deptId === dept.id).length,
  })).filter(d => d.count > 0);

  const attendanceSummary = selectedMeetingId ? {
    present:        attendanceRecords.filter(r => r.meetingId === selectedMeetingId && r.status === "present").length,
    absent_excused: attendanceRecords.filter(r => r.meetingId === selectedMeetingId && r.status === "absent_excused").length,
    absent:         attendanceRecords.filter(r => r.meetingId === selectedMeetingId && r.status === "absent").length,
  } : null;

  // ────────────────────────────────────────────────────────
  // Tabs config
  // ────────────────────────────────────────────────────────
  const tabs = [
    { id: "tasks",      label: "المهام",        icon: CheckSquare },
    { id: "data",       label: "الجدول",        icon: Database },
    { id: "attendance", label: "التحضير",       icon: UserCheck },
    { id: "points",     label: "النقاط",        icon: Trophy },
    { id: "reports",    label: "تقارير اللجان",  icon: FileText },
  ];

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-slate-50/50 dark:bg-slate-950/60" dir="rtl">

      {/* ── Header ── */}
      <header className="border-b border-slate-100 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 md:px-8 shrink-0">
        <div className="mb-4">
          <h1 className="text-xl font-black text-slate-800 dark:text-white">إدارة الموارد البشرية</h1>
          <p className="text-xs text-slate-400 font-bold mt-0.5">التحضير · النقاط · التطوع · تقارير اللجان</p>
        </div>

        {/* Tabs */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${
                  active
                    ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ════ TASKS ════ */}
            {activeTab === "tasks" && (
              <TaskBoard
                updateTaskStatus={updateTaskStatus}
                activeDeptId="hr"
                tasks={tasks?.filter(t => t.sourceDept === "hr" || t.targetDept === "hr") || []}
                newTask={newTask}
                setNewTask={setNewTask}
                handleAddTask={handleAddTask}
                toggleStatus={toggleStatus}
                deleteTask={deleteTask}
                initiateForward={initiateForward}
                onForwardToArt={onForwardToArt}
                setSelectedTask={setSelectedTask}
                updateTaskCategory={updateTaskCategory}
                updateTaskInternalCategory={updateTaskInternalCategory}
                renameCategory={renameCategory}
                user={user}
                userProfile={userProfile}
                handleAcceptTask={handleAcceptTask}
                handleRejectTask={handleRejectTask}
                onOpenAddTask={onOpenAddTask}
                currentUserDept={userProfile?.departmentId}
              />
            )}

            {/* ════ DATA TABLE ════ */}
            {activeTab === "data" && (
              <AdminTable
                user={user}
                mode="hr"
                telegramConfig={telegramConfig}
                onSendTelegram={onSendTelegram}
                userProfile={userProfile}
              />
            )}

            {/* ════ ATTENDANCE ════ */}
            {activeTab === "attendance" && (
              <div className="max-w-5xl mx-auto space-y-6">

                {/* Meeting selector bar */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-400 block mb-1">اختر اجتماعاً لتسجيل التحضير</label>
                      <select
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
                        value={selectedMeetingId}
                        onChange={e => setSelectedMeetingId(e.target.value)}
                      >
                        <option value="">— اختر اجتماعاً —</option>
                        {meetings.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.title} — {m.date} {m.time}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => setShowNewMeetingForm(v => !v)}
                      className="flex items-center gap-2 bg-indigo-600 text-white font-black text-xs px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition shrink-0"
                    >
                      <CalendarDays size={14} />
                      اجتماع جديد
                    </button>
                  </div>

                  {/* New meeting form */}
                  {showNewMeetingForm && (
                    <form onSubmit={handleCreateMeeting} className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-400 block mb-1">عنوان الاجتماع</label>
                        <input
                          required
                          type="text"
                          placeholder="مثال: اجتماع القيادة الشهري"
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                          value={newMeeting.title}
                          onChange={e => setNewMeeting(p => ({ ...p, title: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">التاريخ</label>
                        <input
                          required
                          type="date"
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                          value={newMeeting.date}
                          onChange={e => setNewMeeting(p => ({ ...p, date: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">الوقت</label>
                        <input
                          type="time"
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                          value={newMeeting.time}
                          onChange={e => setNewMeeting(p => ({ ...p, time: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">القسم / اللجنة</label>
                        <select
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                          value={newMeeting.departmentId}
                          onChange={e => setNewMeeting(p => ({ ...p, departmentId: e.target.value }))}
                        >
                          <option value="all">جميع الأقسام</option>
                          {DEPARTMENTS.map(d => (
                            <option key={d.id} value={d.id}>{d.nameAr}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 md:col-span-2">
                        <button type="submit" className="flex-1 bg-indigo-600 text-white font-black text-xs py-2.5 rounded-xl hover:bg-indigo-700 transition">
                          إنشاء الاجتماع
                        </button>
                        <button type="button" onClick={() => setShowNewMeetingForm(false)} className="px-4 text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
                          إلغاء
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Attendance sheet */}
                {selectedMeeting && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                    {/* Meeting info bar */}
                    <div className="bg-gradient-to-l from-indigo-600 to-purple-700 px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
                      <div>
                        <p className="text-white font-black">{selectedMeeting.title}</p>
                        <p className="text-indigo-100 text-xs font-bold flex items-center gap-2 mt-0.5">
                          <Clock size={12} /> {selectedMeeting.date} {selectedMeeting.time}
                        </p>
                      </div>
                      {attendanceSummary && (
                        <div className="flex gap-3">
                          {[
                            { label: "حضور",       value: attendanceSummary.present,        color: "bg-emerald-400/30 text-emerald-50" },
                            { label: "غياب بعذر", value: attendanceSummary.absent_excused, color: "bg-amber-400/30 text-amber-50" },
                            { label: "غياب",       value: attendanceSummary.absent,         color: "bg-rose-400/30 text-rose-50" },
                          ].map(s => (
                            <div key={s.label} className={`px-3 py-1.5 rounded-xl text-xs font-black ${s.color}`}>
                              {s.label}: {s.value}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* User rows */}
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                      {meetingUsers.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-10">لا يوجد أعضاء في هذا القسم</p>
                      ) : meetingUsers.map(u => {
                        const status = getAttendanceStatus(u.id);
                        return (
                          <div key={u.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-black text-slate-800 dark:text-white">{u.displayName || u.email}</p>
                              <p className="text-xs text-slate-400 font-bold">
                                {DEPARTMENTS.find(d => d.id === u.departmentId)?.nameAr || "عام"}
                              </p>
                            </div>
                            <div className="flex gap-1.5">
                              {(["present", "absent_excused", "absent"] as AttendanceStatus[]).map(s => {
                                const cfg = statusConfig[s];
                                const active = status === s;
                                return (
                                  <button
                                    key={s}
                                    onClick={() => handleSetAttendance(u, s)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition ${
                                      active ? cfg.color : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-slate-300"
                                    }`}
                                  >
                                    {cfg.icon}
                                    <span className="hidden sm:inline">{cfg.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!selectedMeetingId && (
                  <div className="text-center py-16 text-slate-400">
                    <CalendarDays size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-bold">اختر اجتماعاً أو أنشئ واحداً جديداً للبدء</p>
                  </div>
                )}
              </div>
            )}

            {/* ════ POINTS ════ */}
            {activeTab === "points" && (
              <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Form */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-md font-black text-slate-800 dark:text-white mb-5 flex items-center gap-2">
                    <Trophy size={18} className="text-amber-500" />
                    تعديل نقاط الأعضاء
                  </h3>

                  {/* Add / Deduct toggle */}
                  <div className="flex gap-2 mb-5">
                    {[
                      { id: "add",    label: "إضافة نقاط",  icon: <Plus size={13} />,       color: "bg-emerald-600 text-white" },
                      { id: "deduct", label: "خصم نقاط",    icon: <MinusIcon size={13} />,  color: "bg-rose-600 text-white" },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setPtMode(m.id as any)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition ${
                          ptMode === m.id ? m.color : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleAdjustPoints} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">اختر العضو</label>
                      <select
                        required
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                        value={ptUserId}
                        onChange={e => setPtUserId(e.target.value)}
                      >
                        <option value="">اختر...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.displayName || u.email} — {u.pointsTotal || 0} نقطة
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">عدد النقاط</label>
                      <input
                        required
                        type="number"
                        min={1}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center focus:ring-0"
                        value={ptAmount}
                        onChange={e => setPtAmount(Math.abs(Number(e.target.value)))}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">السبب</label>
                      <input
                        required
                        type="text"
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-0"
                        placeholder="مثال: تميز في تحضير اللقاء"
                        value={ptReason}
                        onChange={e => setPtReason(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      className={`w-full font-black text-xs py-3 rounded-xl text-white transition ${
                        ptMode === "add" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                      }`}
                    >
                      {ptMode === "add" ? "إضافة النقاط" : "خصم النقاط"}
                    </button>
                  </form>
                </div>

                {/* Points log */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-md font-black text-slate-800 dark:text-white mb-5 flex items-center gap-2">
                    <TrendingUp size={16} className="text-indigo-600" />
                    سجل تعديلات النقاط
                  </h3>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                    {pointsLogs.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-10">لا توجد سجلات نقاط بعد</p>
                    ) : pointsLogs.map(log => {
                      const isAdd = log.points > 0;
                      return (
                        <div key={log.id} className={`flex items-start justify-between gap-3 p-3.5 rounded-2xl border ${isAdd ? "border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/10" : "border-rose-100 bg-rose-50/30 dark:border-rose-900/30 dark:bg-rose-950/10"}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-800 dark:text-white truncate">{log.userName}</p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{log.reason}</p>
                            {log.createdBy && <p className="text-[10px] text-slate-400 mt-0.5">بواسطة: {log.createdBy}</p>}
                          </div>
                          <span className={`text-sm font-black shrink-0 ${isAdd ? "text-emerald-600" : "text-rose-600"}`}>
                            {isAdd ? "+" : ""}{log.points}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}


            {/* ════ REPORTS ════ */}
            {activeTab === "reports" && (
              <div className="max-w-5xl mx-auto space-y-5">

                {/* Header */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Eye size={16} className="text-indigo-600 shrink-0" />
                    <div>
                      <p className="text-sm font-black text-slate-800 dark:text-white">تقارير الأقسام واللجان</p>
                      <p className="text-[11px] text-slate-400 font-bold">هذه التقارير يكتبها كل قسم بنفسه · للاطلاع فقط</p>
                    </div>
                  </div>
                  <select
                    className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none shrink-0"
                    value={reportDeptFilter}
                    onChange={e => setReportDeptFilter(e.target.value)}
                  >
                    <option value="">جميع الأقسام</option>
                    {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.nameAr}</option>)}
                  </select>
                  <span className="text-[11px] text-slate-400 font-bold shrink-0">{filteredReports.length} تقرير</span>
                </div>

                {/* Dept pills */}
                {deptSummary.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {deptSummary.map(({ dept, count }) => (
                      <button
                        key={dept.id}
                        onClick={() => setReportDeptFilter(reportDeptFilter === dept.id ? "" : dept.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black border transition ${
                          reportDeptFilter === dept.id
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300"
                        }`}
                      >
                        <dept.icon size={11} />
                        {dept.nameAr}
                        <span className="opacity-70">({count})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Reports list */}
                {filteredReports.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">
                    <BarChart2 size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-bold">لا توجد تقارير بعد</p>
                    <p className="text-xs mt-1 font-bold opacity-60">سيظهر هنا ما يكتبه كل قسم من تقارير دورية</p>
                  </div>
                ) : filteredReports.map(report => {
                  const dept = DEPARTMENTS.find(d => d.id === report.deptId);
                  const isExpanded = expandedReportId === report.id;
                  const date = report.dateString || (report.createdAt ? new Date(report.createdAt).toLocaleDateString("ar-EG") : "—");
                  const renderField = (text: string) =>
                    !text || text === "لا يوجد"
                      ? <span className="text-slate-400 italic text-xs">لا يوجد</span>
                      : <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{text}</p>;
                  return (
                    <div key={report.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                      <button
                        onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                        className="w-full px-5 py-4 flex items-center justify-between gap-3 text-right hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                            {dept ? <dept.icon size={16} className="text-white" /> : <FileText size={16} className="text-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-800 dark:text-white truncate">
                              {dept?.nameAr || report.deptId}
                            </p>
                            <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5 flex-wrap">
                              <Clock size={10} /> {date}
                              {report.managerName && <> · <span className="text-slate-500">{report.managerName}</span></>}
                              {report.roleLabel && (
                                <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                  {report.roleLabel}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {isExpanded
                          ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
                          : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800 p-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/10 dark:to-slate-900 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4">
                              <h4 className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                                <CheckCircle2 size={12} /> ما تم إنجازه
                              </h4>
                              {renderField(report.doneText)}
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-slate-900 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4">
                              <h4 className="text-[11px] font-black text-blue-700 dark:text-blue-400 flex items-center gap-1.5 mb-2">
                                <AlignLeft size={12} /> الخطة القادمة
                              </h4>
                              {renderField(report.futureText)}
                            </div>
                            <div className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/10 dark:to-slate-900 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-4">
                              <h4 className="text-[11px] font-black text-rose-700 dark:text-rose-400 flex items-center gap-1.5 mb-2">
                                <AlertTriangle size={12} /> المشاكل والتحديات
                              </h4>
                              {renderField(report.problemsText)}
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/10 dark:to-slate-900 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4">
                              <h4 className="text-[11px] font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                                <Lightbulb size={12} /> الطلبات
                              </h4>
                              {renderField(report.suggestionsText)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
