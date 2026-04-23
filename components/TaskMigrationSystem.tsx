import React, { useState } from 'react';
import { db } from '../services/firebase';
import { collection, query, getDocs, doc, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore';
import { Play, CheckCircle2, AlertCircle, Loader2, Database, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MigrationStats {
    total: number;
    processed: number;
    migrated: number;
    errors: number;
}

const TaskMigrationSystem = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState<MigrationStats | null>(null);
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 50));

    const runMigration = async () => {
        if (!confirm("هل أنت متأكد من بدء عملية تحويل المهام إلى Me3oan Task v2؟ سيتم نقل جميع التعليقات القديمة إلى سجل الأنشطة.")) return;
        
        setIsRunning(true);
        setStats({ total: 0, processed: 0, migrated: 0, errors: 0 });
        addLog("🚀 بدء عملية التحويل...");

        try {
            const tasksSnap = await getDocs(collection(db, "tasks"));
            const totalTasks = tasksSnap.size;
            setStats(s => ({ ...s!, total: totalTasks }));
            addLog(`📝 تم العثور على ${totalTasks} مهمة للمراجعة.`);

            let processed = 0;
            let migrated = 0;
            let errors = 0;

            for (const taskDoc of tasksSnap.docs) {
                const data = taskDoc.data();
                
                // Only migrate if it has comments and hasn't been migrated yet (or we force re-check)
                if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
                    try {
                        const batch = writeBatch(db);
                        
                        for (const comment of data.comments) {
                            const pulseRef = doc(collection(db, "tasks", taskDoc.id, "pulse"));
                            batch.set(pulseRef, {
                                type: 'comment',
                                text: comment.text || comment, // Handle string or object comments
                                user: comment.user || 'نظام معوان',
                                timestamp: comment.timestamp ? new Date(comment.timestamp) : serverTimestamp(),
                                isMigrated: true
                            });
                        }

                        // Mark task as migrated to v2 and optionally keep comments as backup
                        batch.update(doc(db, "tasks", taskDoc.id), {
                            mite_v2_migrated: true,
                            legacy_comments_backup: data.comments
                            // We don't delete 'comments' yet for safety, but UI will ignore it
                        });

                        await batch.commit();
                        migrated++;
                    } catch (err) {
                        console.error(`Migration error for task ${taskDoc.id}:`, err);
                        errors++;
                    }
                }
                
                processed++;
                if (processed % 5 === 0 || processed === totalTasks) {
                    setStats(s => ({ ...s!, processed, migrated, errors }));
                }
            }

            addLog(`✅ اكتملت المهمة! تم تحويل ${migrated} مهمة بنجاح.`);
        } catch (err) {
            addLog("❌ حدث خطأ فادح أثناء الوصول إلى البيانات.");
            console.error(err);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Database size={24}/>
                </div>
                <div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-white">نظام الهجرة إلى Me3oan Task v2</h3>
                    <p className="text-xs text-gray-400 font-bold">تحويل بيانات المهام القديمة إلى هيكلية السجل الجديدة</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'إجمالي المهام', value: stats?.total || 0, color: 'text-gray-600' },
                    { label: 'تمت معالجتها', value: stats?.processed || 0, color: 'text-blue-600' },
                    { label: 'تم تحويلها', value: stats?.migrated || 0, color: 'text-green-600' },
                    { label: 'أخطاء', value: stats?.errors || 0, color: 'text-red-600' }
                ].map((s, idx) => (
                    <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">{s.label}</span>
                        <span className={`text-2xl font-black ${s.color}`}>{s.value}</span>
                    </div>
                ))}
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <button 
                    onClick={runMigration}
                    disabled={isRunning}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none transition flex items-center justify-center gap-3"
                >
                    {isRunning ? <Loader2 size={20} className="animate-spin"/> : <Play size={20}/>}
                    {isRunning ? 'جاري التحويل...' : 'بدء عملية التحويل الشاملة'}
                </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-900/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 font-mono text-[10px]">
                {log.length === 0 && <p className="text-gray-400 italic">بانتظار البدء...</p>}
                {log.map((m, i) => <p key={i} className="text-gray-600 dark:text-gray-400 border-b dark:border-gray-800 pb-1 mb-1 last:border-0">{m}</p>)}
            </div>

            <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/50 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5"/>
                <div className="text-xs text-amber-700 dark:text-amber-300 font-bold leading-relaxed">
                    يتم التحويل عبر دفعات (Batches) لضمان أعلى سرعة وأقل استهلاك لعمليات Firestore. ينصح بعدم إغلاق الصفحة حتى اكتمال العملية.
                </div>
            </div>
        </div>
    );
};

export default TaskMigrationSystem;
