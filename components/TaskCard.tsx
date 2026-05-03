import React, { useState, useRef } from "react";
import { CheckCircle, Trash2, Share2, Calendar, Paperclip, Users, FolderEdit, Plus, PenTool, Hash, Circle, Clock } from "lucide-react";
import { PRIORITIES, DEPARTMENTS } from "../utils/constants";
import { TRANSLATIONS } from "../utils/translations";

const TaskCard: React.FC<any> = ({ task, isIncoming, onToggle, onDelete, onForward, onOpen, onUpdateCategory, availableCategories, onUpdateInternalCategory, availableInternalCategories, isEducational, onForwardToArt }) => {
  const [showForwardMenu, setShowForwardMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const buttonRef = useRef<HTMLDivElement>(null);
  const [openUpwards, setOpenUpwards] = useState(false);
  
  const priorityConfig = PRIORITIES[task.priority] || PRIORITIES.normal;
  const PriorityIcon = priorityConfig.icon;
  const t = TRANSLATIONS['ar'];
  const lang = 'ar';
  
  // Get source department name if incoming
  let sourceLabel = "";
  let isHRTask = false;

  if (isIncoming) {
      if (task.sourceDept === 'hr' && task.targetDept) {
          sourceLabel = t.hrAssignment;
          isHRTask = true;
      } else if (task.forwardedFrom || task.sourceDept) {
          const deptId = task.forwardedFrom || task.sourceDept;
          const dept = DEPARTMENTS.find(d => d.id === deptId);
          const deptName = dept?.nameAr ? dept.nameAr : dept?.name;
          sourceLabel = `${t.from} ${deptName}`;
      } else {
          sourceLabel = t.incoming;
      }
  }

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'p1': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'p2': return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'p3': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default: return 'text-gray-500 bg-gray-50 dark:bg-gray-800';
    }
  };

  const safeRender = (val: any) => {
      if (typeof val === 'string') return val;
      if (val === null || val === undefined) return "";
      return JSON.stringify(val);
  }

  const closeMenus = () => {
    setShowForwardMenu(false);
    setShowCategoryMenu(false);
  };

  const checkPosition = () => {
    if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setOpenUpwards(spaceBelow < 250); // If less than 250px below, open upwards
    }
  };

  const handleToggleCategory = (e: any) => {
    e.stopPropagation();
    checkPosition();
    setShowCategoryMenu(!showCategoryMenu);
    setShowForwardMenu(false);
  };

  const handleToggleForward = (e: any) => {
    e.stopPropagation();
    checkPosition();
    setShowForwardMenu(!showForwardMenu);
    setShowCategoryMenu(false);
  };

  return (
    <>
      {/* Click-outside overlay — only rendered when a menu is open */}
      {(showForwardMenu || showCategoryMenu) && (
        <div className="fixed inset-0 z-40" onClick={closeMenus} />
      )}
      <div 
          onClick={onOpen} 
        className={`group relative bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer ${task.status === "completed" ? "opacity-60" : ""}`}
    >
      <div className="flex gap-4">
        {/* Status Checkbox */}
        <button 
            onClick={(e) => { e.stopPropagation(); onToggle(e); }}
            className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600 text-transparent hover:border-green-500'}`}
        >
            <CheckCircle size={12} fill="currentColor" className={task.status === 'completed' ? 'opacity-100' : 'opacity-0'} />
        </button>

        <div className="flex-1 min-w-0">
            {/* Header: Title & Date */}
            <div className="flex justify-between items-start mb-1">
                <h4 className={`text-base font-bold text-gray-900 dark:text-gray-100 leading-snug ${task.status === "completed" ? "line-through text-gray-500" : ""}`}>
                    {safeRender(task.title)}
                </h4>
                {task.deadline && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${new Date(task.deadline) < new Date() && task.status !== 'completed' ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-gray-500 bg-gray-50 dark:bg-gray-700/50'}`} title="الموعد النهائي">
                        <Calendar size={10} />
                        {task.deadline}
                    </span>
                )}
                {task.executionDate && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 text-green-600 bg-green-50 dark:bg-green-900/20" title="تاريخ التنفيذ">
                        <Clock size={10} />
                        {task.executionDate}
                    </span>
                )}
            </div>

            {/* Details */}
            {task.details && (
                <p className={`text-xs mb-3 line-clamp-2 leading-relaxed ${task.status === "completed" ? "text-gray-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {typeof task.details === 'string' ? task.details : JSON.stringify(task.details)}
                </p>
            )}

            {/* Tags & Metadata */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
                {/* Priority Badge */}
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${getPriorityColor()}`}>
                    <PriorityIcon size={10} />
                    {priorityConfig.label}
                </span>

                {/* Category */}
                {task.category && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 flex items-center gap-1">
                        <Hash size={10} />
                        {task.category}
                    </span>
                )}

                {/* Performer */}
                {task.performerName && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300 flex items-center gap-1">
                        <Users size={10} />
                        {task.performerName}
                    </span>
                )}

                {/* Incoming Source */}
                {isIncoming && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${isHRTask ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'} dark:bg-opacity-20`}>
                        {isHRTask ? <Users size={10}/> : <Share2 size={10} className={lang==='ar'?'':'rotate-180'}/>} 
                        {sourceLabel}
                    </span>
                )}
            </div>

            {/* Selected Logos */}
            {task.selectedLogos && task.selectedLogos.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-50 dark:border-gray-700/50">
                    {task.selectedLogos.map((logo: any, idx: number) => (
                        <div key={idx} className="relative group/logo">
                            <img 
                                src={logo.url} 
                                alt={logo.name} 
                                className="w-6 h-6 object-contain rounded-md bg-white border border-gray-100 p-0.5" 
                                title={logo.name}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Hover Actions (Absolute) */}
      <div 
        ref={buttonRef}
        className={`absolute top-2 ${lang==='ar'?'left-2':'right-2'} flex gap-1 transition-all transform z-50
        ${(showForwardMenu || showCategoryMenu) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'}
      `}>
         <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-xl border border-gray-100 dark:border-gray-700 rounded-xl flex p-1 scale-90 group-hover:scale-100 transition-transform">
            <button onClick={(e) => {e.stopPropagation(); onDelete(e)}} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="حذف"><Trash2 size={14} /></button>
            
            {isEducational && onForwardToArt && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        const note = prompt("ملاحظات للإخراج الفني (اختياري):");
                        if (note !== null) {
                            onForwardToArt(task, note);
                        }
                    }}
                    className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                    title="تحويل للإخراج الفني"
                >
                    <PenTool size={14} />
                </button>
            )}

            <div className="relative">
                <button onClick={handleToggleCategory} className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors" title="تغيير القسم"><FolderEdit size={14} /></button>
                {showCategoryMenu && (
                    <div className={`absolute ${openUpwards ? 'bottom-full mb-3' : 'top-full mt-3'} w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-fade-in-up ${lang==='ar'?'left-0':'right-0'}`}>
                        {/* Invisible bridge to catch mouse transition */}
                        <div className={`absolute ${openUpwards ? '-bottom-4 h-4' : '-top-4 h-4'} left-0 right-0`} />
                        <div className="bg-gray-50 dark:bg-gray-900 px-3 py-2 border-b dark:border-gray-700">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">القسم الداخلي للمهمة</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                            <button onClick={(e) => { e.stopPropagation(); if(onUpdateInternalCategory) onUpdateInternalCategory("general"); setShowCategoryMenu(false); }} className="w-full text-start px-3 py-2 text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-800 dark:text-gray-200 flex items-center gap-2 transition-colors mb-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                <span className="font-bold">عام</span>
                            </button>
                            {availableInternalCategories?.map((cat: string) => (
                                <button key={cat} onClick={(e) => { e.stopPropagation(); if(onUpdateInternalCategory) onUpdateInternalCategory(cat); setShowCategoryMenu(false); }} className="w-full text-start px-3 py-2 text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-800 dark:text-gray-200 flex items-center gap-2 transition-colors mb-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                    <span className="font-bold">{cat}</span>
                                </button>
                            ))}
                            <div className="p-2 border-t dark:border-gray-700 mt-1">
                                <div className="flex gap-1">
                                    <input 
                                        className="flex-1 p-1.5 text-[10px] rounded border dark:bg-gray-900 dark:text-white dark:border-gray-700 outline-none focus:border-indigo-500" 
                                        placeholder="قسم جديد..." 
                                        value={newCatInput}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setNewCatInput(e.target.value)}
                                    />
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (newCatInput.trim() && onUpdateInternalCategory) {
                                                onUpdateInternalCategory(newCatInput.trim());
                                                setNewCatInput("");
                                                setShowCategoryMenu(false);
                                            }
                                        }}
                                        className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                    >
                                        <Plus size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="relative">
                <button onClick={handleToggleForward} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors" title="توجيه"><Share2 size={14} /></button>
                {showForwardMenu && (
                    <div className={`absolute ${openUpwards ? 'bottom-full mb-3' : 'top-full mt-3'} w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-fade-in-up ${lang==='ar'?'left-0':'right-0'}`}>
                        {/* Invisible bridge */}
                        <div className={`absolute ${openUpwards ? '-bottom-4 h-4' : '-top-4 h-4'} left-0 right-0`} />
                        <div className="bg-gray-50 dark:bg-gray-900 px-3 py-2 border-b dark:border-gray-700">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t.shareCopy}</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                            {DEPARTMENTS.filter(d => d.id !== task.sourceDept).map(dept => (
                                <button key={dept.id} onClick={(e) => { e.stopPropagation(); if(onForward) onForward(dept.id); setShowForwardMenu(false); }} className="w-full text-start px-3 py-2 text-xs rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-800 dark:text-gray-200 flex items-center gap-2 transition-colors mb-0.5">
                                    <dept.icon size={14} className={dept.primaryColor}/> 
                                    <span className="font-bold">{dept.nameAr ? dept.nameAr : dept.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
         </div>
      </div>
    </div>
    </>
  );
};

export default TaskCard;
