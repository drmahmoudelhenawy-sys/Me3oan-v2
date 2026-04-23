import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart2, 
  CheckCircle2, 
  MessageSquare, 
  Calendar, 
  FileText, 
  ShieldCheck, 
  Users, 
  Activity, 
  ChevronRight, 
  ChevronLeft,
  Settings,
  LogOut,
  Home,
  Zap,
  Layers,
  Bot,
  Megaphone,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';
import { DEPARTMENTS } from '../../utils/constants';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  userProfile: any;
  departments: typeof DEPARTMENTS;
  onLogout: () => void;
  onOpenSettings: () => void;
  isSuperAdmin: boolean;
  showMyDeptOnly: boolean;
  setShowMyDeptOnly: (val: boolean) => void;
  forwardedActivities?: any[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  setIsOpen, 
  currentView, 
  setCurrentView, 
  userProfile, 
  departments,
  onLogout,
  onOpenSettings,
  isSuperAdmin,
  showMyDeptOnly,
  setShowMyDeptOnly,
  forwardedActivities = []
}) => {
  const menuItems = [
    { id: 'overview', label: 'الرئيسية', icon: Home },
    { id: 'tasks', label: 'المهمات', icon: CheckCircle2 },
    { id: 'chat', label: 'المحادثات', icon: MessageSquare },
    { id: 'calendar', label: 'التقويم', icon: Calendar },
    { id: 'reports', label: 'التقارير', icon: FileText },
  ];

  const adminItems = [
    { id: 'admin', label: 'الإدارة العامة', icon: ShieldCheck },
    { id: 'user_management', label: 'إدارة المستخدمين', icon: Users },
    { id: 'waman_ahyaaha', label: 'إدارة ومن أحياها', icon: Activity },
    { id: 'admin_sheet', label: 'شيت الإدارة العامة', icon: TableIcon },
    { id: 'bot_section', label: 'قسم البوت', icon: Bot },
    { id: 'announcements', label: 'الإعلانات والاجتماعات', icon: Megaphone },
  ];

  return (
    <motion.div 
      animate={{ width: isOpen ? 280 : 88 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden md:flex flex-col h-screen sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-l border-gray-200 dark:border-slate-800 z-50 overflow-hidden"
    >
      {/* Logo Section */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden">
            <img src="/logo.svg" alt="Me3oan" className="w-8 h-8 object-contain" onError={(e: any) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
            <Zap className="text-white hidden" size={22} />
          </div>
          <AnimatePresence>
            {isOpen && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-black text-xl tracking-tight text-slate-800 dark:text-white"
              >
                <span className="text-indigo-600">Me3oan</span> Task
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
        >
          {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-4 py-6 space-y-8 overflow-y-auto no-scrollbar">
        <div className="space-y-1">
          {isOpen && <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">القائمة الرئيسية</p>}
          {menuItems.map((item) => (
            <SidebarItem 
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={currentView === item.id}
              isOpen={isOpen}
              onClick={() => setCurrentView(item.id)}
            />
          ))}
        </div>

        {isSuperAdmin && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-4 mb-2">
              {isOpen && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الأقسام</p>}
              {isOpen && (
                <button 
                  onClick={() => setShowMyDeptOnly(!showMyDeptOnly)}
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-lg transition-all ${showMyDeptOnly ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600'}`}
                >
                  {showMyDeptOnly ? 'عرض الكل' : 'قسمي فقط'}
                </button>
              )}
            </div>
            {departments.filter(d => !showMyDeptOnly || d.id === userProfile?.departmentId).map((dept) => (
              <SidebarItem 
                key={dept.id}
                icon={dept.icon}
                label={dept.nameAr || dept.name}
                active={currentView === dept.id}
                isOpen={isOpen}
                onClick={() => setCurrentView(dept.id)}
                color={dept.primaryColor}
              />
            ))}
          </div>
        )}

        {(isSuperAdmin || userProfile?.role === 'admin' || userProfile?.canViewAdminTable) && (
          <div className="space-y-1">
            {isOpen && <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">الإدارة</p>}
            {adminItems.map((item) => (
              <SidebarItem 
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={currentView === item.id}
                isOpen={isOpen}
                onClick={() => setCurrentView(item.id)}
              />
            ))}
          </div>
        )}

        {/* Recent Activities Section (Forwarded Tasks) */}
        {isOpen && (
           <div className="space-y-4 px-4 pt-4 border-t border-gray-100 dark:border-slate-800/50">
              <div className="flex items-center gap-2 text-slate-400">
                <Activity size={14} />
                <p className="text-[10px] font-black uppercase tracking-widest">الأنشطة الأخيرة (المهام المحولة)</p>
              </div>
              <div className="space-y-3">
                {forwardedActivities.length > 0 ? (
                  forwardedActivities.map((task: any) => {
                    const sourceDept = DEPARTMENTS.find(d => d.id === task.sourceDept)?.nameAr || task.sourceDept;
                    const targetDept = DEPARTMENTS.find(d => d.id === task.targetDept)?.nameAr || task.targetDept;
                    const isCompleted = task.status === 'completed' || task.linkedTaskStatus === 'completed';
                    
                    return (
                      <div key={task.id} className="group relative">
                        <div className={`text-[10px] ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-600 dark:text-slate-300'} font-bold`}>
                           📦 قسم {targetDept}: {task.title}
                           {isCompleted && <span className="text-[8px] bg-green-100 text-green-600 px-1 rounded mr-1">تم الإنجاز</span>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[10px] text-slate-400 font-bold italic">لا توجد مهام محولة مؤخراً</p>
                )}
              </div>
           </div>
        )}
      </div>

      {/* Footer / Profile Section */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-800/50 space-y-2">
        <SidebarItem 
          icon={Settings} 
          label="الإعدادات" 
          isOpen={isOpen} 
          onClick={onOpenSettings} 
        />
        <SidebarItem 
          icon={LogOut} 
          label="تسجيل الخروج" 
          isOpen={isOpen} 
          onClick={onLogout} 
          danger
        />
        
        {isOpen && (
           <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center font-black text-indigo-600">
                {userProfile?.displayName ? userProfile.displayName.charAt(0) : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-800 dark:text-white truncate">{userProfile?.displayName}</p>
                <p className="text-[10px] text-slate-400 truncate font-bold">{userProfile?.role}</p>
              </div>
           </div>
        )}
      </div>
    </motion.div>
  );
};

interface SidebarItemProps {
  icon: any;
  label: string;
  active?: boolean;
  isOpen: boolean;
  onClick: () => void;
  color?: string;
  danger?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, active, isOpen, onClick, color, danger }) => {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all relative group ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
          : danger 
            ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20' 
            : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
      }`}
    >
      <div className={`shrink-0 ${active ? 'text-white' : color ? color : ''}`}>
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className={`font-bold text-sm whitespace-nowrap ${active ? 'font-black' : ''}`}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {!isOpen && (
        <div className="absolute right-full mr-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
          {label}
        </div>
      )}
    </button>
  );
};

export default Sidebar;
