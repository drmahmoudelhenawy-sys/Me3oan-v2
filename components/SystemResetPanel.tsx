import React, { useState } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { AlertTriangle, RefreshCw, Trash2, CheckCircle, Database, ShieldAlert, Loader2 } from 'lucide-react';

interface ResetOption {
  id: string;
  label: string;
  desc: string;
  collections: string[];
}

export default function SystemResetPanel() {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, boolean>>({
    tasks: true,
    general_admin: false,
    projects: false,
    notifications: false,
    points: false,
    announcements: false,
    reports: false,
    submissions: false,
    blood_bank: false,
  });

  const [confirmText, setConfirmText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  const options: ResetOption[] = [
    { id: 'tasks', label: 'مهام الأقسام والمهام الشخصية (Tasks & Pulse)', desc: 'حذف جميع مهام الأقسام والمهام الشخصية وسجلات أنشطتها والتعليقات الخاصة بها نهائياً (لا يشمل جدول الإدارة العامة).', collections: ['tasks'] },
    { id: 'general_admin', label: 'جدول الإدارة العامة (General Administration Board)', desc: 'حذف جميع الصفوف والمهام والبيانات الخاصة بجدول الإدارة العامة والتحكم نهائياً.', collections: ['tasks'] },
    { id: 'projects', label: 'المشاريع (Projects)', desc: 'حذف جميع المشاريع المضافة في النظام.', collections: ['projects'] },
    { id: 'notifications', label: 'الإشعارات (Notifications)', desc: 'مسح جميع الإشعارات المرسلة للمستخدمين.', collections: ['notifications'] },
    { id: 'points', label: 'سجلات ونقاط الأعضاء (Points & Logs)', desc: 'تصفير نقاط جميع الأعضاء وحذف سجلات توزيع النقاط بالكامل.', collections: ['points_logs', 'users'] },
    { id: 'announcements', label: 'الإعلانات والاجتماعات (Announcements)', desc: 'حذف اجتماعات الإدارة والإعلانات العامة من لوحة التحكم.', collections: ['management_meetings'] },
    { id: 'reports', label: 'تقارير الأقسام والتقارير الشهرية (Reports)', desc: 'حذف كافة التقارير المرفوعة بواسطة مسؤولي الأقسام.', collections: ['department_reports', 'monthly_reports'] },
    { id: 'submissions', label: 'طلبات الانضمام والتطوع (Submissions)', desc: 'مسح جميع طلبات التقديم والطلبات الواردة من المتطوعين الجدد.', collections: ['submissions'] },
    { id: 'blood_bank', label: 'متبرعو وطلبات بنك الدم (Blood Bank)', desc: 'حذف جميع سجلات المتبرعين بالدم وطلبات الاستغاثة المسجلة.', collections: ['blood_donors', 'blood_requests'] },
  ];

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`, ...prev]);
  };

  const handleToggle = (id: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const runReset = async () => {
    const activeOptions = Object.entries(selectedOptions).filter(([_, val]) => val).map(([key]) => key);
    
    if (activeOptions.length === 0) {
      alert('يرجى تحديد خيار واحد على الأقل لإعادة الضبط.');
      return;
    }

    if (confirmText.trim() !== 'مسح البيانات') {
      alert('يرجى كتابة جملة "مسح البيانات" لتأكيد رغبتك في حذف البيانات.');
      return;
    }

    if (!confirm('⚠️ تحذير نهائي: هل أنت متأكد تماماً من رغبتك في حذف البيانات المحددة؟ لا يمكن التراجع عن هذه العملية أبداً!')) {
      return;
    }

    setIsRunning(true);
    setStatus('running');
    setLogs([]);
    addLog('🚀 بدء عملية إعادة ضبط قاعدة البيانات...');

    try {
      // 1. Reset Department & Personal Tasks
      if (selectedOptions.tasks) {
        addLog('⏳ جاري جلب مهام الأقسام والمهام الشخصية...');
        const tasksSnap = await getDocs(collection(db, 'tasks'));
        const docsToDelete = tasksSnap.docs.filter(d => d.data().sourceDept !== 'general_admin_board');
        addLog(`📝 تم العثور على ${docsToDelete.length} مهمة (أقسام وشخصية). جاري الحذف...`);
        
        let deletedTasksCount = 0;
        for (const taskDoc of docsToDelete) {
          // Delete pulse subcollection documents first
          const pulseSnap = await getDocs(collection(db, 'tasks', taskDoc.id, 'pulse'));
          if (pulseSnap.size > 0) {
            const pulseBatch = writeBatch(db);
            pulseSnap.docs.forEach((pulseDoc) => pulseBatch.delete(pulseDoc.ref));
            await pulseBatch.commit();
          }
          
          // Delete task document
          const taskBatch = writeBatch(db);
          taskBatch.delete(taskDoc.ref);
          await taskBatch.commit();
          deletedTasksCount++;
        }
        addLog(`✅ تم حذف ${deletedTasksCount} مهمة وجميع سجلات الأنشطة التابعة لها بنجاح.`);
      }

      // 1b. Reset General Administration Table
      if (selectedOptions.general_admin) {
        addLog('⏳ جاري جلب مهام جدول الإدارة العامة...');
        const tasksSnap = await getDocs(collection(db, 'tasks'));
        const docsToDelete = tasksSnap.docs.filter(d => d.data().sourceDept === 'general_admin_board');
        addLog(`📝 تم العثور على ${docsToDelete.length} مهمة في جدول الإدارة العامة. جاري الحذف...`);
        
        let deletedTasksCount = 0;
        for (const taskDoc of docsToDelete) {
          // Delete pulse subcollection documents first
          const pulseSnap = await getDocs(collection(db, 'tasks', taskDoc.id, 'pulse'));
          if (pulseSnap.size > 0) {
            const pulseBatch = writeBatch(db);
            pulseSnap.docs.forEach((pulseDoc) => pulseBatch.delete(pulseDoc.ref));
            await pulseBatch.commit();
          }
          
          // Delete task document
          const taskBatch = writeBatch(db);
          taskBatch.delete(taskDoc.ref);
          await taskBatch.commit();
          deletedTasksCount++;
        }
        addLog(`✅ تم حذف ${deletedTasksCount} صف من جدول الإدارة العامة بنجاح.`);
      }

      // 2. Reset Projects
      if (selectedOptions.projects) {
        addLog('⏳ جاري حذف المشاريع...');
        const snap = await getDocs(collection(db, 'projects'));
        if (snap.size > 0) {
          const batch = writeBatch(db);
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          addLog(`✅ تم حذف ${snap.size} مشروع بنجاح.`);
        } else {
          addLog('ℹ️ لا توجد مشاريع لحذفها.');
        }
      }

      // 3. Reset Notifications
      if (selectedOptions.notifications) {
        addLog('⏳ جاري حذف الإشعارات...');
        const snap = await getDocs(collection(db, 'notifications'));
        if (snap.size > 0) {
          const batch = writeBatch(db);
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          addLog(`✅ تم حذف ${snap.size} إشعار بنجاح.`);
        } else {
          addLog('ℹ️ لا توجد إشعارات لحذفها.');
        }
      }

      // 4. Reset Points & Logs
      if (selectedOptions.points) {
        addLog('⏳ جاري حذف سجلات توزيع النقاط...');
        const logsSnap = await getDocs(collection(db, 'points_logs'));
        if (logsSnap.size > 0) {
          const batch = writeBatch(db);
          logsSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          addLog(`✅ تم حذف ${logsSnap.size} سجل نقاط بنجاح.`);
        }

        addLog('⏳ جاري تصفير نقاط جميع الأعضاء في قاعدة البيانات...');
        const usersSnap = await getDocs(collection(db, 'users'));
        let resetUsersCount = 0;
        const userBatch = writeBatch(db);
        usersSnap.docs.forEach((d) => {
          userBatch.update(d.ref, { points: 0 });
          resetUsersCount++;
        });
        await userBatch.commit();
        addLog(`✅ تم تصفير نقاط عدد ${resetUsersCount} عضو بنجاح.`);
      }

      // 5. Reset Announcements
      if (selectedOptions.announcements) {
        addLog('⏳ جاري حذف الإعلانات واجتماعات الإدارة...');
        const snap = await getDocs(collection(db, 'management_meetings'));
        if (snap.size > 0) {
          const batch = writeBatch(db);
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          addLog(`✅ تم حذف ${snap.size} إعلان/اجتماع بنجاح.`);
        } else {
          addLog('ℹ️ لا توجد إعلانات لحذفها.');
        }
      }

      // 6. Reset Reports
      if (selectedOptions.reports) {
        addLog('⏳ جاري حذف تقارير الأقسام...');
        const deptSnap = await getDocs(collection(db, 'department_reports'));
        if (deptSnap.size > 0) {
          const batch = writeBatch(db);
          deptSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          addLog(`✅ تم حذف ${deptSnap.size} تقرير قسم بنجاح.`);
        }

        addLog('⏳ جاري حذف التقارير الشهرية...');
        const monthlySnap = await getDocs(collection(db, 'monthly_reports'));
        if (monthlySnap.size > 0) {
          const batch = writeBatch(db);
          monthlySnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          addLog(`✅ تم حذف ${monthlySnap.size} تقرير شهري بنجاح.`);
        }
      }

      // 7. Reset Submissions
      if (selectedOptions.submissions) {
        addLog('⏳ جاري حذف طلبات الانضمام...');
        const snap = await getDocs(collection(db, 'submissions'));
        if (snap.size > 0) {
          const batch = writeBatch(db);
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          addLog(`✅ تم حذف ${snap.size} طلب انضمام بنجاح.`);
        } else {
          addLog('ℹ️ لا توجد طلبات انضمام لحذفها.');
        }
      }

      // 8. Reset Blood Bank
      if (selectedOptions.blood_bank) {
        addLog('⏳ جاري حذف سجلات المتبرعين بالدم...');
        const donorsSnap = await getDocs(collection(db, 'blood_donors'));
        if (donorsSnap.size > 0) {
          const batch = writeBatch(db);
          donorsSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          addLog(`✅ تم حذف ${donorsSnap.size} متبرع بالدم بنجاح.`);
        }

        addLog('⏳ جاري حذف طلبات الاستغاثة بنك الدم...');
        const requestsSnap = await getDocs(collection(db, 'blood_requests'));
        if (requestsSnap.size > 0) {
          const batch = writeBatch(db);
          requestsSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          addLog(`✅ تم حذف ${requestsSnap.size} طلب استغاثة بنجاح.`);
        }
      }

      addLog('🎉 اكتملت عملية إعادة ضبط النظام وحذف البيانات المحددة بنجاح!');
      setStatus('success');
      setConfirmText('');
    } catch (error: any) {
      console.error(error);
      addLog(`❌ حدث خطأ غير متوقع: ${error.message || error}`);
      setStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto" dir="rtl">
      {/* Alert Header */}
      <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border border-red-200 dark:border-red-900/50 rounded-3xl p-6 flex flex-col md:flex-row gap-5 items-start">
        <div className="p-4 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl shrink-0">
          <ShieldAlert size={36} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-red-800 dark:text-red-400">منطقة خطر: إعادة ضبط بيانات الموقع</h3>
          <p className="text-sm text-red-700/80 dark:text-red-300/80 leading-relaxed font-semibold">
            من هنا يمكنك حذف وإعادة ضبط بيانات الموقع بالكامل أو أجزاء منها. الحذف نهائي ومباشر من قاعدة بيانات Firebase Firestore ولا يمكن استرجاع البيانات المحذوفة بأي شكل من الأشكال. يرجى توخي الحذر الشديد!
          </p>
        </div>
      </div>

      {/* Database Status Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl p-6 space-y-6">
        <div>
          <h4 className="text-md font-black text-gray-800 dark:text-white flex items-center gap-2">
            <Database size={20} className="text-indigo-600" />
            تحديد البيانات المراد حذفها
          </h4>
          <p className="text-xs text-gray-400 mt-1">اختر الجداول والأقسام التي تريد تصفيرها أو حذف مستنداتها نهائياً.</p>
        </div>

        {/* Options Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {options.map((opt) => (
            <div
              key={opt.id}
              onClick={() => !isRunning && handleToggle(opt.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-start select-none ${
                selectedOptions[opt.id]
                  ? 'border-red-500 bg-red-50/30 dark:bg-red-950/10'
                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 bg-gray-50/50 dark:bg-gray-900/10'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedOptions[opt.id]}
                readOnly
                disabled={isRunning}
                className="mt-1 h-4.5 w-4.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <div className="space-y-1">
                <span className="text-sm font-black text-gray-800 dark:text-white block">{opt.label}</span>
                <span className="text-[11px] text-gray-400 block leading-normal">{opt.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation & Execution */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl p-6 space-y-5">
        <div>
          <h4 className="text-md font-black text-gray-800 dark:text-white flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" />
            تأكيد الإجراء الأمني
          </h4>
          <p className="text-xs text-gray-400 mt-1">يرجى كتابة العبارة التأكيدية بالأسفل لتفعيل زر الحذف النهائي.</p>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block">
            اكتب عبارة <span className="text-red-500 font-black">"مسح البيانات"</span> في الحقل أدناه:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isRunning}
            placeholder="مسح البيانات"
            className="w-full md:w-1/2 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent dark:text-white font-bold"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={runReset}
            disabled={isRunning || confirmText !== 'مسح البيانات'}
            className="flex-1 sm:flex-initial bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 disabled:from-gray-300 disabled:to-gray-400 text-white font-black px-8 py-4 rounded-2xl shadow-lg disabled:shadow-none hover:shadow-red-200 dark:hover:shadow-none transition flex items-center justify-center gap-3 text-sm"
          >
            {isRunning ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            {isRunning ? 'جاري تنفيذ عملية الحذف...' : 'حذف وإعادة ضبط البيانات المحددة'}
          </button>
        </div>
      </div>

      {/* Logs Window */}
      {(logs.length > 0 || isRunning) && (
        <div className="bg-gray-900 text-gray-100 rounded-3xl border border-gray-800 p-6 space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <span className="font-bold text-gray-400 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-amber-500 animate-pulse' : status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
              سجل العمليات والتقارير
            </span>
            {isRunning && <span className="text-[10px] text-amber-500 animate-pulse">جاري المعالجة...</span>}
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar leading-relaxed">
            {logs.map((log, idx) => (
              <p key={idx} className={log.includes('❌') ? 'text-red-400 font-bold' : log.includes('✅') ? 'text-green-400 font-bold' : log.includes('🎉') ? 'text-emerald-400 font-black text-sm' : 'text-gray-300'}>
                {log}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
