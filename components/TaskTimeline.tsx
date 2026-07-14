import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { CheckCircle2, AlertTriangle, Paperclip, Settings, Calendar, User, Clock } from "lucide-react";

interface TaskTimelineProps {
  taskId: string;
  collName: "tasks" | "requests";
}

export default function TaskTimeline({ taskId, collName }: TaskTimelineProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId || !collName) return;
    const q = query(
      collection(db, collName, taskId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        // Filter only system events
        .filter((m: any) => ['system', 'approval', 'revision', 'delivery'].includes(m.type));
      setEvents(docs);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [taskId, collName]);

  const getEventStyle = (type: string) => {
    switch (type) {
      case 'approval':
        return {
          icon: <CheckCircle2 size={15} />,
          dotBg: 'bg-emerald-500 text-white',
          textClass: 'text-emerald-900 dark:text-emerald-300 font-black',
          cardBg: 'bg-emerald-50/30 border-emerald-100/50 dark:bg-emerald-950/10 dark:border-emerald-900/30'
        };
      case 'revision':
        return {
          icon: <AlertTriangle size={15} />,
          dotBg: 'bg-rose-500 text-white',
          textClass: 'text-rose-900 dark:text-rose-350 font-black',
          cardBg: 'bg-rose-50/30 border-rose-100/50 dark:bg-rose-950/10 dark:border-rose-900/30 animate-pulse'
        };
      case 'delivery':
        return {
          icon: <Paperclip size={15} />,
          dotBg: 'bg-indigo-500 text-white',
          textClass: 'text-indigo-900 dark:text-indigo-300 font-black',
          cardBg: 'bg-indigo-50/30 border-indigo-100/50 dark:bg-indigo-950/10 dark:border-indigo-900/30'
        };
      default:
        return {
          icon: <Settings size={15} />,
          dotBg: 'bg-slate-500 text-white',
          textClass: 'text-slate-700 dark:text-slate-300 font-bold',
          cardBg: 'bg-slate-50/50 border-slate-100 dark:bg-slate-900/20 dark:border-slate-800'
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 font-bold text-xs animate-pulse">
        جاري تحميل سجل النشاط...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16 opacity-30 text-slate-400">
        <Clock size={48} className="mx-auto mb-2" />
        <p className="text-xs font-bold">لا توجد سجلات نشاط مسجلة لهذه المهمة حتى الآن</p>
      </div>
    );
  }

  return (
    <div className="relative text-right px-4" dir="rtl">
      {/* Vertical line connector */}
      <div className="absolute top-1 bottom-1 right-8 w-0.5 bg-slate-200 dark:bg-slate-800"></div>

      <div className="space-y-6">
        {events.map((event) => {
          const style = getEventStyle(event.type);
          return (
            <div key={event.id} className="relative flex items-start gap-6 select-none pr-8">
              
              {/* Event Dot */}
              <div className={`absolute -right-2 top-1.5 w-6.5 h-6.5 rounded-full flex items-center justify-center shadow-sm shrink-0 z-10 ${style.dotBg}`}>
                {style.icon}
              </div>

              {/* Event Card */}
              <div className={`flex-1 p-4 border rounded-2xl shadow-sm ${style.cardBg}`}>
                <p className={`text-xs leading-relaxed ${style.textClass}`}>
                  {event.message}
                </p>

                {/* Event info details footer */}
                <div className="mt-3 flex items-center justify-between text-[9px] text-slate-450 font-bold border-t border-slate-100/40 dark:border-slate-800/40 pt-2">
                  <span className="flex items-center gap-1">
                    <User size={10} />
                    {event.senderName || 'النظام'}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Clock size={10} />
                    {event.createdAt?.toDate ? event.createdAt.toDate().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'الآن'}
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
