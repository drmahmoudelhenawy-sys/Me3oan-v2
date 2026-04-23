import React, { useState, useEffect } from "react";
import { 
  Megaphone, Calendar, Clock, MapPin, Globe, Users, 
  Bell, Plus, Trash2, Edit2, CheckCircle, AlertCircle, 
  Repeat, Send, Video, Map, Info, Save, X
} from "lucide-react";
import { db } from "../services/firebase";
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, query, orderBy, serverTimestamp 
} from "firebase/firestore";
import toast from "react-hot-toast";

interface Meeting {
  id: string;
  topic: string;
  date: string;
  time: string;
  locationType: 'online' | 'offline';
  link?: string;
  details?: string;
  isRecurring: boolean;
  recurrenceDay?: string;
  recurrenceType?: 'weekly' | 'monthly';
  notificationSettings: {
    reminders: number[]; // minutes before
    enabled: boolean;
  };
  createdAt: any;
}

export default function AnnouncementsManager() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<Partial<Meeting>>({
    topic: '',
    date: '',
    time: '',
    locationType: 'online',
    isRecurring: false,
    recurrenceDay: 'Thursday',
    notificationSettings: {
      reminders: [60, 1440], // 1 hour, 1 day
      enabled: true
    }
  });

  useEffect(() => {
    const q = query(collection(db, "management_meetings"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.topic || !formData.time) {
      toast.error("يرجى إكمال البيانات الأساسية");
      return;
    }

    try {
      const data = {
        ...formData,
        createdAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "management_meetings", editingId), data);
        toast.success("تم تحديث الاجتماع");
      } else {
        await addDoc(collection(db, "management_meetings"), data);
        toast.success("تم إضافة الاجتماع بنجاح");
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({
        topic: '',
        date: '',
        time: '',
        locationType: 'online',
        isRecurring: false,
        recurrenceDay: 'Thursday',
        notificationSettings: { reminders: [60, 1440], enabled: true }
      });
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الإعلان؟")) return;
    try {
      await deleteDoc(doc(db, "management_meetings", id));
      toast.success("تم الحذف");
    } catch (e) {
      toast.error("خطأ في الحذف");
    }
  };

  const addReminder = () => {
    const val = prompt("أدخل عدد الدقائق قبل الاجتماع (مثلاً: 60 لساعة، 1440 ليوم):");
    if (val && !isNaN(Number(val))) {
      setFormData(prev => ({
        ...prev,
        notificationSettings: {
          ...prev.notificationSettings!,
          reminders: [...(prev.notificationSettings?.reminders || []), Number(val)]
        }
      }));
    }
  };

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-gray-800 rounded-[2rem]" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
            <Megaphone className="text-indigo-600" /> إدارة الإعلانات والاجتماعات
          </h2>
          <p className="text-xs text-gray-500 mt-1">إنشاء مواعيد الاجتماعات الدورية وتنبيهات القنوات</p>
        </div>
        <button 
          onClick={() => { setIsAdding(true); setEditingId(null); }}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-sm font-black flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition"
        >
          <Plus size={18} /> إنشاء اجتماع جديد
        </button>
      </div>

      {isAdding && (
        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/30 animate-fade-in">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">عنوان الاجتماع / الموضوع</label>
                <input 
                  value={formData.topic} 
                  onChange={e => setFormData({...formData, topic: e.target.value})}
                  className="w-full bg-white dark:bg-gray-800 border-none rounded-xl py-3 px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="مثال: اجتماع مجلس الإدارة الأسبوعي"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">وقت الاجتماع</label>
                <input 
                  type="time"
                  value={formData.time} 
                  onChange={e => setFormData({...formData, time: e.target.value})}
                  className="w-full bg-white dark:bg-gray-800 border-none rounded-xl py-3 px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
               <div className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">نوع الاجتماع</label>
                    <div className="flex gap-2">
                       <button 
                         type="button"
                         onClick={() => setFormData({...formData, locationType: 'online'})}
                         className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${formData.locationType === 'online' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-gray-400'}`}
                       >
                         <Video size={14} className="inline ml-1" /> أونلاين
                       </button>
                       <button 
                         type="button"
                         onClick={() => setFormData({...formData, locationType: 'offline'})}
                         className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${formData.locationType === 'offline' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-gray-400'}`}
                       >
                         <Map size={14} className="inline ml-1" /> أوفلاين
                       </button>
                    </div>
                  </div>
               </div>
               
               <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">اجتماع دوري (متكرر)</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-gray-300">هل يتكرر هذا الاجتماع أسبوعياً؟</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, isRecurring: !formData.isRecurring})}
                    className={`w-12 h-6 rounded-full relative transition ${formData.isRecurring ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isRecurring ? 'right-7' : 'right-1'}`} />
                  </button>
               </div>
            </div>

            {!formData.isRecurring ? (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">تاريخ الاجتماع</label>
                <input 
                  type="date"
                  value={formData.date} 
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full bg-white dark:bg-gray-800 border-none rounded-xl py-3 px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">يوم التكرار</label>
                <select 
                  value={formData.recurrenceDay} 
                  onChange={e => setFormData({...formData, recurrenceDay: e.target.value})}
                  className="w-full bg-white dark:bg-gray-800 border-none rounded-xl py-3 px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                >
                  {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">{formData.locationType === 'online' ? 'رابط الاجتماع' : 'تفاصيل المكان'}</label>
              <input 
                value={formData.locationType === 'online' ? formData.link : formData.details} 
                onChange={e => formData.locationType === 'online' ? setFormData({...formData, link: e.target.value}) : setFormData({...formData, details: e.target.value})}
                className="w-full bg-white dark:bg-gray-800 border-none rounded-xl py-3 px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder={formData.locationType === 'online' ? "https://zoom.us/..." : "العنوان بالتفصيل"}
              />
            </div>

            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 space-y-3">
               <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-indigo-600 flex items-center gap-2">
                    <Bell size={14} /> تنبيهات الاجتماع (قبل الموعد بـ)
                  </h4>
                  <button type="button" onClick={addReminder} className="text-[10px] font-black text-indigo-600 hover:underline">إضافة تنبيه +</button>
               </div>
               <div className="flex flex-wrap gap-2">
                  {formData.notificationSettings?.reminders.map((r, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-2 shadow-sm">
                       {r >= 1440 ? `${r/1440} يوم` : r >= 60 ? `${r/60} ساعة` : `${r} دقيقة`}
                       <button type="button" onClick={() => {
                         const n = [...formData.notificationSettings!.reminders];
                         n.splice(i, 1);
                         setFormData({...formData, notificationSettings: {...formData.notificationSettings!, reminders: n}});
                       }} className="text-rose-500"><X size={10}/></button>
                    </div>
                  ))}
               </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 dark:shadow-none transition hover:bg-indigo-700">حفظ الإعلان</button>
              <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-gray-400 font-black rounded-2xl text-sm transition">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12"><div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Calendar className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-sm font-bold text-slate-400">لا توجد اجتماعات مجدولة حالياً</p>
          </div>
        ) : (
          meetings.map(meeting => (
            <div key={meeting.id} className="bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-5 rounded-3xl shadow-sm hover:shadow-md transition group">
              <div className="flex justify-between items-start">
                 <div className="flex gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${meeting.isRecurring ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                       {meeting.isRecurring ? <Repeat size={24} /> : <Calendar size={24} />}
                    </div>
                    <div className="space-y-1">
                       <h4 className="font-black text-slate-800 dark:text-white">{meeting.topic}</h4>
                       <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
                          <span className="flex items-center gap-1"><Clock size={12} /> {meeting.time}</span>
                          <span className="flex items-center gap-1">
                             {meeting.isRecurring ? <><Repeat size={12} /> كل {meeting.recurrenceDay}</> : <><Calendar size={12} /> {meeting.date}</>}
                          </span>
                          <span className="flex items-center gap-1">
                             {meeting.locationType === 'online' ? <><Video size={12} /> أونلاين</> : <><MapPin size={12} /> أوفلاين</>}
                          </span>
                       </div>
                    </div>
                 </div>
                 <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { setFormData(meeting); setEditingId(meeting.id); setIsAdding(true); }} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-gray-400 rounded-xl hover:text-indigo-600 transition"><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(meeting.id)} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-gray-400 rounded-xl hover:text-rose-600 transition"><Trash2 size={16}/></button>
                 </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-700/50">
                 <div className="flex gap-2">
                    {meeting.notificationSettings.reminders.map((r, i) => (
                      <span key={i} className="text-[9px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-2 py-1 rounded-lg font-black">
                        {r >= 1440 ? `${r/1440}ي` : r >= 60 ? `${r/60}س` : `${r}د`}
                      </span>
                    ))}
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-2 py-1 rounded-lg font-black italic">إشعارات مفعلة</span>
                 </div>
                 <button className="text-[10px] font-black text-indigo-600 flex items-center gap-1 hover:underline">
                    <Send size={12} /> إرسال إعلان الآن
                 </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
