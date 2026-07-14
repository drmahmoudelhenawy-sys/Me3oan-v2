import TaskDeliveryCenter from "./TaskDeliveryCenter";
import React, { useMemo, useState, useEffect } from "react";
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
  AlertTriangle,
  RefreshCw,
  X,
  Link as LinkIcon,
  Check
} from "lucide-react";
import { DEPARTMENTS, PRIORITIES } from "../utils/constants";

type TaskScope = "mine" | "incoming" | "outgoing" | "completed";
type SortMode = "priority" | "deadline" | "newest";

const getFormattedDate = (timestamp: any) => {
  if (!timestamp) return "";
  try {
    let date: Date;
    if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleDateString("en-CA"); // YYYY-MM-DD
  } catch (e) {
    return "";
  }
};

const priorityOrder: Record<string, number> = {
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4
};

const getDept = (id: string) => DEPARTMENTS.find((d) => d.id === id);

const getTaskDate = (t: any) => {
  if (!t.created_at && !t.createdAt) return 0;
  const d = t.created_at || t.createdAt;
  return new Date(d).getTime();
};

const isReviewReadyStatus = (status: string) => status === "executed" || status === "waiting_review";

const TaskStatusPill = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; style: string }> = {
    pending_acceptance: { label: "بانتظار القبول", style: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" },
    accepted: { label: "قيد التنفيذ", style: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400" },
    todo: { label: "لم يبدأ", style: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350" },
    in_progress: { label: "قيد التنفيذ", style: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400" },
    executed: { label: "تم التسليم / مراجعة", style: "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400" },
    revision: { label: "مطلوب تعديل", style: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400" },
    completed: { label: "مكتمل ومعتمد", style: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" },
    rejected: { label: "مرفوض", style: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400" }
  };
  const item = map[status] || { label: status, style: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.style}`}>
      {item.label}
    </span>
  );
};

export const RequestCard = ({
  request,
  currentDeptId,
  userProfile,
  handleAcceptTask,
  handleRejectTask,
  updateRequestStatus,
  onOpen,
  onDelete
}: any) => {
  const sourceDept = getDept(request.sourceDept);
  const targetDept = getDept(request.targetDept);
  const priority = PRIORITIES[request.priority] || PRIORITIES.normal || PRIORITIES.p4;
  const isManager = userProfile?.role === "admin" || userProfile?.role === "manager" || userProfile?.role === "deputy";
  const isTargetDept = request.targetDept === currentDeptId;
  const isSourceDept = request.sourceDept === currentDeptId;

  const isCompleted = request.status === "completed";

  return (
    <article className={`rounded-[18px] border border-slate-100 p-5 shadow-sm hover:shadow-md transition dark:border-slate-800 flex flex-col justify-between text-right ${
      isCompleted 
        ? "bg-slate-50/50 dark:bg-slate-900/30 opacity-55" 
        : "bg-white dark:bg-slate-900"
    }`} dir="rtl">
      <div>
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <button onClick={onOpen} className="block w-full text-right outline-none">
              <h3 className={`text-base font-black text-slate-805 dark:text-white truncate ${
                isCompleted ? "line-through text-slate-400" : ""
              }`}>
                {request.title || "طلب بدون عنوان"}
              </h3>
            </button>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{request.details || "-"}</p>
          </div>
          <ArrowLeftRight size={20} className="text-indigo-500 shrink-0" />
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5 text-xs justify-start">
          <TaskStatusPill status={request.status} />
          {request.deadline && (
            <span className="flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800">
              <Calendar size={11} />
              {request.deadline}
            </span>
          )}
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priority.color}`}>
            {priority.label}
          </span>
          {(request.status === 'completed' || isReviewReadyStatus(request.status)) && (request.completedAt || request.updatedAt) && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[11px] font-bold dark:bg-emerald-950/20 dark:text-emerald-400">
              <Check size={11} />
              <span>اكتمل في: {getFormattedDate(request.completedAt || request.updatedAt)}</span>
            </span>
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
          <div>
            <span className="block text-slate-400 mb-0.5">من قسم</span>
            <span className="text-slate-800 dark:text-slate-200">{sourceDept?.nameAr || request.sourceDept}</span>
          </div>
          <div>
            <span className="block text-slate-400 mb-0.5">إلى قسم</span>
            <span className="text-slate-800 dark:text-slate-200">{targetDept?.nameAr || request.targetDept}</span>
          </div>
        </div>

        {request.rejectionReason && (
          <div className="mb-3 rounded-xl bg-red-50 border border-red-100 p-2.5 text-xs text-red-700 dark:bg-red-950/20 dark:text-red-400">
            <strong>سبب الرفض:</strong> {request.rejectionReason}
          </div>
        )}

        {request.revisionNote && (
          <div className="mb-3 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 animate-pulse">
            <div className="flex items-center gap-1 font-black mb-1">
              <AlertTriangle size={14} className="text-rose-600 dark:text-rose-400" />
              <span>⚠️ تعديل مطلوب من المرسل:</span>
            </div>
            <p className="font-medium">{request.revisionNote}</p>
          </div>
        )}

        {request.deliveryLink && (
          <a
            href={request.deliveryLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 py-2.5 text-xs font-black text-indigo-750 hover:bg-indigo-100 hover:text-indigo-800 transition dark:bg-indigo-950/20 dark:text-indigo-400 w-full"
          >
            <LinkIcon size={14} />
            <span>🎨 فتح رابط تسليم التصميم (خارجي)</span>
          </a>
        )}
      </div>

      <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
        {request.status === "pending_acceptance" && isTargetDept && isManager && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAcceptTask?.(request)}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700 transition"
            >
              قبول البدء
            </button>
            <button
              onClick={() => {
                const reason = prompt("سبب الرفض:");
                if (reason) handleRejectTask?.(request, reason);
              }}
              className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 transition"
            >
              رفض
            </button>
          </div>
        )}

        {((isReviewReadyStatus(request.status) || request.status === "completed") && isSourceDept && isManager) && (
          <div className="grid grid-cols-2 gap-2">
            {request.status !== "completed" && (
              <button
                onClick={() => updateRequestStatus?.(request.id, "completed")}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 transition"
              >
                قبول واعتماد التصميم
              </button>
            )}
            <button
              onClick={() => {
                const note = prompt("الملاحظات والتعديلات المطلوبة:");
                if (note) updateRequestStatus?.(request.id, "revision", note);
              }}
              className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                request.status === "completed" 
                  ? "col-span-2 bg-orange-600 text-white hover:bg-orange-700" 
                  : "bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
            >
              طلب تعديل {request.status === "completed" && "إضافي"}
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onOpen} className="flex-1 rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition dark:bg-slate-800 dark:text-slate-350">
            التفاصيل
          </button>
          <button onClick={onDelete} className="rounded-xl bg-rose-50/50 p-1.5 text-rose-600 hover:bg-rose-100 transition" title="حذف الطلب">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
};

export const TaskCard = ({
  task,
  userProfile,
  updateTaskStatus,
  onOpen,
  onDelete,
  categoriesList = [],
  updateTaskCategory,
  onOpenDeliveryCenter
}: any) => {
  const isManager = userProfile?.role === "admin" || userProfile?.role === "manager" || userProfile?.role === "deputy";
  const priority = PRIORITIES[task.priority] || PRIORITIES.normal || PRIORITIES.p4;
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const isCompleted = task.status === 'completed';
  const currentDeptId = userProfile?.departmentId || "general";

  return (
    <article className={`rounded-[18px] border border-slate-100 p-5 shadow-sm hover:shadow-md transition dark:border-slate-800 flex flex-col justify-between text-right ${
      isCompleted 
        ? "bg-slate-50/50 dark:bg-slate-900/30 opacity-55" 
        : "bg-white dark:bg-slate-900"
    }`} dir="rtl">
      <div>
        <div className="flex justify-between items-start gap-3 mb-3">
          {/* Completion Action */}
          {task.targetDept === currentDeptId && !(task.isAlsoForSelf && task.linkedRequestId) && task.status !== 'completed' && task.status !== 'executed' && (
            <button
              onClick={() => onOpenDeliveryCenter?.(task)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-black text-[10px] rounded-xl transition flex items-center gap-1 shrink-0 dark:bg-indigo-950/20 dark:text-indigo-400"
              title="تسليم المهمة"
            >
              <Send size={11} />
              تسليم
            </button>
          )}

          <div className="flex-1 min-w-0">
            <button onClick={onOpen} className="block w-full text-right outline-none">
              <h3 className={`text-base font-black text-slate-800 dark:text-white truncate ${isCompleted ? 'line-through opacity-60' : ''}`}>
                {task.title || "مهمة بدون عنوان"}
              </h3>
            </button>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.details || "-"}</p>
          </div>
          <ListFilter size={20} className="text-emerald-500 shrink-0" />
        </div>

        {task.revisionRequested && task.revisionNote && (
          <div className="mb-3 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 animate-pulse">
            <div className="flex items-center gap-1 font-black mb-1">
              <AlertTriangle size={14} className="text-rose-600 dark:text-rose-400" />
              <span>⚠️ تعديل مطلوب من المرسل:</span>
            </div>
            <p className="font-medium">{task.revisionNote}</p>
          </div>
        )}

        {task.deliveryLink && (
          <a
            href={task.deliveryLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 py-2.5 text-xs font-black text-indigo-750 hover:bg-indigo-100 hover:text-indigo-800 transition dark:bg-indigo-950/20 dark:text-indigo-400 w-full"
          >
            <LinkIcon size={14} />
            <span>🎨 فتح رابط تسليم التصميم (خارجي)</span>
          </a>
        )}

        <div className="mb-4 flex flex-wrap gap-1.5 text-xs justify-start items-center">
          <TaskStatusPill status={task.status} />
          
          {/* Category Dropdown Picker */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowCategoryMenu(!showCategoryMenu)}
              className="flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            >
              📂 {task.category || "بدون قسم"}
            </button>
            
            {showCategoryMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCategoryMenu(false)}></div>
                <div className="absolute right-0 z-50 mt-1 w-44 rounded-xl border border-slate-100 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <p className="px-2 py-1 text-[10px] font-black text-slate-400">تغيير القسم:</p>
                  <button
                    type="button"
                    onClick={() => {
                      updateTaskCategory?.(task.id, "");
                      setShowCategoryMenu(false);
                    }}
                    className="w-full rounded-lg px-2.5 py-1.5 text-right text-xs font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    إزالة القسم (Ungroup)
                  </button>
                  {categoriesList.map((cat: string) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        updateTaskCategory?.(task.id, cat);
                        setShowCategoryMenu(false);
                      }}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-right text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        task.category === cat ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50" : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      📂 {cat}
                    </button>
                  ))}
                  <div className="border-t border-slate-100 my-1 dark:border-slate-800"></div>
                  <button
                    type="button"
                    onClick={() => {
                      const newCat = prompt("اسم القسم الجديد:");
                      if (newCat) {
                        updateTaskCategory?.(task.id, newCat);
                      }
                      setShowCategoryMenu(false);
                    }}
                    className="w-full rounded-lg px-2.5 py-1.5 text-right text-xs font-black text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                  >
                    + قسم جديد...
                  </button>
                </div>
              </>
            )}
          </div>

          {task.dueDate && (
            <span className="flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800">
              <Calendar size={11} />
              {task.dueDate}
            </span>
          )}
          {task.assignedToName && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400">
              <User size={11} />
              {task.assignedToName}
            </span>
          )}
          {(task.status === 'done' || task.status === 'review') && task.updatedAt && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[11px] font-bold dark:bg-emerald-950/20 dark:text-emerald-400">
              <Check size={11} />
              <span>اكتمل في: {getFormattedDate(task.updatedAt)}</span>
            </span>
          )}
        </div>

        {/* Progress indicator */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
            <span>نسبة الإنجاز</span>
            <span>{task.progress || 0}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${task.progress || 0}%` }}></div>
          </div>
        </div>
      </div>

      {task.isAlsoForSelf && task.linkedRequestId && (
        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200/60 p-3 text-xs space-y-2 dark:bg-slate-900/40 dark:border-slate-800">
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
            <span>القسم المنفذ:</span>
            <span className="text-slate-800 dark:text-slate-200 font-black">{DEPARTMENTS.find(d => d.id === task.requestTargetDept)?.nameAr || task.requestTargetDept || "عامة"}</span>
          </div>
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
            <span>حالة التصميم هناك:</span>
            <span className={`rounded-full px-2.5 py-0.5 font-black text-[10px] ${
              task.status === 'done' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' :
              task.status === 'review' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400' :
              task.status === 'in_progress' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' :
              task.status === 'rejected' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400' :
              'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
            }`}>
              {task.status === 'pending_acceptance' ? 'بانتظار القبول' :
               task.status === 'todo' ? 'لم يبدأ بعد' :
               task.status === 'in_progress' ? 'قيد التنفيذ' :
               task.status === 'review' ? 'قيد المراجعة' :
               task.status === 'done' ? 'مكتمل ومعتمد' :
               task.status === 'rejected' ? 'مرفوض' : task.status || 'غير معروف'}
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
        <div className="flex gap-2">
          <button onClick={onOpen} className="flex-1 rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition dark:bg-slate-800 dark:text-slate-350">
            التفاصيل
          </button>
          <button onClick={onDelete} className="rounded-xl bg-rose-50/50 p-1.5 text-rose-600 hover:bg-rose-100 transition">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
};

export default function TaskBoard({
  activeDeptId,
  tasks = [],
  requests = [],
  setSelectedTask,
  userProfile,
  handleAcceptTask,
  handleRejectTask,
  updateTaskStatus,
  updateRequestStatus,
  deleteTask,
  onOpenAddTask = () => {},
  deptSettings = {},
  addCategory,
  renameCategory,
  deleteCategory,
  updateTaskCategory,
  user,
  telegramConfig,
  onSendTelegram
}: any) {
  
  const isDirectScope = ["my_tasks", "incoming_requests", "outgoing_requests", "completed_tasks"].includes(activeDeptId);

  const getInitialScope = (): TaskScope => {
    if (activeDeptId === "incoming_requests" || activeDeptId === "hr_admin_assignments" || activeDeptId === "inbox") return "incoming";
    if (activeDeptId === "outgoing_requests") return "outgoing";
    if (activeDeptId === "completed_tasks") return "completed";
    return "mine";
  };

  const [scope, setScope] = useState<TaskScope>(getInitialScope());
  const [deliveryTask, setDeliveryTask] = useState<any>(null);

  // Sync board scope and filter states when the active view changes from the sidebar
  useEffect(() => {
    setScope(getInitialScope());
    setSearchQuery("");
    setSelectedCategoryFilter("all");
  }, [activeDeptId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("priority");
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

  const currentDeptId = userProfile?.departmentId || "general";

  const effectiveTasks = useMemo(() => {
    const requestById = new Map(requests.map((request: any) => [request.id, request]));

    return tasks.map((task: any) => {
      if (!task.linkedRequestId) return task;

      const linkedRequest: any = requestById.get(task.linkedRequestId);
      if (!linkedRequest?.status) return task;

      const linkedStatus = linkedRequest.status === "waiting_review"
        ? "executed"
        : linkedRequest.status === "revision_requested"
          ? "revision"
          : linkedRequest.status;

      return {
        ...task,
        status: linkedStatus,
        progress: linkedStatus === "completed" ? 100 : linkedStatus === "executed" ? Math.max(Number(task.progress || 0), 90) : task.progress,
        completedAt: task.completedAt || linkedRequest.completedAt,
        updatedAt: task.updatedAt || linkedRequest.updatedAt,
        revisionNote: linkedRequest.revisionNote || task.revisionNote
      };
    });
  }, [tasks, requests]);

  // Calculate unique categories from settings and tasks
  const categoriesList = useMemo(() => {
    const fromSettings = deptSettings?.categories || [];
    const fromTasks = Array.from(new Set(effectiveTasks.map((t: any) => t.category).filter(Boolean)));
    return Array.from(new Set([...fromSettings, ...fromTasks])) as string[];
  }, [deptSettings, effectiveTasks]);

  // Filter requests/tasks
  const items = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    // 1. Load Requests
    if (scope === "incoming") {
      return requests
        .filter((r: any) => r.targetDept === currentDeptId && r.status === "pending_acceptance")
        .filter((r: any) => {
          const isFromHrAdmin = r.sourceDept === 'hr';
          if (activeDeptId === "hr_admin_assignments") {
            return isFromHrAdmin;
          } else {
            return !isFromHrAdmin;
          }
        })
        .filter((r: any) => !query || `${r.title} ${r.details}`.toLowerCase().includes(query))
        .sort((a: any, b: any) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4));
    }
    if (scope === "outgoing") {
      return requests
        .filter((r: any) => r.sourceDept === currentDeptId)
        .filter((r: any) => !query || `${r.title} ${r.details}`.toLowerCase().includes(query))
        .sort((a: any, b: any) => getTaskDate(b) - getTaskDate(a));
    }
    
    // 2. Load Completed
    if (scope === "completed") {
      const finishedTasks = effectiveTasks.filter((t: any) => t.targetDept === currentDeptId && t.status === "completed");
      const finishedRequests = requests.filter((r: any) => (r.sourceDept === currentDeptId || r.targetDept === currentDeptId) && r.status === "completed");
      
      let filtered = [...finishedTasks, ...finishedRequests];
      if (selectedCategoryFilter !== "all") {
        filtered = filtered.filter((i: any) => {
          const cat = i.category || "";
          if (selectedCategoryFilter === "none") return !cat;
          return cat === selectedCategoryFilter;
        });
      }
      return filtered
        .filter((i: any) => !query || `${i.title} ${i.details}`.toLowerCase().includes(query))
        .sort((a: any, b: any) => getTaskDate(b) - getTaskDate(a));
    }

    // 3. Load Internal Tasks (scope === "mine")
    let filtered = effectiveTasks.filter((t: any) => t.targetDept === currentDeptId && t.status !== "completed" && t.status !== "forwarded");
    if (selectedCategoryFilter !== "all") {
      filtered = filtered.filter((t: any) => {
        const cat = t.category || "";
        if (selectedCategoryFilter === "none") return !cat;
        return cat === selectedCategoryFilter;
      });
    }
    
    return filtered
      .filter((t: any) => !query || `${t.title} ${t.details} ${t.assignedToName}`.toLowerCase().includes(query))
      .sort((a: any, b: any) => {
        if (sortBy === "deadline") return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
        if (sortBy === "newest") return getTaskDate(b) - getTaskDate(a);
        return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
      });

  }, [scope, effectiveTasks, requests, currentDeptId, searchQuery, sortBy, selectedCategoryFilter]);

  const counts = useMemo(() => {
    return {
      mine: effectiveTasks.filter((t: any) => t.targetDept === currentDeptId && t.status !== "completed" && t.status !== "forwarded").length,
      incoming: requests.filter((r: any) => r.targetDept === currentDeptId && r.status === "pending_acceptance").length,
      outgoing: requests.filter((r: any) => r.sourceDept === currentDeptId).length,
      completed: effectiveTasks.filter((t: any) => t.targetDept === currentDeptId && t.status === "completed").length +
                 requests.filter((r: any) => (r.sourceDept === currentDeptId || r.targetDept === currentDeptId) && r.status === "completed").length
    };
  }, [effectiveTasks, requests, currentDeptId]);

  const getPageTitle = () => {
    if (activeDeptId === "my_tasks") return "مهامي الحالية";
    if (activeDeptId === "incoming_requests") return "الطلبات الواردة";
    if (activeDeptId === "outgoing_requests") return "الطلبات الصادرة";
    if (activeDeptId === "completed_tasks") return "المهام والطلبات المكتملة";
    return getDept(currentDeptId)?.nameAr || "مهام القسم";
  };

  return (
    <section className="flex h-full flex-col bg-slate-50/50 dark:bg-slate-950/60" dir="rtl">
      <header className="border-b border-slate-100 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-slate-400">
              <span>اللجنة: {getDept(currentDeptId)?.nameAr || "عامة"}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white">{getPageTitle()}</h1>
          </div>

          <button
            onClick={() => onOpenAddTask()}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition"
          >
            <Plus size={18} />
            إرسال طلب جديد
          </button>
        </div>

        {/* Filters bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          
          {!isDirectScope ? (
            <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
              {[
                { id: "mine", label: "مهامي الداخلية", icon: ListFilter },
                { id: "incoming", label: "الطلبات الواردة", icon: Inbox },
                { id: "outgoing", label: "الطلبات الصادرة", icon: Send },
                { id: "completed", label: "المنتهية والمكتملة", icon: CheckCircle2 }
              ].map((tab) => {
                const Icon = tab.icon;
                const active = scope === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setScope(tab.id as TaskScope)}
                    className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition md:px-4 ${
                      active ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-indigo-50 text-indigo-700" : "bg-white/70 text-slate-500 dark:bg-slate-900"}`}>
                      {counts[tab.id as TaskScope]}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-xs font-bold text-slate-400">
              عدد العناصر: {items.length}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mr-auto">
            {/* Search Input */}
            <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              <Search size={16} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-40 bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
                placeholder="بحث في القائمة..."
              />
            </label>

            {/* Category Filter Select */}
            {(scope === "mine" || scope === "completed") && (
              <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <span>📂</span>
                <select 
                  value={selectedCategoryFilter} 
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)} 
                  className="bg-transparent outline-none max-w-[120px] truncate"
                >
                  <option value="all">كل الأقسام</option>
                  <option value="none">بدون قسم</option>
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Grouping Toggle */}
            {(scope === "mine" || scope === "completed") && (
              <button
                type="button"
                onClick={() => setGroupByCategory(!groupByCategory)}
                className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-xs font-black transition ${
                  groupByCategory 
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm hover:bg-indigo-700" 
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350"
                }`}
              >
                <span>🔲</span>
                {groupByCategory ? "إلغاء التجميع" : "تجميع الأقسام (Group)"}
              </button>
            )}

            {/* Add Category Button */}
            {(scope === "mine" || scope === "completed") && (
              <button
                type="button"
                onClick={() => {
                  const newCat = prompt("اسم القسم الجديد:");
                  if (newCat) {
                    addCategory?.(newCat);
                  }
                }}
                className="flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <Plus size={14} />
                قسم جديد
              </button>
            )}

            {/* Sort Select */}
            <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <Clock size={15} />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)} className="bg-transparent outline-none">
                <option value="priority">الأولوية</option>
                <option value="deadline">الموعد</option>
                <option value="newest">الأحدث</option>
              </select>
            </label>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        {items.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <Inbox size={32} className="text-slate-300 mb-2" />
            <h2 className="text-sm font-black text-slate-800 dark:text-white">لا توجد طلبات أو مهام حالياً</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">يمكنك إضافة طلب أو تعديل فلتر البحث أعلاه.</p>
          </div>
        ) : groupByCategory && (scope === "mine" || scope === "completed") ? (
          <div>
            {categoriesList.map((cat: string) => {
              const catTasks = items.filter((t: any) => t.category === cat);
              if (catTasks.length === 0 && selectedCategoryFilter !== "all" && selectedCategoryFilter !== cat) return null;
              return (
                <div key={cat} className="mb-8 rounded-3xl bg-slate-100/30 p-6 border border-slate-200/50 dark:bg-slate-900/30 dark:border-slate-800/80">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-black text-slate-800 dark:text-white">📂 {cat}</h2>
                      <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {catTasks.length} مهام
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newName = prompt("اسم القسم الجديد:", cat);
                          if (newName && newName !== cat) {
                            renameCategory?.(cat, newName);
                          }
                        }}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 transition dark:hover:bg-slate-800"
                        title="تعديل اسم القسم"
                      >
                        <RefreshCw size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف القسم "${cat}"؟ سيتم إلغاء تصنيف جميع مهامه.`)) {
                            deleteCategory?.(cat);
                          }
                        }}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition dark:hover:bg-rose-950/20"
                        title="حذف القسم"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {catTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-6 text-center dark:border-slate-800 dark:bg-slate-900/20">
                      <p className="text-xs font-bold text-slate-400">لا توجد مهام في هذا القسم.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
                      {catTasks.map((task: any) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          userProfile={userProfile}
                          updateTaskStatus={updateTaskStatus}
                          onOpen={() => setSelectedTask(task)}
                          onDelete={() => deleteTask?.(task.id)}
                          categoriesList={categoriesList}
                          updateTaskCategory={updateTaskCategory}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped Tasks */}
            {(() => {
              const ungroupedTasks = items.filter((t: any) => !t.category);
              if (ungroupedTasks.length === 0 && selectedCategoryFilter !== "all" && selectedCategoryFilter !== "none") return null;
              return (
                <div className="mb-8 rounded-3xl bg-slate-100/30 p-6 border border-slate-200/50 dark:bg-slate-900/30 dark:border-slate-800/80">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-black text-slate-800 dark:text-white">📂 مهام بدون قسم (غير مصنفة)</h2>
                      <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {ungroupedTasks.length} مهام
                      </span>
                    </div>
                  </div>
                  
                  {ungroupedTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-6 text-center dark:border-slate-800 dark:bg-slate-900/20">
                      <p className="text-xs font-bold text-slate-400">لا توجد مهام غير مصنفة.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
                      {ungroupedTasks.map((task: any) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          userProfile={userProfile}
                          updateTaskStatus={updateTaskStatus}
                          onOpen={() => setSelectedTask(task)}
                          onDelete={() => deleteTask?.(task.id)}
                          categoriesList={categoriesList}
                          updateTaskCategory={updateTaskCategory}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
            {items.map((item: any) => {
              const isRequest = scope === "incoming" || scope === "outgoing" || (scope === "completed" && item.sourceDept && item.targetDept && item.sourceDept !== item.targetDept);
              
              if (isRequest) {
                return (
                  <RequestCard
                    key={item.id}
                    request={item}
                    currentDeptId={currentDeptId}
                    userProfile={userProfile}
                    handleAcceptTask={handleAcceptTask}
                    handleRejectTask={handleRejectTask}
                    updateRequestStatus={updateRequestStatus}
                    onOpen={() => setSelectedTask(item)}
                    onDelete={() => deleteTask?.(item.id)}
                  />
                );
              }
              
              return (
                <TaskCard
                  key={item.id}
                  task={item}
                  userProfile={userProfile}
                  updateTaskStatus={updateTaskStatus}
                  onOpen={() => setSelectedTask(item)}
                  onDelete={() => deleteTask?.(item.id)}
                  categoriesList={categoriesList}
                  updateTaskCategory={updateTaskCategory}
                  onOpenDeliveryCenter={setDeliveryTask}
                />
              );
            })}
          </div>
        )}
      </main>

      {deliveryTask && (
        <TaskDeliveryCenter
          isOpen={!!deliveryTask}
          onClose={() => setDeliveryTask(null)}
          task={deliveryTask}
          collName={deliveryTask.linkedRequestId ? "requests" : "tasks"}
          user={user}
          userProfile={userProfile}
          onSuccess={() => setDeliveryTask(null)}
          telegramConfig={telegramConfig}
          onSendTelegram={onSendTelegram}
        />
      )}
    </section>
  );
}
