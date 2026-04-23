import React from 'react';
import { motion } from 'framer-motion';
import { 
  Home, 
  CheckCircle2, 
  Plus, 
  MessageSquare, 
  User,
  Settings,
  Bell
} from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onQuickAdd: () => void;
  hasNotifications?: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({ 
  currentView, 
  setCurrentView, 
  onQuickAdd,
  hasNotifications 
}) => {
  const tabs = [
    { id: 'overview', icon: Home, label: 'الرئيسية' },
    { id: 'tasks', icon: CheckCircle2, label: 'المهام' },
    { id: 'fab', icon: Plus, label: 'إضافة', isFab: true },
    { id: 'chat', icon: MessageSquare, label: 'الدردشة', badge: hasNotifications },
    { id: 'user_profile', icon: Settings, label: 'الإعدادات' },
  ];

  return (
    <div className="md:hidden fixed bottom-6 left-6 right-6 z-[100]">
      <div className="glass-dark rounded-3xl p-2 flex items-center justify-between relative shadow-2xl">
        {tabs.map((tab) => {
          if (tab.isFab) {
            return (
              <button 
                key={tab.id}
                onClick={onQuickAdd}
                className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 -translate-y-8 absolute left-1/2 -translate-x-1/2 border-4 border-slate-900"
              >
                <Plus size={28} strokeWidth={3} />
              </button>
            );
          }

          const isActive = currentView === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setCurrentView(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 relative transition-all duration-300 ${
                isActive ? 'text-white' : 'text-slate-400 opacity-60'
              }`}
            >
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -top-1 w-1 h-1 bg-white rounded-full"
                />
              )}
              <div className="relative">
                <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {tab.badge && (
                   <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900" />
                )}
              </div>
              <span className="text-[9px] font-black mt-1 uppercase tracking-widest">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
