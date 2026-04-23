import React, { useState, useEffect } from "react";
import { 
    Plus, 
    Share2, 
    Table as TableIcon, 
    LayoutGrid, 
    Users, 
    ArrowRight, 
    Eye, 
    Edit2, 
    Check, 
    X, 
    Filter, 
    SortAsc, 
    MoreHorizontal, 
    Hash, 
    Calendar as CalendarIcon, 
    List, 
    ChevronDown, 
    ChevronLeft, 
    ChevronRight, 
    Circle, 
    CheckCircle,
    CheckCircle2,
    Search,
    User,
    Trash2
} from "lucide-react";

import TaskCard from "./TaskCard";
import { DEPARTMENTS, USER_ROLES, CHARITY_ROLES } from "../utils/constants";
import { TRANSLATIONS } from "../utils/translations";
import { toast } from "react-hot-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export default function TaskBoard({
  activeDeptId,
  tasks,
  newTask,
  setNewTask,
  eduType,
  setEduType,
  eduData,
  setEduData,
  handleAddTask,
  toggleStatus,
  deleteTask,
  initiateForward,
  onForwardToArt,
  setSelectedTask,
  updateTaskCategory,
  updateTaskInternalCategory,
  renameCategory,
  user,
  userProfile,
  onOpenAddTask = () => {},
  currentUserDept,
  handleAcceptTask,
  handleRejectTask,
  deptSettings
}: any) {
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar'>('list');
  const [sortBy, setSortBy] = useState<'priority' | 'deadline' | 'status'>('priority');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hrViewMode, setHrViewMode] = useState<'internal' | 'outgoing'>('internal');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [brandLogos, setBrandLogos] = useState<{name: string, url: string}[]>([]);
  const [selectedLogos, setSelectedLogos] = useState<string[]>([]);

  const [taskMode, setTaskMode] = useState<'self' | 'forward'>('self');
  const [eduBatchNumber, setEduBatchNumber] = useState("");
  const [eduCreateCover, setEduCreateCover] = useState(false);

  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sourceDeptFilter, setSourceDeptFilter] = useState<string>('all');
  const [selectedInternalCategory, setSelectedInternalCategory] = useState<string>('all');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newInternalCategoryName, setNewInternalCategoryName] = useState("");

  const getNext7Days = () => {
      const days = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          days.push({
              name: date.toLocaleDateString('ar-EG', { weekday: 'short' }),
              date: date.getDate(),
              fullDate: date.toLocaleDateString('en-CA'),
              isToday: i === 0
          });
      }
      return days;
  };

  const t = TRANSLATIONS['ar'];
  const lang = 'ar';

  const addInternalCategory = async () => {
      if (!newInternalCategoryName.trim() || !userProfile?.departmentId || sourceDeptFilter === 'all') return;
      try {
          const currentCategories = deptSettings?.customCategories?.[sourceDeptFilter] || [];
          if (currentCategories.includes(newInternalCategoryName.trim())) {
              toast.error("التصنيف موجود بالفعل");
              return;
          }
          
          const updatedCategories = [...currentCategories, newInternalCategoryName.trim()];
          const deptSettingsRef = doc(db, "department_settings", userProfile.departmentId);
          
          await setDoc(deptSettingsRef, {
              customCategories: {
                  ...deptSettings?.customCategories,
                  [sourceDeptFilter]: updatedCategories
              }
          }, { merge: true });
          
          setNewInternalCategoryName("");
          setIsAddingCategory(false);
          toast.success("تم إضافة التصنيف بنجاح");
      } catch (error) {
          console.error("Error adding internal category:", error);
          toast.error("فشل في إضافة التصنيف");
      }
  };

  const normalizeInternalCategory = (value: string) => {
      const v = (value || "").trim();
      if (!v || v === "عام" || v.toLowerCase() === "general") return "general";
      return v;
  };

  const assignInternalCategoryForTask = async (task: any, rawCategory: string) => {
      const normalizedCategory = normalizeInternalCategory(rawCategory);
      await updateTaskInternalCategory?.(task.id, normalizedCategory);

      if (normalizedCategory === "general" || !userProfile?.departmentId) return;

      const sourceKey = getTaskSourceDept(task);
      if (!sourceKey || sourceKey === "all") return;

      const existing = deptSettings?.customCategories?.[sourceKey] || [];
      if (existing.includes(normalizedCategory)) return;

      try {
          const deptSettingsRef = doc(db, "department_settings", userProfile.departmentId);
          await setDoc(deptSettingsRef, {
              customCategories: {
                  ...deptSettings?.customCategories,
                  [sourceKey]: [...existing, normalizedCategory]
              }
          }, { merge: true });
      } catch (error) {
          console.error("Error persisting internal category:", error);
      }
  };

  useEffect(() => {
      // Fetch brand logos
      const fetchBrand = async () => {
          try {
              const docRef = doc(db, "app_settings", "brand_identity");
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  setBrandLogos(data.additionalLogos || []);
              }
          } catch (e) {
              console.error("Error fetching brand logos", e);
          }
      };
      fetchBrand();
  }, []);

  const toggleLogo = (logoName: string) => {
      if (selectedLogos.includes(logoName)) {
          setSelectedLogos(selectedLogos.filter(l => l !== logoName));
      } else {
          setSelectedLogos([...selectedLogos, logoName]);
      }
  };

  const onAddTask = (e: React.FormEvent) => {
      e.preventDefault();
      
      // HR Assignment Check
      if (isHR && hrViewMode === 'outgoing' && !newTask.targetDept) {
          alert("الرجاء اختيار القسم المستلم للتكليف");
          return;
      }

      const taskData = {
          ...newTask,
          isForSelf: taskMode === 'self',
          eduBatchNumber,
          eduCreateCover,
          selectedLogos
      };

      // handleAddTask(e, taskData); // Removed as handled by modal
      setSelectedLogos([]);
      setEduBatchNumber("");
      setEduCreateCover(false);
      // setIsAddingTask(false); // Removed
      // onCloseAdding?.(); // Removed
  };

  // ... rest of the component


  // Get unique categories for this department
  const categories = Array.from(new Set(
      tasks
        .map((t: any) => t.category)
        .filter(Boolean)
  )) as string[];

  // If educational department, allow switching views
  const isEducational = activeDeptId === 'educational';
  const isHR = activeDeptId === 'hr';

  const startEditingCategory = (cat: string) => {
      setEditingCategory(cat);
      setNewCategoryName(cat);
  };

  const saveCategoryName = () => {
      if (editingCategory && newCategoryName && editingCategory !== newCategoryName) {
          renameCategory?.(editingCategory, newCategoryName);
      }
      setEditingCategory(null);
      setNewCategoryName("");
  };

  const renderBoardView = (tasksToRender: any[]) => {
    const columns = [
        { id: 'todo', title: t.inProgress, icon: <Circle size={16} className="text-gray-400" /> },
        { id: 'completed', title: t.completed, icon: <CheckCircle size={16} className="text-green-500" /> }
    ];

    return (
        <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar h-full items-start">
            {columns.map(col => {
                const colTasks = tasksToRender.filter(t => col.id === 'completed' ? t.status === 'completed' : t.status !== 'completed');
                return (
                    <div key={col.id} className="flex-shrink-0 w-80 bg-gray-50/50 dark:bg-gray-900/20 rounded-xl p-4 flex flex-col max-h-full">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <div className="flex items-center gap-2">
                                {col.icon}
                                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wider">{col.title}</h3>
                                <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">{colTasks.length}</span>
                            </div>
                            <button className="p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1">
                            {renderGroupedTasks(colTasks)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  const renderCalendarView = (tasksToRender: any[]) => {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const monthName = currentMonth.toLocaleString('ar-EG', { month: 'long', year: 'numeric' });

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 dark:text-white">{monthName}</h3>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><ChevronRight size={18} /></button>
                    <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
                </div>
            </div>
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
                {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map(d => (
                    <div key={d} className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {days.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="h-24 border-b border-l border-gray-50 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-900/10"></div>;
                    
                    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayTasks = tasksToRender.filter(t => t.deadline === dateStr);
                    const isToday = today.getDate() === day && today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear();

                    return (
                        <div key={day} className={`h-32 border-b border-l border-gray-50 dark:border-gray-800/50 p-1 overflow-y-auto custom-scrollbar ${isToday ? 'bg-red-50/30 dark:bg-red-900/5' : ''}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-red-600 text-white' : 'text-gray-500'}`}>{day}</span>
                            </div>
                            <div className="space-y-1">
                                {dayTasks.map(t => (
                                    <div key={t.id} onClick={() => setSelectedTask(t)} className="text-[9px] p-1 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded shadow-sm truncate cursor-pointer hover:border-red-400 transition-colors">
                                        {t.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const renderGroupedTasks = (taskList: any[]) => {
      const grouped = taskList.reduce((acc: any, task: any) => {
          const cat = task.category || "عام";
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(task);
          return acc;
      }, {});

      const sortedCategories = Object.keys(grouped).sort((a, b) => {
          if (a === "عام") return -1;
          if (b === "عام") return 1;
          return a.localeCompare(b);
      });

      return sortedCategories.map((cat) => (
          <div key={cat} className="space-y-4 mb-10 last:mb-0">
              <div className="flex items-center gap-3 px-2 group">
                  <div className="w-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full group-hover:bg-indigo-400 transition-colors" />
                  <span className="text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">{cat}</span>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  <span className="text-[10px] font-bold text-gray-300 bg-gray-50 dark:bg-gray-800/50 px-2 py-0.5 rounded-md">{grouped[cat].length}</span>
                  {renameCategory && (
                      <button onClick={(e) => { e.stopPropagation(); startEditingCategory(cat); }} className="opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-indigo-500 p-1">
                          <Edit2 size={12} />
                      </button>
                  )}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {grouped[cat].map((task: any, idx: number) => (
                      <TaskCard 
                        key={`${task.id}-${idx}`} 
                        task={task} 
                        isIncoming={activeDeptId !== 'inbox' && task.targetDept === activeDeptId && task.sourceDept !== activeDeptId}
                        onOpen={()=>setSelectedTask(task)} 
                        onToggle={()=>toggleStatus(task)} 
                        onDelete={()=>deleteTask(task.id)} 
                        onForward={(target: string)=>initiateForward(task, target)} 
                        onForwardToArt={onForwardToArt}
                        isEducational={isEducational}
                        onUpdateCategory={(newCat: string) => updateTaskCategory(task.id, newCat)}
                        onUpdateInternalCategory={(newCat: string) => assignInternalCategoryForTask(task, newCat)}
                        availableCategories={categories}
                        availableInternalCategories={getInternalCategoriesForTask(task)}
                        lang={lang} 
                      />
                  ))}
              </div>
          </div>
      ));
  };





  const activeDept = DEPARTMENTS.find(d => d.id === activeDeptId);
  const getTaskSourceDept = (task: any) => task.originalSourceDept || task.sourceDept;
  const getInternalCategoriesForTask = (task: any) => {
      const sourceKey = getTaskSourceDept(task);
      const rawFromSettings = deptSettings?.customCategories?.[sourceKey] || [];
      const rawFromTasks = tasks
        .filter((t: any) => getTaskSourceDept(t) === sourceKey)
        .map((t: any) => t.internalCategory)
        .filter(Boolean);

      return Array.from(new Set(
          [...rawFromSettings, ...rawFromTasks]
            .map((cat: string) => normalizeInternalCategory(cat))
            .filter((cat: string) => cat !== "general")
      ));
  };

  const processedTasks = tasks
    .filter((t: any) => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'completed') return t.status === 'completed';
        if (filterStatus === 'active') return t.status !== 'completed'; // todo + in_progress
        return true;
    })
    .filter((t: any) => !searchQuery || t.title?.toLowerCase().includes(searchQuery.toLowerCase()) || t.details?.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((t: any) => !selectedDateFilter || t.deadline === selectedDateFilter)
    .filter((t: any) => selectedCategory === 'all' || t.category === selectedCategory)
    .sort((a: any, b: any) => {
        if (sortBy === 'priority') {
            const pMap: any = { p1: 1, p2: 2, p3: 3, p4: 4 };
            return (pMap[a.priority] || 4) - (pMap[b.priority] || 4);
        }
        if (sortBy === 'deadline') {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return a.deadline.localeCompare(b.deadline);
        }
        if (sortBy === 'status') {
            const sMap: any = { todo: 1, in_progress: 2, completed: 3 };
            return (sMap[a.status] || 1) - (sMap[b.status] || 1);
        }
        return 0;
    });

  const isInboxView = activeDeptId === 'inbox';

  // 3. Incoming Tasks (HR Assignments + Chat Conversions + Forwarded from other depts)
  // Logic: Target is this dept, but Source is NOT this dept.
  // FILTER: Exclude hidden sheet items from incoming list just in case
  const incomingTasks = processedTasks.filter((t: any) => {
      if (isInboxView) return true;
      return t.targetDept === activeDeptId && t.sourceDept !== activeDeptId && !t.isSheetItem && t.status !== 'pending_acceptance';
  });

  // Tasks relevant to current department
  const deptTasks = isInboxView ? processedTasks : processedTasks.filter((t: any) => (t.targetDept === activeDeptId || t.sourceDept === activeDeptId) && !t.isSheetItem && !t.sheetId);
  
  // Acceptance Gate Tasks
  const pendingAcceptanceTasks = deptTasks.filter((t: any) => t.status === 'pending_acceptance' && t.targetDept === activeDeptId);
  const activeDeptTasks = deptTasks.filter((t: any) => t.status !== 'pending_acceptance');

  // Matrix Logic: Unique departments that sent us tasks
  const uniqueSourceDepts = Array.from(new Set(
      activeDeptTasks
        .map((t: any) => getTaskSourceDept(t))
        .filter((src: string) => src && src !== activeDeptId && src !== 'self')
  )) as string[];

  const completedCount = deptTasks.filter((t: any) => t.status === 'completed').length;
  const progress = deptTasks.length > 0 ? Math.round((completedCount / deptTasks.length) * 100) : 0;

  // Filter Tasks based on HR Logic & Visibility
  // 1. HR Internal: Created by HR, No Target Dept (or target is HR)
  const hrInternalTasks = processedTasks.filter((t: any) => t.sourceDept === 'hr' && (!t.targetDept || t.targetDept === 'hr'));
  
  // 2. HR Outgoing: Created by HR, Has Target Dept
  const hrOutgoingTasks = processedTasks.filter((t: any) => t.sourceDept === 'hr' && t.targetDept && t.targetDept !== 'hr');

  // 4. Standard Department Tasks (Internal + Forwarded copies where source is this dept)
  // Logic: Source is this dept (internal) OR copied from another (forwardedFrom logic usually duplicates task with new source)
  // FILTER: Exclude items marked 'isSheetItem' (Sheet items shouldn't appear on board unless logic changes)
  // Tasks relevant to current department
  const standardDeptTasks = processedTasks.filter((t: any) => {
      if (isInboxView) return false;
      return t.sourceDept === activeDeptId && 
      (!t.targetDept || t.targetDept === activeDeptId || t.isAlsoForSelf) &&
      !t.isSheetItem && !t.sheetId &&
      (activeDeptId !== 'educational' || t.artTaskStatus !== 'completed') &&
      t.status !== 'pending_acceptance';
  });

  // Matrix Filtered Tasks
  const matrixTasks = processedTasks.filter((t: any) => {
      if (t.status === 'pending_acceptance') return false;
      const taskSource = getTaskSourceDept(t);
      if (sourceDeptFilter === 'self') {
          return taskSource === activeDeptId && (!t.targetDept || t.targetDept === activeDeptId);
      } else if (sourceDeptFilter === 'all') {
          return taskSource !== activeDeptId && t.targetDept === activeDeptId;
      } else {
          return taskSource === sourceDeptFilter && t.targetDept === activeDeptId;
      }
  });

  // Get Internal Categories for current Source Dept Filter
  const currentInternalCategories = sourceDeptFilter === 'all' ? [] : (deptSettings?.customCategories?.[sourceDeptFilter] || []);
  const groupedBySource = matrixTasks.reduce((acc: any, task: any) => {
      const sourceId = getTaskSourceDept(task) || 'unknown';
      if (!acc[sourceId]) acc[sourceId] = [];
      acc[sourceId].push(task);
      return acc;
  }, {});

  const userRoleName = [...USER_ROLES, ...CHARITY_ROLES].find(r => r.id === userProfile?.role)?.name || userProfile?.role || 'عضو';

  return (
    <>
        {/* Mobile View */}
        <div className="md:hidden flex flex-col h-full bg-gray-50 dark:bg-gray-900 animate-fade-in relative">
            {/* Header */}
            <div className={`pt-8 pb-6 px-4 rounded-b-[2rem] text-white shadow-lg relative overflow-hidden ${activeDept?.bgClass || 'bg-red-600'}`}>
                <div className="absolute top-0 right-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                
                <div className="relative z-10 flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-black mb-1">{activeDept?.nameAr || activeDept?.name || "المهمات"}</h1>
                        <p className="text-sm opacity-90 font-medium">
                            {userProfile?.displayName || user?.email?.split('@')[0] || 'مستخدم'} • {userRoleName}
                        </p>
                    </div>
                    <button className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                        <CalendarIcon size={20} className="text-white" />
                    </button>
                </div>

                {/* Date Scroller */}
                <div className="relative z-10 flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {getNext7Days().map((day, idx) => {
                        const isSelected = selectedDateFilter === day.fullDate;
                        const hasTasks = processedTasks.some((t: any) => t.deadline === day.fullDate && t.status !== 'completed');
                        return (
                            <button 
                                key={idx}
                                onClick={() => setSelectedDateFilter(isSelected ? null : day.fullDate)}
                                className={`flex flex-col items-center justify-center min-w-[60px] py-3 rounded-2xl transition-all relative ${isSelected ? 'bg-white text-red-600 shadow-md scale-105' : 'bg-white/20 text-white hover:bg-white/30'}`}
                            >
                                <span className="text-[11px] font-bold mb-1 opacity-90">{day.name}</span>
                                <span className="text-xl font-black">{day.date}</span>
                                {hasTasks && !isSelected && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-white rounded-full"></div>}
                                {hasTasks && isSelected && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></div>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24 custom-scrollbar bg-white dark:bg-gray-950 rounded-t-[2.5rem] -mt-6 z-20 relative">
                
                {/* Progress Banner (Aligned with Desktop) */}
                {deptTasks.length > 0 && (
                    <div className="mb-8 p-4 bg-gradient-to-l from-indigo-600 to-blue-700 rounded-3xl shadow-xl shadow-indigo-500/20 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                <CheckCircle2 size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-0.5">معدل الإنجاز</p>
                                <h2 className="text-sm font-black">{progress}% مكتمل</h2>
                            </div>
                        </div>
                        <div className="flex-1 max-w-[100px] h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white transition-all duration-1000" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}
                {/* Mobile Acceptance Gate */}
                {pendingAcceptanceTasks.length > 0 && (
                    <div className="mb-6 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-xs font-black text-amber-600 uppercase tracking-widest">طلبات واردة ({pendingAcceptanceTasks.length})</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                            {pendingAcceptanceTasks.map(task => (
                                <div key={task.id} className="min-w-[280px] bg-white dark:bg-gray-800 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 shadow-sm shadow-amber-500/5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black text-gray-800 dark:text-white line-clamp-1">{task.title}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold">من: {DEPARTMENTS.find(d => d.id === task.sourceDept)?.nameAr || task.sourceDept}</p>
                                        </div>
                                        <button onClick={() => setSelectedTask(task)} className="p-2 text-gray-400"><Eye size={16} /></button>
                                    </div>
                                    <button 
                                        onClick={() => handleAcceptTask?.(task)}
                                        className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-500/20"
                                    >
                                        قبول المهمة
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-black text-gray-800 dark:text-white">المهمات</h2>
                    
                    {/* Status Dropdown */}
                    <div className="relative">
                        <select 
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="appearance-none flex items-center gap-1 text-sm font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 pr-8 rounded-lg outline-none"
                        >
                            <option value="all">الكل</option>
                            <option value="todo">لسا هتعمل</option>
                            <option value="completed">مكتملة</option>
                        </select>
                        <ChevronDown size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-red-600 pointer-events-none" />
                    </div>
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-1">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === 'all' ? 'bg-gray-900 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 shadow-sm border border-gray-100 dark:border-gray-700'}`}
                        >
                            الكل
                        </button>
                        {categories.map((cat, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-red-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 shadow-sm border border-gray-100 dark:border-gray-700'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                {/* Task List */}
                <div className="space-y-4">
                    {isHR ? (
                        hrViewMode === 'outgoing' ? (
                            hrOutgoingTasks.length === 0 ? <div className="text-center py-10 text-gray-400 font-bold text-sm bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">لا توجد مهام</div> : renderGroupedTasks(hrOutgoingTasks)
                        ) : (
                            renderGroupedTasks(hrInternalTasks)
                        )
                    ) : (
                        [...incomingTasks, ...standardDeptTasks].filter(t => t.status !== 'pending_acceptance').length === 0 ? (
                            <div className="text-center py-10 text-gray-400 font-bold text-sm bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">لا توجد مهام</div>
                        ) : (
                            renderGroupedTasks([...incomingTasks, ...standardDeptTasks].filter(t => t.status !== 'pending_acceptance'))
                        )
                    )}
                </div>
            </div>

        </div>

        {/* Desktop View: Radical Redesign 4.0 */}
        <div className="hidden md:flex h-full bg-gray-50 dark:bg-gray-950 overflow-hidden" dir="rtl">
            
            {/* ── Vertical Sidebar (Filters & Dates) ── */}
            <aside className="w-20 lg:w-24 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 flex flex-col items-center py-6 gap-8 shrink-0 z-10 shadow-sm overflow-y-auto no-scrollbar">
                
                {/* Department Icon */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${activeDept?.bgClass || 'bg-red-500'} mb-2`}>
                    {activeDept ? <activeDept.icon size={24} className="text-white"/> : <Hash size={24} className="text-white"/>}
                </div>

                {/* Vertical Date Strip */}
                <div className="flex flex-col gap-2 w-full px-2">
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-center mb-1">الموعد</p>
                    <button
                        onClick={() => setSelectedDateFilter(null)}
                        className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${!selectedDateFilter ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                        <LayoutGrid size={18}/>
                        <span className="text-[8px] font-black mt-1">الكل</span>
                    </button>

                    <button
                        onClick={() => onOpenAddTask?.({})}
                        className="w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-all bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 mt-4 border border-indigo-100 dark:border-indigo-800"
                        title="إضافة مهمة سريعة"
                    >
                        <Plus size={20} strokeWidth={3}/>
                        <span className="text-[8px] font-black mt-0.5">إضافة</span>
                    </button>
                    {getNext7Days().map((day, idx) => (
                        <button key={idx} onClick={() => setSelectedDateFilter(selectedDateFilter === day.fullDate ? null : day.fullDate)}
                            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-all relative ${selectedDateFilter === day.fullDate ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                        >
                            <span className="text-[8px] font-bold mb-0.5 opacity-60">{day.name}</span>
                            <span className="text-sm font-black">{day.date}</span>
                            {tasks.some((t: any) => t.deadline === day.fullDate && t.status !== 'completed') && (
                                <div className={`absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full ${selectedDateFilter === day.fullDate ? 'bg-white' : 'bg-red-500'}`}/>
                            )}
                        </button>
                    ))}
                </div>

                {/* Divider */}
                <div className="w-10 h-px bg-gray-100 dark:bg-gray-800" />

                {/* Matrix Sources (Vertical) */}
                <div className="flex flex-col gap-3 w-full px-2">
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-center mb-1">المصادر</p>
                    <button 
                        onClick={() => { setSourceDeptFilter('all'); setSelectedInternalCategory('all'); }}
                        className={`w-full aspect-square rounded-xl flex items-center justify-center transition-all ${sourceDeptFilter === 'all' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-100'}`}
                        title="كل الأقسام المحوّلة"
                    >
                        <TableIcon size={20} />
                    </button>
                    <button 
                        onClick={() => { setSourceDeptFilter('self'); setSelectedInternalCategory('all'); }}
                        className={`w-full aspect-square rounded-xl flex items-center justify-center transition-all ${sourceDeptFilter === 'self' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-100'}`}
                        title="مهامي الخاصة"
                    >
                        <User size={20} />
                    </button>
                    {uniqueSourceDepts.map(srcId => {
                        const dept = DEPARTMENTS.find(d => d.id === srcId);
                        return (
                            <button 
                                key={srcId}
                                onClick={() => { setSourceDeptFilter(srcId); setSelectedInternalCategory('all'); }}
                                className={`w-full aspect-square rounded-xl flex items-center justify-center transition-all ${sourceDeptFilter === srcId ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-100'}`}
                                title={dept?.nameAr || srcId}
                            >
                                {dept ? <dept.icon size={20} /> : <Share2 size={20} />}
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* ── Main Content Area ── */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                
                {/* ── Top Premium Bar ── */}
                <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-8 py-5 flex items-center justify-between z-10">
                    <div className="flex items-center gap-6">
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">
                                <span>{activeDept?.nameAr || 'لوحة المهام'}</span>
                                <ChevronLeft size={10} />
                                <span className="text-indigo-500">
                                    {sourceDeptFilter === 'all' ? 'كل الأقسام المحوّلة' : sourceDeptFilter === 'self' ? 'مهامي الخاصة' : (DEPARTMENTS.find(d => d.id === sourceDeptFilter)?.nameAr || sourceDeptFilter)}
                                </span>
                            </div>
                            <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                                {activeDeptId === 'inbox'    ? 'بريد الوارد' :
                                 activeDeptId === 'today'    ? 'مهام اليوم' :
                                 activeDeptId === 'upcoming' ? 'المهام القادمة' :
                                 (activeDept?.nameAr || 'المهمات')}
                                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-400 px-3 py-1 rounded-full font-bold">
                                    {deptTasks.length} مهمة
                                </span>
                            </h1>
                        </div>

                        {/* Quick Search */}
                        <div className="relative w-64 lg:w-80 group">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={16}/>
                            <input
                                type="text"
                                placeholder="ابحث في أي شيء..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-3 pr-11 pl-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            />
                        </div>
                    </div>
                </header>

        {/* ── Secondary Header: Stats & Views ── */}
                {/* ── Secondary Slim Filter Bar ── */}
                <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-8 py-3 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        {/* Status Filter */}
                        <div className="flex bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-xl">
                            {[
                                {v:'all',     l:'الكل'},
                                {v:'active',  l:'غير مكتملة'},
                                {v:'completed',l:'مكتملة'}
                            ].map(x => (
                                <button key={x.v} onClick={() => setFilterStatus(x.v as any)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filterStatus === x.v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >{x.l}</button>
                            ))}
                        </div>

                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

                        {/* Internal Category Tabs (Small) */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-md">
                            <button onClick={() => setSelectedInternalCategory('all')} className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black transition ${selectedInternalCategory === 'all' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}>
                                كافة التصنيفات
                            </button>
                            {currentInternalCategories.map((cat: string) => (
                                <button key={cat} onClick={() => setSelectedInternalCategory(cat)} className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black transition ${selectedInternalCategory === cat ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}>
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Switch */}
                        <div className="flex bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-xl">
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-400'}`}><List size={16}/></button>
                            <button onClick={() => setViewMode('board')} className={`p-2 rounded-lg transition ${viewMode === 'board' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-400'} ml-1`}><LayoutGrid size={16}/></button>
                        </div>
                        
                        <button 
                            onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("تم نسخ الرابط"); }} 
                            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition border border-gray-100 dark:border-gray-800"
                        >
                            <Share2 size={18}/>
                        </button>
                    </div>
                </div>

                {/* ── Main Expanded Task Area ── */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    
                    {/* Progress Banner */}
                    {deptTasks.length > 0 && (
                        <div className="mb-8 p-4 bg-gradient-to-r from-indigo-600 to-blue-700 rounded-3xl shadow-xl shadow-indigo-500/20 text-white flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">معدل الإنجاز</p>
                                    <h2 className="text-xl font-black">{progress}% مكتمل</h2>
                                </div>
                            </div>
                            <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white transition-all duration-1000" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Acceptance Gate (Minimized) */}
                    {pendingAcceptanceTasks.length > 0 && (
                        <div className="mb-10 animate-fade-in">
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest">طلبات في الانتظار ({pendingAcceptanceTasks.length})</h3>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {pendingAcceptanceTasks.map((task: any) => (
                                    <div key={task.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl flex items-center justify-center">
                                                <Share2 size={18} className="rotate-180" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-gray-800 dark:text-white text-sm">{task.title}</h4>
                                                <p className="text-[10px] text-gray-400 font-bold">من: {DEPARTMENTS.find(d => d.id === task.sourceDept)?.nameAr || task.sourceDept}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleAcceptTask?.(task)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:scale-105 transition">قبول المهمة</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Task Rendering */}
                    <div className="space-y-12">
                        {matrixTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-center">
                                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-[2.5rem] flex items-center justify-center mb-6 text-gray-300">
                                    <LayoutGrid size={32} />
                                </div>
                                <h3 className="text-xl font-black text-gray-700 dark:text-white mb-2">لا توجد مهام حالياً</h3>
                                <p className="text-gray-400 text-sm max-w-xs font-bold leading-relaxed">جرب تغيير الفلتر أو إضافة مهمة جديدة لبدء العمل</p>
                            </div>
                        ) : (
                            viewMode === 'board' ? (
                                <div className="h-[calc(100vh-450px)]">
                                    {renderBoardView(matrixTasks)}
                                </div>
                            ) : (
                                Object.entries(groupedBySource).map(([sourceId, sourceTasks]: [string, any]) => {
                                    const sourceName = sourceId === activeDeptId
                                        ? 'مهامي الخاصة'
                                        : (DEPARTMENTS.find(d => d.id === sourceId)?.nameAr || sourceId);
                                    const sourceInternalCategories = (deptSettings?.customCategories?.[sourceId] || [])
                                        .map((cat: string) => normalizeInternalCategory(cat))
                                        .filter((cat: string) => cat !== "general");
                                    const taskInternalCategories = Array.from(new Set(
                                        (sourceTasks as any[])
                                            .map((t: any) => normalizeInternalCategory(t.internalCategory || ""))
                                            .filter((cat: string) => !!cat && cat !== "general")
                                    )) as string[];
                                    const visibleCategoryKeys = Array.from(new Set([
                                        'general',
                                        ...sourceInternalCategories,
                                        ...taskInternalCategories
                                    ]));

                                    return (
                                        <div key={sourceId} className="animate-fade-in">
                                            <div className="flex items-center gap-3 mb-6 px-2">
                                                <div className="w-1.5 h-6 rounded-full bg-amber-500 shadow-sm shadow-amber-500/40" />
                                                <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-[0.2em]">
                                                    مهام محولة من قسم {sourceName}
                                                </h3>
                                                <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 px-3 py-1 rounded-full font-black">
                                                    {(sourceTasks as any[]).length}
                                                </span>
                                            </div>
                                            <div className="space-y-12">
                                                {visibleCategoryKeys.map((catId: string) => {
                                                    if (selectedInternalCategory !== 'all' && catId !== selectedInternalCategory) return null;
                                                    const catTasks = (sourceTasks as any[]).filter((t: any) => {
                                                        const taskCat = normalizeInternalCategory(t.internalCategory || "");
                                                        if (catId === 'general') return taskCat === "general";
                                                        return taskCat === catId;
                                                    });
                                                    if (catTasks.length === 0) return null;
                                                    const catName = catId === 'general' ? 'عام' : catId;

                                                    return (
                                                        <div key={`${sourceId}-${catId}`} className="animate-fade-in">
                                                            <div className="flex items-center gap-3 mb-4 px-2">
                                                                <div className={`w-1.5 h-5 rounded-full ${catId === 'general' ? 'bg-gray-300' : 'bg-indigo-500'}`} />
                                                                <h4 className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-[0.2em]">
                                                                    {catName}
                                                                </h4>
                                                                <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-black">
                                                                    {catTasks.length}
                                                                </span>
                                                            </div>
                                                            {renderGroupedTasks(catTasks)}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })
                            )
                        )}

                        {/* Create Internal Category UI (Minimized) */}
                        {sourceDeptFilter !== 'self' && sourceDeptFilter !== 'all' && (
                            <div className="mt-12 py-8 border-t border-dashed border-gray-200 dark:border-gray-800 flex justify-center">
                                {isAddingCategory ? (
                                    <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-2 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 animate-slide-up">
                                        <input 
                                            type="text"
                                            value={newInternalCategoryName}
                                            onChange={(e) => setNewInternalCategoryName(e.target.value)}
                                            placeholder="اسم القسم الداخلي الجديد..."
                                            className="bg-transparent border-none px-4 py-2 text-xs font-black outline-none w-64"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && addInternalCategory()}
                                        />
                                        <button onClick={addInternalCategory} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/20">إضافة</button>
                                        <button onClick={() => setIsAddingCategory(false)} className="p-2 text-gray-400 hover:text-red-500"><X size={18}/></button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => setIsAddingCategory(true)}
                                        className="flex items-center gap-2 text-gray-400 hover:text-indigo-600 transition-colors font-black text-xs uppercase tracking-widest"
                                    >
                                        <Plus size={16} /> إضافة قسم تنظيمي داخلي لهذا المصدر
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Floating Action Button ── */}
                <div className="fixed bottom-10 left-10 z-[100]">
                    <button
                        onClick={() => {
                            const defaults: any = {};
                            if (selectedDateFilter) defaults.deadline = selectedDateFilter;
                            if (selectedCategory && selectedCategory !== 'all') defaults.category = selectedCategory;
                            onOpenAddTask?.(defaults);
                        }}
                        className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-[2rem] shadow-2xl shadow-indigo-500/40 flex items-center justify-center hover:scale-110 hover:rotate-3 active:scale-95 transition-all group"
                        title="إضافة مهمة جديدة"
                    >
                        <Plus size={32} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>
            </main>
        </div>
    </>
  );
}
