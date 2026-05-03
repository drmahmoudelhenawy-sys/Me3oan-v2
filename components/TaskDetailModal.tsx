import React, { useState } from "react";
import { db } from "../services/firebase";
import { updateDoc, doc } from "firebase/firestore";
import { X, MessageSquare, Send, Edit2, Save, Palette } from "lucide-react";

const TaskDetailModal = ({ task, user, userProfile, onClose }: any) => {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<any[]>(task.comments || []);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState({ 
      title: task.title, 
      details: task.details, 
      cardColor: task.cardColor || '#ffffff' 
  });
  
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!comment.trim()) return;
    const newComment = { 
        id: Date.now(), 
        text: comment, 
        user: userProfile?.displayName || user.email?.split('@')[0], 
        timestamp: new Date().toISOString() 
    };
    const updated = [...comments, newComment]; 
    setComments(updated);
    
    await updateDoc(doc(db, 'tasks', task.id), { comments: updated });
    setComment("");
  };

  const handleSave = async () => {
      try {
          await updateDoc(doc(db, 'tasks', task.id), {
              title: editedTask.title,
              details: editedTask.details,
              cardColor: editedTask.cardColor
          });
          setIsEditing(false);
          // Ideally, we should update the local task object or trigger a refresh, 
          // but since it's real-time via Firestore, the parent component should update automatically.
      } catch (e) {
          console.error("Error updating task:", e);
          alert("حدث خطأ أثناء الحفظ");
      }
  };
  
  const renderDetails = (details: any) => {
     if (typeof details === 'string') return details;
     return JSON.stringify(details, null, 2);
  };
  
  const safeRender = (val: any) => {
      if (typeof val === 'string') return val;
      if (val === null || val === undefined) return "";
      return JSON.stringify(val);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[calc(100dvh-1rem)] h-[min(85dvh,calc(100dvh-1rem))] md:h-auto md:max-h-[calc(100dvh-2rem)] animate-fade-in-up" onClick={e => e.stopPropagation()}>
        
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mt-4 mb-2 md:hidden"></div>

        {/* Header */}
        <div className="shrink-0 p-6 border-b dark:border-gray-700 flex justify-between items-start bg-gray-50 dark:bg-gray-900 rounded-t-3xl">
            <div className="flex-1">
                {isEditing ? (
                    <input 
                        className="w-full p-2 text-xl font-bold bg-white dark:bg-gray-800 border rounded-lg dark:text-white mb-2"
                        value={editedTask.title}
                        onChange={e => setEditedTask({...editedTask, title: e.target.value})}
                    />
                ) : (
                    <h3 className="font-bold text-xl text-gray-800 dark:text-white mb-2">{safeRender(task.title)}</h3>
                )}
            </div>
            <div className="flex items-center gap-2 mr-4">
                {isEditing ? (
                    <button onClick={handleSave} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition" title="حفظ">
                        <Save size={20}/>
                    </button>
                ) : (
                    <button onClick={() => setIsEditing(true)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" title="تعديل">
                        <Edit2 size={20}/>
                    </button>
                )}
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><X size={20}/></button>
            </div>
        </div>

        {/* Content */}
        <div className="min-h-0 p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
            
            {/* Color Picker (Only in Edit Mode) */}
            {isEditing && (
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                    <Palette size={18} className="text-gray-500"/>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">لون البطاقة:</span>
                    <input 
                        type="color" 
                        value={editedTask.cardColor}
                        onChange={e => setEditedTask({...editedTask, cardColor: e.target.value})}
                        className="w-8 h-8 rounded cursor-pointer border-none"
                    />
                </div>
            )}

            <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">التفاصيل</h4>
                {isEditing ? (
                    <textarea 
                        className="w-full p-4 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white min-h-[150px] text-sm leading-relaxed"
                        value={renderDetails(editedTask.details)}
                        onChange={e => setEditedTask({...editedTask, details: e.target.value})}
                    />
                ) : (
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                        {renderDetails(task.details) || "لا توجد تفاصيل إضافية"}
                    </p>
                )}
            </div>

            {/* Comments Section */}
            <div>
                <h4 className="font-bold text-sm mb-4 flex items-center gap-2 text-gray-800 dark:text-white border-t dark:border-gray-700 pt-4">
                    <MessageSquare size={16}/> التعليقات ({comments.length})
                </h4>
                <div className="space-y-3">
                    {comments.length === 0 && <p className="text-gray-400 text-xs italic text-center py-4">لا توجد تعليقات بعد</p>}
                    {comments.map((c: any, idx: number) => (
                        <div key={idx} className="bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">{c.user}</span>
                                <span className="text-[10px] text-gray-400">{new Date(c.timestamp).toLocaleString('ar-EG')}</span>
                            </div>
                            <p className="text-gray-700 dark:text-gray-200 text-sm mt-1">{c.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Add Comment Form */}
        <form onSubmit={handleAddComment} className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-3xl flex gap-2">
            <input 
                className="flex-1 px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-sm" 
                placeholder="أضف تعليقاً..." 
                value={comment} 
                onChange={e => setComment(e.target.value)} 
            />
            <button className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition transform hover:scale-105">
                <Send size={18} className={document.dir === 'rtl' ? 'rotate-180' : ''}/>
            </button>
        </form>
      </div>
    </div>
  );
};

export default TaskDetailModal;
