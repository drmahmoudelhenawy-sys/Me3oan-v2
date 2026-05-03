import React, { useState, useEffect } from 'react';
import { 
    ChevronLeft, ChevronRight, Calendar as CalendarIcon, List as ListIcon, 
    Plus, Clock, MapPin, Video, CheckCircle, BellRing, X, MoreHorizontal, 
    Filter, Search, Trash2, Edit2, Send, Users, Lock, Link, Info, AlertCircle
} from 'lucide-react';
import { db } from '../services/firebase';
import { DEPARTMENTS } from '../utils/constants';
import { 
    collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, 
    Timestamp, where, getDocs 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

interface CalendarEvent {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    time?: string;
    type: 'task' | 'meeting';
    deptId?: string;
    status?: string;
    priority?: string;
    location?: string;
    link?: string;
    details?: string;
    isPrivate?: boolean;
    createdBy: string;
    collectionName: 'tasks' | 'management_meetings';
    attendees?: string[];
    apologies?: string[];
    isRecurring?: boolean;
    recurrenceDay?: string;
    recurrenceType?: 'daily' | 'weekly' | 'monthly';
    recurrenceDayOfMonth?: string;
}

interface CalendarSystemProps {
    user: any;
    telegramConfig: any;
    onSendTelegram: (chatId: string, message: string) => void;
}

const CalendarSystem: React.FC<CalendarSystemProps> = ({ user, telegramConfig, onSendTelegram }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'task' | 'meeting'>('all');
    const [newEvent, setNewEvent] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        type: 'meeting' as 'meeting' | 'task',
        details: '',
        isPrivate: false,
        link: '',
        location: ''
    });

    useEffect(() => {
        const qTasks = query(collection(db, "tasks"));
        const unsubTasks = onSnapshot(qTasks, (snap) => {
            const taskEvents: CalendarEvent[] = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    title: data.title,
                    date: data.deadline,
                    type: 'task' as 'task',
                    deptId: data.sourceDept,
                    status: data.status,
                    priority: data.priority,
                    details: data.details,
                    isPrivate: data.isPrivate || false,
                    createdBy: data.created_by,
                    collectionName: 'tasks' as 'tasks'
                };
            }).filter(e => e.date);

            const qMeetings = query(collection(db, "management_meetings"));
            const unsubMeetings = onSnapshot(qMeetings, (mSnap) => {
                const meetingEvents: CalendarEvent[] = [];
                mSnap.docs.forEach(d => {
                    const data = d.data();
                    const baseEvent = {
                        id: d.id,
                        title: data.topic,
                        time: data.time,
                        type: 'meeting' as 'meeting',
                        location: data.details,
                        link: data.link,
                        details: data.details,
                        isPrivate: data.isPrivate || false,
                        createdBy: data.created_by, 
                        collectionName: 'management_meetings' as 'management_meetings',
                        attendees: data.attendees || [],
                        apologies: data.apologies || [],
                        isRecurring: data.isRecurring || false,
                        recurrenceDay: data.recurrenceDay || null,
                        recurrenceType: data.recurrenceType || 'weekly',
                        recurrenceDayOfMonth: data.recurrenceDayOfMonth || '1'
                    };

                    if (data.date) {
                        meetingEvents.push({ ...baseEvent, date: data.date });
                    } else if (data.isRecurring) {
                        meetingEvents.push({ ...baseEvent, date: '' });
                    }

                    if (data.isRecurring && data.recurrenceDay) {
                        // Generate instances for the past 30 days and next 90 days
                        const startDate = new Date();
                        startDate.setDate(startDate.getDate() - 30);
                        const daysMap: Record<string, number> = {
                            'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
                            'Thursday': 4, 'Friday': 5, 'Saturday': 6
                        };
                        const targetDay = daysMap[data.recurrenceDay];
                        
                        for (let i = 0; i < 120; i++) {
                            const date = new Date(startDate);
                            date.setDate(startDate.getDate() + i);
                            if (date.getDay() === targetDay) {
                                meetingEvents.push({
                                    ...baseEvent,
                                    date: date.toISOString().split('T')[0]
                                });
                            }
                        }
                    } else if (data.date) {
                        meetingEvents.push({
                            ...baseEvent,
                            date: data.date
                        });
                    }
                });
                const allEvents = [...taskEvents, ...meetingEvents].filter(e => !e.isPrivate || (e.isPrivate && e.createdBy === user.email));
                setEvents(allEvents);
            });

            return () => {
                unsubMeetings();
            };
        });

        return () => {
            unsubTasks();
        };
    }, [user.email]);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        // Pad start
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        // Month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleAddEvent = async () => {
        if (!newEvent.title || !newEvent.date) return;
        
        try {
            if (newEvent.type === 'meeting') {
                await addDoc(collection(db, "management_meetings"), {
                    topic: newEvent.title,
                    date: newEvent.date,
                    time: newEvent.time,
                    details: newEvent.details,
                    link: newEvent.link,
                    isPrivate: newEvent.isPrivate,
                    created_by: user.email,
                    created_at: Timestamp.now(),
                    attendees: [],
                    apologies: []
                });
            } else {
                await addDoc(collection(db, "tasks"), {
                    title: newEvent.title,
                    deadline: newEvent.date,
                    details: newEvent.details,
                    isPrivate: newEvent.isPrivate,
                    created_by: user.email,
                    status: 'todo',
                    priority: 'p4',
                    created_at: Timestamp.now()
                });
            }
            setIsAddModalOpen(false);
            setNewEvent({
                title: '',
                date: new Date().toISOString().split('T')[0],
                time: '10:00',
                type: 'meeting',
                details: '',
                isPrivate: false,
                link: '',
                location: ''
            });
        } catch (error) {
            console.error("Error adding event:", error);
        }
    };

    const handleDeleteEvent = async (id: string, collectionName: string) => {
        if (!window.confirm("هل أنت متأكد من حذف هذا الحدث؟")) return;
        try {
            await deleteDoc(doc(db, collectionName, id));
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Error deleting event:", error);
        }
    };

    const openEditModal = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setIsEditModalOpen(true);
    };

    const initiateReminder = (event: CalendarEvent) => {
        const msg = `🔔 <b>تذكير بحدث</b>\n\n📌 <b>العنوان:</b> ${event.title}\n📅 <b>التاريخ:</b> ${event.date}\n⏰ <b>الوقت:</b> ${event.time || 'غير محدد'}\n📝 <b>التفاصيل:</b> ${event.details || 'لا يوجد'}`;
        
        const targetChatId = prompt("أدخل Chat ID للمستلم (أو اتركه فارغاً للإرسال للمسؤولين):");
        if (targetChatId) {
            onSendTelegram(targetChatId, msg);
            alert("تم إرسال التذكير بنجاح!");
        } else if (telegramConfig?.generalContacts) {
            // Send to HR/Admin by default
            telegramConfig.generalContacts.forEach((dept: any) => {
                dept.contacts.forEach((contact: any) => {
                    if (contact.role === 'hr' || contact.role === 'super_admin') {
                        onSendTelegram(contact.chatId, msg);
                    }
                });
            });
            alert("تم إرسال التذكير للمسؤولين!");
        }
    };

    const renderEventBadge = (event: CalendarEvent) => (
        <div 
            key={event.id}
            onClick={(e) => { e.stopPropagation(); openEditModal(event); }}
            className={`text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer transition-all hover:scale-105 ${
                event.type === 'task' 
                ? 'bg-indigo-100 text-indigo-700 border-r-2 border-indigo-500' 
                : 'bg-rose-100 text-rose-700 border-r-2 border-rose-500'
            }`}
        >
            {event.time && <span className="font-bold ml-1">{event.time}</span>}
            {event.title}
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-600 rounded-xl text-white">
                        <CalendarIcon size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-800 dark:text-white">نظام المواعيد</h1>
                        <p className="text-xs text-gray-400 font-bold">إدارة المهام والاجتماعات</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                    <button 
                        onClick={() => setViewMode('month')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'month' ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <CalendarIcon size={16} /> التقويم
                    </button>
                    <button 
                        onClick={() => setViewMode('agenda')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'agenda' ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <ListIcon size={16} /> الأجندة
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <select 
                        value={filterType}
                        onChange={(e: any) => setFilterType(e.target.value)}
                        className="bg-gray-100 dark:bg-gray-700 border-none rounded-xl px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">الكل</option>
                        <option value="task">المهام</option>
                        <option value="meeting">الاجتماعات</option>
                    </select>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                        <Plus size={18} /> إضافة موعد
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-col lg:flex-row gap-6 h-full animate-fade-in-up relative">
                    {viewMode === 'month' ? (
                        <div className="flex-1 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
                                <h2 className="text-lg font-black text-gray-800 dark:text-white">
                                    {currentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500"><ChevronRight size={20}/></button>
                                    <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-bold bg-gray-50 dark:bg-gray-700 text-gray-500 rounded-lg">اليوم</button>
                                    <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500"><ChevronLeft size={20}/></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-7 border-b border-gray-50 dark:border-gray-700">
                                {['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map(day => (
                                    <div key={day} className="py-3 text-center text-xs font-black text-gray-400 uppercase tracking-wider">{day}</div>
                                ))}
                            </div>
                            <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                                {getDaysInMonth(currentDate).map((day, idx) => {
                                    if (!day) return <div key={`empty-${idx}`} className="border-b border-l border-gray-50 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/10"></div>;
                                    
                                    const dateStr = day.toISOString().split('T')[0];
                                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                                    const dayName = day.toLocaleDateString('en-US', { weekday: 'long' });
                                    const dayEvents = events.filter(e => {
                                        if (filterType !== 'all' && e.type !== filterType) return false;
                                        if (e.date === dateStr) return true;
                                        if (e.isRecurring) {
                                            if (e.recurrenceType === 'daily') return true;
                                            if (e.recurrenceType === 'weekly' && e.recurrenceDay === dayName) return true;
                                            if (e.recurrenceType === 'monthly' && e.recurrenceDayOfMonth === day.getDate().toString()) return true;
                                        }
                                        return false;
                                    });

                                    return (
                                        <div key={dateStr} className={`border-b border-l border-gray-50 dark:border-gray-700 p-2 min-h-[100px] hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group flex flex-col ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-sm font-bold ${isToday ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-full' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                                    {day.getDate()}
                                                </span>
                                            </div>
                                            <div className="flex-1 overflow-hidden space-y-1">{dayEvents.map(evt => renderEventBadge(evt))}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 max-w-3xl mx-auto space-y-6">
                            {(() => {
                                const filteredEvents = events.filter(e => filterType === 'all' || e.type === filterType);
                                const grouped = filteredEvents.reduce((acc: any, evt) => {
                                    (acc[evt.date] = acc[evt.date] || []).push(evt);
                                    return acc;
                                }, {});
                                const sortedDates = Object.keys(grouped).sort();

                                if (sortedDates.length === 0) {
                                    return <div className="text-center py-20 text-gray-400">لا توجد أحداث قادمة</div>;
                                }

                                return sortedDates.map(dateKey => (
                                    <div key={dateKey} className="flex gap-6">
                                        <div className="w-24 text-center shrink-0 pt-2">
                                            <div className="text-xs font-bold text-gray-400 uppercase">
                                                {new Date(dateKey).toLocaleDateString('ar-EG', { weekday: 'short' })}
                                            </div>
                                            <div className="text-2xl font-black text-gray-800 dark:text-white">
                                                {new Date(dateKey).getDate()}
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-3 border-r-2 border-gray-100 dark:border-gray-700 pr-6 relative pb-6">
                                            <div className="absolute -right-[7px] top-3 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                                            {grouped[dateKey].map((evt: CalendarEvent) => (
                                                <div key={evt.id} onClick={() => openEditModal(evt)} className="bg-white dark:bg-gray-700/50 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600 flex flex-col gap-2 cursor-pointer hover:shadow-md transition group">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`p-3 rounded-xl ${evt.type === 'task' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600'}`}>
                                                            {evt.type === 'task' ? <CheckCircle size={20}/> : <Video size={20}/>}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between">
                                                                <h4 className="font-bold text-gray-800 dark:text-white">{evt.title}</h4>
                                                                {evt.isPrivate && <Lock size={14} className="text-gray-400"/>}
                                                            </div>
                                                            {evt.deptId && (
                                                                <span className="text-[10px] bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 px-2 py-0.5 rounded-full mt-1 inline-block">
                                                                    {DEPARTMENTS.find(d => d.id === evt.deptId)?.nameAr || evt.deptId}
                                                                </span>
                                                            )}
                                                            {evt.details && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{evt.details}</p>}
                                                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                                                                {evt.time && <span className="flex items-center gap-1"><Clock size={12}/> {evt.time}</span>}
                                                                {evt.location && <span className="flex items-center gap-1"><MapPin size={12}/> {evt.location}</span>}
                                                                {evt.link && <span className="flex items-center gap-1 text-blue-500"><Link size={12}/> رابط</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 pt-2 mt-2 border-t border-gray-100 dark:border-gray-600">
                                                        {evt.collectionName === 'management_meetings' && (
                                                            <button onClick={(e) => { e.stopPropagation(); initiateReminder(evt); }} className="flex-1 py-1 bg-gray-50 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-500 font-bold flex items-center justify-center gap-2">
                                                                <BellRing size={14}/> إرسال تذكير
                                                            </button>
                                                        )}
                                                        {evt.collectionName === 'management_meetings' && (
                                                            <div className="flex gap-2 flex-1">
                                                                {evt.date === new Date().toISOString().split('T')[0] ? (
                                                                    ((evt.isRecurring ? evt.attendees?.includes(`${user.uid}_${evt.date}`) : evt.attendees?.includes(user.uid)) || 
                                                                     (evt.isRecurring ? evt.apologies?.includes(`${user.uid}_${evt.date}`) : evt.apologies?.includes(user.uid))) ? (
                                                                        <div className="flex-1 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs rounded font-bold flex items-center justify-center gap-2">
                                                                            {(evt.isRecurring ? evt.attendees?.includes(`${user.uid}_${evt.date}`) : evt.attendees?.includes(user.uid)) ? <><CheckCircle size={14} className="text-green-500"/> تم التأكيد</> : <><X size={14} className="text-red-500"/> تم الاعتذار</>}
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <button 
                                                                                onClick={async (e) => {
                                                                                    e.stopPropagation();
                                                                                    if(!window.confirm("تأكيد الحضور؟")) return;
                                                                                    const val = evt.isRecurring ? `${user.uid}_${evt.date}` : user.uid;
                                                                                    await updateDoc(doc(db, "management_meetings", evt.id), {
                                                                                        attendees: [...(evt.attendees || []), val]
                                                                                    });
                                                                                    alert("تم تأكيد الحضور ✅");
                                                                                }}
                                                                                className="flex-1 py-1 bg-green-50 text-green-600 text-xs rounded hover:bg-green-100 font-bold flex items-center justify-center gap-2"
                                                                            >
                                                                                <CheckCircle size={14}/> تأكيد
                                                                            </button>
                                                                            <button 
                                                                                onClick={async (e) => {
                                                                                    e.stopPropagation();
                                                                                    const reason = prompt("سبب الاعتذار:");
                                                                                    if(!reason) return;
                                                                                    const val = evt.isRecurring ? `${user.uid}_${evt.date}` : user.uid;
                                                                                    await updateDoc(doc(db, "management_meetings", evt.id), {
                                                                                        apologies: [...(evt.apologies || []), val]
                                                                                    });
                                                                                    alert("تم إرسال الاعتذار");
                                                                                }}
                                                                                className="flex-1 py-1 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100 font-bold flex items-center justify-center gap-2"
                                                                            >
                                                                                <X size={14}/> اعتذار
                                                                            </button>
                                                                        </>
                                                                    )
                                                                ) : (
                                                                    <div className="flex-1 py-1 bg-gray-50 dark:bg-gray-800 text-gray-400 text-[10px] rounded font-bold flex items-center justify-center">
                                                                        يفتح التأكيد في يوم الموعد
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>
            </main>

            {/* Add Modal */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h3 className="text-xl font-black text-gray-800 dark:text-white">إضافة موعد جديد</h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20}/></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                                    <button onClick={() => setNewEvent({...newEvent, type: 'meeting'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newEvent.type === 'meeting' ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600' : 'text-gray-500'}`}>اجتماع</button>
                                    <button onClick={() => setNewEvent({...newEvent, type: 'task'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newEvent.type === 'task' ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600' : 'text-gray-500'}`}>مهمة</button>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">العنوان</label>
                                    <input type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="مثلاً: اجتماع الفريق الأسبوعي"/>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">التاريخ</label>
                                        <input type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500"/>
                                    </div>
                                    {newEvent.type === 'meeting' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">الوقت</label>
                                            <input type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500"/>
                                        </div>
                                    )}
                                </div>
                                {newEvent.type === 'meeting' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">رابط الاجتماع (اختياري)</label>
                                        <input type="text" value={newEvent.link} onChange={e => setNewEvent({...newEvent, link: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="https://zoom.us/..."/>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">التفاصيل</label>
                                    <textarea value={newEvent.details} onChange={e => setNewEvent({...newEvent, details: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 h-24 resize-none" placeholder="أضف أي تفاصيل إضافية هنا..."></textarea>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="isPrivate" checked={newEvent.isPrivate} onChange={e => setNewEvent({...newEvent, isPrivate: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500"/>
                                    <label htmlFor="isPrivate" className="text-sm font-bold text-gray-600 dark:text-gray-300">حدث خاص (لي فقط)</label>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 flex gap-3">
                                <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all">إلغاء</button>
                                <button onClick={handleAddEvent} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none">حفظ الموعد</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit/View Modal */}
            <AnimatePresence>
                {isEditModalOpen && selectedEvent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h3 className="text-xl font-black text-gray-800 dark:text-white">تفاصيل الموعد</h3>
                                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20}/></button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-2xl ${selectedEvent.type === 'task' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {selectedEvent.type === 'task' ? <CheckCircle size={32}/> : <Video size={32}/>}
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-gray-800 dark:text-white">{selectedEvent.title}</h4>
                                        <p className="text-sm text-gray-400 font-bold">{selectedEvent.type === 'task' ? 'مهمة عمل' : 'اجتماع إداري'}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl">
                                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                                            <CalendarIcon size={14}/>
                                            <span className="text-[10px] font-black uppercase">التاريخ</span>
                                        </div>
                                        <div className="text-sm font-bold text-gray-700 dark:text-white">{selectedEvent.date}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl">
                                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                                            <Clock size={14}/>
                                            <span className="text-[10px] font-black uppercase">الوقت</span>
                                        </div>
                                        <div className="text-sm font-bold text-gray-700 dark:text-white">{selectedEvent.time || 'غير محدد'}</div>
                                    </div>
                                </div>

                                {selectedEvent.details && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase">التفاصيل</label>
                                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                            {selectedEvent.details}
                                        </div>
                                    </div>
                                )}

                                {selectedEvent.link && (
                                    <a href={selectedEvent.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl hover:bg-blue-100 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <Link size={20}/>
                                            <span className="font-bold">رابط الاجتماع</span>
                                        </div>
                                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform"/>
                                    </a>
                                )}
                            </div>
                            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 flex gap-3">
                                {selectedEvent.createdBy === user.email && (
                                    <button 
                                        onClick={() => handleDeleteEvent(selectedEvent.id, selectedEvent.collectionName)}
                                        className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                                    >
                                        <Trash2 size={20}/>
                                    </button>
                                )}
                                <button 
                                    onClick={() => initiateReminder(selectedEvent)}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <BellRing size={18}/> إرسال تذكير
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CalendarSystem;
