import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Search, Zap } from 'lucide-react';

interface TopHeaderProps {
  userProfile: any;
  progress: number;
  onOpenNotifications: () => void;
  onSearch: () => void;
  nextMeeting?: any;
}

const TopHeader: React.FC<TopHeaderProps> = ({ 
  userProfile, 
  progress, 
  onOpenNotifications,
  onSearch,
  nextMeeting
}) => {
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 18) return 'مساء الخير';
    return 'طاب مساؤك';
  };

  return (
    <div className="md:hidden pt-2 pb-2 px-4 relative overflow-hidden bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
      <div className="flex justify-between items-center mb-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <UserAvatar name={userProfile?.displayName} size="sm" />
          </div>
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{greeting()} يا معوان</p>
            <h1 className="text-sm font-black text-slate-800 dark:text-white leading-tight">
              {userProfile?.displayName?.split(' ')[0] || 'مستخدم'}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onSearch}
            className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400"
          >
            <Search size={16} />
          </button>
          <button 
            onClick={onOpenNotifications}
            className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 relative"
          >
            <Bell size={16} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800" />
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg p-2 relative overflow-hidden shadow-lg shadow-indigo-600/10">
        <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Zap size={10} className="text-indigo-200" />
              <p className="text-[8px] font-black text-indigo-100 uppercase tracking-widest">
                {nextMeeting ? `الاجتماع القادم: ${nextMeeting.topic}` : 'معدل الإنجاز اليومي'}
              </p>
            </div>
            <div className="flex items-baseline gap-1">
               <p className="text-sm font-black text-white">{nextMeeting ? nextMeeting.time : `${progress}%`}</p>
               <p className="text-[8px] text-indigo-200 font-bold">
                 {nextMeeting ? (nextMeeting.isRecurring ? `كل ${nextMeeting.recurrenceDay}` : nextMeeting.date) : 'إنجاز اليوم'}
               </p>
            </div>
          </div>
          <div className="relative w-8 h-8">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path
                className="text-white/10 stroke-current"
                strokeWidth="4"
                strokeDasharray="100, 100"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-white stroke-current"
                strokeWidth="4"
                strokeDasharray={`${progress}, 100`}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserAvatar = ({ name, size = 'md' }: { name?: string, size?: 'sm' | 'md' }) => {
  if (!name) return <Zap size={size === 'sm' ? 16 : 24} className="text-white" />;
  return <span className={`text-white font-black ${size === 'sm' ? 'text-sm' : 'text-lg'}`}>{name.charAt(0)}</span>;
};

export default TopHeader;
