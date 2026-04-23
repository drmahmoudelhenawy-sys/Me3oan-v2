import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Users, 
  LayoutDashboard,
  ArrowUpRight,
  Plus,
  ChevronRight
} from 'lucide-react';
import { DEPARTMENTS } from '../../utils/constants';

interface DashboardOverviewProps {
  userProfile: any;
  tasks: any[];
  onOpenAddTask: () => void;
  setCurrentView: (view: string) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ 
  userProfile, 
  tasks, 
  onOpenAddTask,
  setCurrentView 
}) => {
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const completedToday = tasks.filter(t => t.status === 'completed' && t.completedAt > Date.now() - 86400000).length;
  const highPriority = activeTasks.filter(t => t.priority === 'p1').length;
  
  const stats = [
    { label: 'المهام النشطة', value: activeTasks.length, icon: LayoutDashboard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'أُنجز اليوم', value: completedToday, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'مهام عاجلة', value: highPriority, icon: Zap, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'أعضاء متصلين', value: '12', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-10 pb-20">
      {/* Welcome Section */}
      <section className="relative h-48 md:h-56 rounded-5xl overflow-hidden shadow-premium">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
        
        <div className="relative z-10 h-full flex flex-col md:flex-row items-center justify-between px-10 py-8 text-white">
          <div className="space-y-4 text-center md:text-right">
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10"
            >
              <Zap size={14} className="text-yellow-400" />
              <span className="text-xs font-black uppercase tracking-widest leading-none">نظام معوان الذكي v3.0</span>
            </motion.div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
              أهلاً بك مجدداً، <br/> {userProfile?.displayName || 'زميلنا المعوان'}
            </h1>
            <p className="text-indigo-100/70 font-medium max-w-md">
              لديك اليوم {highPriority} مهام عاجلة تتطلب انتباهك. ابدأ يومك بالمهام الأكثر أهمية.
            </p>
            <button 
              onClick={onOpenAddTask}
              className="mt-4 bg-white text-indigo-700 px-8 py-4 rounded-3xl font-black text-sm shadow-xl hover:scale-105 transition-all flex items-center gap-2 mx-auto md:mx-0"
            >
              <Plus size={18} strokeWidth={3} /> ابدأ مهمة جديدة
            </button>
          </div>
          
          <div className="hidden lg:block relative w-80 h-80">
             {/* Replace with actual 3D Illustration manually if needed, but for now using a premium stylized placeholder */}
             <div className="absolute inset-0 bg-white/5 backdrop-blur-sm border border-white/10 rounded-5xl rotate-6 animate-float" />
             <div className="absolute inset-0 bg-white/5 backdrop-blur-md border border-white/10 rounded-5xl -rotate-3" />
             <div className="absolute inset-0 flex items-center justify-center">
                <LayoutDashboard size={120} className="text-white/20" />
             </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="premium-card p-6 flex flex-col justify-between h-40 group hover:shadow-premium"
          >
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} transition-colors group-hover:bg-indigo-600 group-hover:text-white`}>
                <stat.icon size={24} />
              </div>
              <ArrowUpRight size={20} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
            </div>
            <div>
              <p className="text-3xl font-black text-slate-800 dark:text-white leading-none">{stat.value}</p>
              <p className="text-xs font-bold text-slate-400 mt-1">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Secondary Row: Departments & Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">الأقسام الرئيسية</h3>
            <button onClick={() => setCurrentView('all')} className="text-xs font-black text-indigo-600 hover:underline">عرض الكل</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {DEPARTMENTS.map(dept => (
               <button 
                 key={dept.id}
                 onClick={() => setCurrentView(dept.id)}
                 className="flex items-center gap-4 premium-card hover:bg-slate-50 dark:hover:bg-slate-800/50"
               >
                 <div className={`w-12 h-12 ${dept.bgClass} bg-opacity-20 rounded-2xl flex items-center justify-center ${dept.primaryColor}`}>
                   <dept.icon size={20} />
                 </div>
                 <div className="text-right">
                   <p className="text-sm font-black text-slate-800 dark:text-white">{dept.nameAr}</p>
                   <p className="text-[10px] text-slate-400 font-bold">{tasks.filter(t => t.targetDept === dept.id).length} مهمة</p>
                 </div>
                 <ChevronRight size={18} className="mr-auto text-slate-300" />
               </button>
             ))}
          </div>
        </div>

        <div className="space-y-6">
           <h3 className="text-xl font-black text-slate-800 dark:text-white">الجدول الزمني</h3>
           <div className="premium-card p-6 space-y-4">
              <div className="flex items-center gap-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex flex-col items-center justify-center text-white font-black">
                  <span className="text-[8px] uppercase">APR</span>
                  <span className="text-sm">16</span>
                </div>
                <div className="text-right flex-1">
                  <p className="text-xs font-black text-indigo-600">اجتماع الإدارة العامة</p>
                  <p className="text-[10px] text-slate-400 font-bold">10:00 AM — عبر زووم</p>
                </div>
              </div>
              <p className="text-[10px] text-center text-slate-400 font-bold">لا توجد مواعيد أخرى لليوم</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
