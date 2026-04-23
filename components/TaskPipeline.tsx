import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Check, Clock, AlertCircle } from 'lucide-react';
import { DEPARTMENTS } from '../utils/constants';

interface TaskPipelineProps {
  task: any;
  currentDeptId: string;
}

const TaskPipeline: React.FC<TaskPipelineProps> = ({ task, currentDeptId }) => {
  // Routing history from the task document
  // If not present, we create a default one based on source/target
  const history = task.routingHistory || [
    { deptId: task.sourceDept, status: 'completed', timestamp: task.created_at },
    { deptId: task.targetDept, status: task.status === 'completed' ? 'completed' : 'active', timestamp: task.forwardedAt }
  ];

  return (
    <div className="w-full py-4 px-2 overflow-x-auto no-scrollbar">
      <div className="flex items-center min-w-max gap-3">
        {history.map((step: any, idx: number) => {
          const dept = DEPARTMENTS.find(d => d.id === step.deptId);
          const isActive = step.deptId === currentDeptId && task.status !== 'completed';
          const isCompleted = step.status === 'completed' || (idx < history.length - 1);
          const isLast = idx === history.length - 1;

          return (
            <React.Fragment key={idx}>
              <div className="flex flex-col items-center gap-1">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-500 ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                      : isCompleted 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {dept ? <dept.icon size={18} /> : <Clock size={18} />}
                  
                  {isCompleted && !isActive && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                      <Check size={8} className="text-white" strokeWidth={4} />
                    </div>
                  )}

                  {isActive && (
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-400 rounded-full border-2 border-white dark:border-slate-900"
                    />
                  )}
                </motion.div>
                <span className={`text-[9px] font-black whitespace-nowrap ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {dept?.nameAr || step.deptId}
                </span>
              </div>
              
              {!isLast && (
                <div className="flex items-center pt-5">
                  <div className={`w-8 h-0.5 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-800'}`} />
                  <ChevronRight size={12} className={isCompleted ? 'text-emerald-500' : 'text-slate-200'} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default TaskPipeline;
