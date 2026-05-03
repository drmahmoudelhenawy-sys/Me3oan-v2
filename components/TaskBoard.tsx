import React, { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Inbox,
  ListFilter,
  Plus,
  Search,
  Send,
  Trash2,
  User,
} from "lucide-react";
import { DEPARTMENTS, PRIORITIES } from "../utils/constants";

type TaskScope = "mine" | "incoming" | "outgoing" | "completed";
type SortMode = "priority" | "deadline" | "newest";

const SPECIAL_VIEWS = new Set(["inbox", "today", "upcoming", "all"]);

const priorityOrder: Record<string, number> = {
  p1: 1,
  urgent: 1,
  p2: 2,
  high: 2,
  p3: 3,
  normal: 3,
  p4: 4,
  low: 4,
};

const getDept = (id?: string) => DEPARTMENTS.find((dept) => dept.id === id);

const isCompleted = (task: any) => task.status === "completed";

const getTaskDate = (task: any) => {
  const raw = task.created_at || task.createdAt || task.forwardedAt || task.completedAt || 0;
  if (typeof raw === "number") return raw;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const todayKey = () => new Date().toLocaleDateString("en-CA");

const getViewTitle = (activeDeptId: string, currentDeptId: string) => {
  if (activeDeptId === "inbox") return "الوارد";
  if (activeDeptId === "today") return "مهام اليوم";
  if (activeDeptId === "upcoming") return "المهام القادمة";
  if (activeDeptId === "all") return "كل المهام";
  return getDept(activeDeptId)?.nameAr || getDept(currentDeptId)?.nameAr || "المهام";
};

const getCurrentDeptId = (activeDeptId: string, userProfile: any, currentUserDept?: string) => {
  if (!SPECIAL_VIEWS.has(activeDeptId) && getDept(activeDeptId)) return activeDeptId;
  if (currentUserDept) return currentUserDept;
  if (userProfile?.departmentId) return userProfile.departmentId;
  return "general";
};

const classifyTask = (task: any, currentDeptId: string): TaskScope => {
  if (isCompleted(task)) return "completed";

  const sourceDept = task.sourceDept || task.originalSourceDept;
  const targetDept = task.targetDept;
  const isIncoming = targetDept === currentDeptId && sourceDept && sourceDept !== currentDeptId;
  const isOutgoing = sourceDept === currentDeptId && targetDept && targetDept !== currentDeptId;

  if (isIncoming) return "incoming";
  if (isOutgoing) return "outgoing";
  return "mine";
};

const filterBySpecialView = (tasks: any[], activeDeptId: string) => {
  const today = todayKey();
  if (activeDeptId === "today") {
    return tasks.filter((task) => task.deadline === today || task.executionDate === today);
  }
  if (activeDeptId === "upcoming") {
    return tasks.filter((task) => {
      const date = task.deadline || task.executionDate;
      return date && date > today && !isCompleted(task);
    });
  }
  return tasks;
};

const TaskStatusPill = ({ task }: { task: any }) => {
  if (task.status === "pending_acceptance") {
    return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">في انتظار القبول</span>;
  }
  if (task.status === "completed") {
    return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">مكتملة</span>;
  }
  return <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">قيد العمل</span>;
};

const TaskCard = ({
  task,
  currentDeptId,
  onOpen,
  onToggle,
  onDelete,
  onForward,
  handleAcceptTask,
  handleRejectTask,
}: any) => {
  const [showForwardMenu, setShowForwardMenu] = useState(false);
  const sourceDept = getDept(task.sourceDept || task.originalSourceDept);
  const targetDept = getDept(task.targetDept);
  const priority = PRIORITIES[task.priority] || PRIORITIES.normal || PRIORITIES.p4;
  const isPendingForMe = task.status === "pending_acceptance" && task.targetDept === currentDeptId;
  const canForward = typeof onForward === "function";

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-start justify-between gap-3">
        <button
          onClick={onToggle}
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
            isCompleted(task)
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-gray-300 text-gray-400 hover:border-emerald-500 hover:text-emerald-600"
          }`}
          title={isCompleted(task) ? "إعادة فتح المهمة" : "إنهاء المهمة"}
        >
          {isCompleted(task) ? <CheckCircle2 size={16} /> : <Circle size={15} />}
        </button>

        <div className="min-w-0 flex-1 text-right">
          <button onClick={onOpen} className="block w-full text-right">
            <h3 className={`line-clamp-2 text-base font-black leading-snug text-gray-900 dark:text-white ${isCompleted(task) ? "line-through opacity-60" : ""}`}>
              {task.title || "مهمة بدون عنوان"}
            </h3>
          </button>
          {task.details && (
            <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-gray-500 dark:text-gray-400">
              {typeof task.details === "string" ? task.details : JSON.stringify(task.details)}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap justify-end gap-2 text-xs">
        <TaskStatusPill task={task} />
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priority.color || "text-gray-600"} ${priority.bg || "bg-gray-100"}`}>
          {priority.labelAr || priority.label || "عادي"}
        </span>
        {task.deadline && (
          <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
            <Calendar size={12} />
            {task.deadline}
          </span>
        )}
        {task.performerName && (
          <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700">
            <User size={12} />
            {task.performerName}
          </span>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-2 text-[11px] font-bold text-gray-500 dark:bg-gray-900/50">
        <div className="text-right">
          <span className="block text-gray-400">من</span>
          <span className="text-gray-800 dark:text-gray-200">{sourceDept?.nameAr || "داخلي"}</span>
        </div>
        <div className="text-right">
          <span className="block text-gray-400">إلى</span>
          <span className="text-gray-800 dark:text-gray-200">{targetDept?.nameAr || sourceDept?.nameAr || "نفس اللجنة"}</span>
        </div>
      </div>

      {isPendingForMe ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAcceptTask?.(task)}
            className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
          >
            قبول المهمة
          </button>
          <button
            onClick={() => {
              const reason = prompt("سبب الرفض");
              if (reason) handleRejectTask?.(task, reason);
            }}
            className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-100"
          >
            رفض
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={onOpen} className="rounded-xl bg-gray-100 px-3 py-2.5 text-xs font-black text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100">
            فتح
          </button>
          <div className="relative">
            <button
              onClick={() => setShowForwardMenu((value) => !value)}
              disabled={!canForward}
              className="flex w-full items-center justify-center gap-1 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-black text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeftRight size={13} />
              تحويل
            </button>
            {showForwardMenu && (
              <div className="absolute bottom-full left-0 z-50 mb-2 max-h-64 w-56 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                {DEPARTMENTS.filter((dept) => dept.id !== task.sourceDept && dept.id !== task.targetDept).map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => {
                      onForward?.(dept.id);
                      setShowForwardMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-right text-xs font-bold text-gray-700 transition hover:bg-indigo-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <dept.icon size={14} className={dept.primaryColor} />
                    {dept.nameAr || dept.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={onDelete} className="flex items-center justify-center gap-1 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-100">
            <Trash2 size={13} />
            حذف
          </button>
        </div>
      )}
    </article>
  );
};

export default function TaskBoard({
  activeDeptId,
  tasks,
  toggleStatus,
  deleteTask,
  initiateForward,
  setSelectedTask,
  userProfile,
  currentUserDept,
  handleAcceptTask,
  handleRejectTask,
  onOpenAddTask = () => {},
}: any) {
  const [scope, setScope] = useState<TaskScope>(activeDeptId === "inbox" ? "incoming" : "mine");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("priority");

  const currentDeptId = getCurrentDeptId(activeDeptId, userProfile, currentUserDept);
  const title = getViewTitle(activeDeptId, currentDeptId);
  const activeDept = getDept(activeDeptId) || getDept(currentDeptId);

  const visibleTasks = useMemo(() => {
    const base = filterBySpecialView(tasks || [], activeDeptId);
    const query = searchQuery.trim().toLowerCase();

    return base
      .filter((task: any) => classifyTask(task, currentDeptId) === scope)
      .filter((task: any) => {
        if (!query) return true;
        return `${task.title || ""} ${task.details || ""} ${task.performerName || ""}`.toLowerCase().includes(query);
      })
      .sort((a: any, b: any) => {
        if (sortBy === "deadline") return (a.deadline || "9999-99-99").localeCompare(b.deadline || "9999-99-99");
        if (sortBy === "newest") return getTaskDate(b) - getTaskDate(a);
        return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
      });
  }, [activeDeptId, currentDeptId, scope, searchQuery, sortBy, tasks]);

  const counts = useMemo(() => {
    const base = filterBySpecialView(tasks || [], activeDeptId);
    return base.reduce(
      (acc: Record<TaskScope, number>, task: any) => {
        acc[classifyTask(task, currentDeptId)] += 1;
        return acc;
      },
      { mine: 0, incoming: 0, outgoing: 0, completed: 0 }
    );
  }, [activeDeptId, currentDeptId, tasks]);

  const tabs: Array<{ id: TaskScope; label: string; icon: React.ElementType }> = [
    { id: "mine", label: "مهام لجنتي", icon: ListFilter },
    { id: "incoming", label: "واردة", icon: Inbox },
    { id: "outgoing", label: "محولة", icon: Send },
    { id: "completed", label: "مكتملة", icon: CheckCircle2 },
  ];

  return (
    <section className="flex h-full flex-col bg-gray-50 dark:bg-gray-950" dir="rtl">
      <header className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-black text-gray-400">
              {activeDept && <activeDept.icon size={16} className={activeDept.primaryColor} />}
              <span>{getDept(currentDeptId)?.nameAr || "لجنة عامة"}</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{title}</h1>
          </div>

          <button
            onClick={() => onOpenAddTask?.()}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            <Plus size={18} />
            إضافة مهمة
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-2xl bg-gray-100 p-1 dark:bg-gray-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = scope === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setScope(tab.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition md:px-4 ${
                    active ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-900 dark:text-gray-300"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-indigo-50 text-indigo-700" : "bg-white/70 text-gray-500 dark:bg-gray-700"}`}>
                    {counts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="flex h-11 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 text-gray-400 dark:border-gray-700 dark:bg-gray-900">
            <Search size={16} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full bg-transparent text-sm font-bold text-gray-700 outline-none placeholder:text-gray-400 dark:text-white"
              placeholder="بحث في المهام"
            />
          </label>

          <label className="flex h-11 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <Clock size={15} />
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortMode)} className="bg-transparent outline-none">
              <option value="priority">الأولوية</option>
              <option value="deadline">الموعد</option>
              <option value="newest">الأحدث</option>
            </select>
          </label>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 dark:bg-gray-950 md:p-8">
        {visibleTasks.length === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100 text-gray-300 dark:bg-gray-800">
              <Inbox size={30} />
            </div>
            <h2 className="text-lg font-black text-gray-800 dark:text-white">لا توجد مهام هنا</h2>
            <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-gray-400">
              غيّر التبويب أو أضف مهمة جديدة للجنة. الواجهة الجديدة بتفصل بين مهام اللجنة والوارد والمحول عشان المتابعة تبقى أوضح.
            </p>
            <button
              onClick={() => onOpenAddTask?.()}
              className="mt-5 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-700"
            >
              إضافة مهمة
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {visibleTasks.map((task: any) => (
              <TaskCard
                key={task.id}
                task={task}
                currentDeptId={currentDeptId}
                onOpen={() => setSelectedTask?.(task)}
                onToggle={() => toggleStatus?.(task)}
                onDelete={() => deleteTask?.(task.id)}
                onForward={(targetDept: string) => initiateForward?.(task, targetDept)}
                handleAcceptTask={handleAcceptTask}
                handleRejectTask={handleRejectTask}
              />
            ))}
          </div>
        )}
      </main>
    </section>
  );
}
