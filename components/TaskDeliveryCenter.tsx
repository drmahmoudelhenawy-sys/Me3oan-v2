import React, { useState, useEffect } from "react";
import { X, CheckSquare, Square, FileText, Send, Calendar, CheckCircle2, User, Loader2 } from "lucide-react";
import { db } from "../services/firebase";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { DEPARTMENTS } from "../utils/constants";
import { resolveDepartmentLeadership, sendTelegramToChatIds } from "../utils/telegramRouting";
import { awardTaskCompletionPointsOnce } from "../utils/taskPoints";
import CloudinaryUpload from "./CloudinaryUpload";
import toast from "react-hot-toast";

interface TaskDeliveryCenterProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  collName: "tasks" | "requests";
  user: any;
  userProfile: any;
  onSuccess: () => void;
  telegramConfig?: any;
  onSendTelegram?: any;
}

export default function TaskDeliveryCenter({
  isOpen,
  onClose,
  task,
  collName,
  user,
  userProfile,
  onSuccess,
  telegramConfig,
  onSendTelegram
}: TaskDeliveryCenterProps) {
  const [description, setDescription] = useState("");
  const [nextVersion, setNextVersion] = useState(1);
  const [checklist, setChecklist] = useState({
    psd: false,
    png: false,
    fonts: false,
    mockup: false
  });
  
  const [isFinal, setIsFinal] = useState(false);
  const [closeTask, setCloseTask] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  
  const [uploadedMetadata, setUploadedMetadata] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [completedImmediately, setCompletedImmediately] = useState(false);
  const [uploadActive, setUploadActive] = useState(false);

  const myName = userProfile?.displayName || user?.email || "عضو";
  const myUid = user?.uid;

  // Determine next version dynamically on open
  useEffect(() => {
    if (!isOpen || !task?.id) return;
    const fetchVersion = async () => {
      try {
        const reqId = task.linkedRequestId || (collName === 'requests' ? task.id : null);
        const taskId = collName === 'tasks' ? task.id : (task.linkedRequestId ? task.id : null);
        const targetColl = reqId ? "requests" : "tasks";
        const targetDocId = reqId || taskId;

        const snap = await getDocs(collection(db, targetColl, targetDocId, "files"));
        const maxVersion = snap.docs.reduce((max, d) => {
          const v = d.data().submissionVersion || 0;
          return v > max ? v : max;
        }, 0);
        setNextVersion(maxVersion + 1);
      } catch (e) {
        console.error(e);
      }
    };
    fetchVersion();
  }, [isOpen, task?.id, task?.linkedRequestId, collName]);

  if (!isOpen) return null;

  const toggleChecklist = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUploadComplete = (files: any[]) => {
    setUploadedMetadata(prev => [...prev, ...files]);
    setUploadActive(false);
  };

  const handleUploadStart = () => {
    setUploadActive(true);
  };

  const handleSubmitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (uploadedMetadata.length === 0) {
      toast.error("يرجى رفع ملف واحد على الأقل للتسليم.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const reqId = task.linkedRequestId || (collName === 'requests' ? task.id : null);
      const taskId = collName === 'tasks' ? task.id : (task.linkedRequestId ? task.id : null);
      const targetColl = reqId ? "requests" : "tasks";
      const targetDocId = reqId || taskId;
      const hasExternalReviewer = Boolean(reqId && task.sourceDept && task.targetDept && task.sourceDept !== task.targetDept);
      const shouldCompleteNow = closeTask || isFinal || !hasExternalReviewer;
      const nextStatus = shouldCompleteNow ? 'completed' : 'executed';

      const filesSubRef = collection(db, targetColl, targetDocId, "files");
      const fileDocIds: string[] = [];

      // 1. Save file metadata to subcollection "files"
      for (const meta of uploadedMetadata) {
        const fileDocRef = await addDoc(filesSubRef, {
          publicId: meta.public_id,
          secureUrl: meta.secure_url,
          originalFilename: meta.original_filename,
          submissionVersion: nextVersion,
          format: meta.format,
          resourceType: meta.resource_type,
          bytes: meta.bytes,
          uploadedBy: myName,
          isFinal: isFinal,
          createdAt: serverTimestamp()
        });
        fileDocIds.push(fileDocRef.id);
      }

      // Prepare checked items description
      const checkedLabels = [];
      if (checklist.psd) checkedLabels.push("PSD (ملف العمل)");
      if (checklist.png) checkedLabels.push("PNG / JPEG (صورة التصميم)");
      if (checklist.fonts) checkedLabels.push("Fonts (الخطوط المستخدمة)");
      if (checklist.mockup) checkedLabels.push("Mockup (معاينة العرض)");

      const checklistText = checkedLabels.length > 0 
        ? `\n📋 قائمة المرفقات المنجزة: ${checkedLabels.join("، ")}` 
        : "";

      const deliveryMessageText = `📎 تم تسليم نسخة جديدة (Submission ${nextVersion}):\n${description || 'لا توجد ملاحظات إضافية.'}${checklistText}`;

      // 2. Add System Message in "messages" subcollection
      await addDoc(collection(db, targetColl, targetDocId, "messages"), {
        type: 'delivery',
        message: deliveryMessageText,
        senderId: myUid,
        senderName: myName,
        senderAvatar: userProfile?.photoURL || "",
        attachmentIds: fileDocIds,
        seenBy: [myUid],
        createdAt: serverTimestamp()
      });

      // 3. Update request status to 'executed' in requests collection
      if (reqId) {
        const reqRef = doc(db, "requests", reqId);
        const reqUpdates: any = {
          status: nextStatus,
          deliveredBy: myUid,
          deliveredByName: myName,
          lastDeliveredBy: myUid,
          lastDeliveredByName: myName,
          updatedAt: serverTimestamp()
        };
        if (shouldCompleteNow) reqUpdates.completedAt = serverTimestamp();
        await updateDoc(reqRef, reqUpdates);
      }

      // 4. Update task status to 'executed' in tasks collection
      if (taskId) {
        const taskDocRef = doc(db, "tasks", taskId);
        const taskUpdates: any = {
          status: nextStatus,
          progress: shouldCompleteNow || isFinal ? 100 : 90,
          deliveredBy: myUid,
          deliveredByName: myName,
          lastDeliveredBy: myUid,
          lastDeliveredByName: myName,
          updatedAt: serverTimestamp()
        };
        if (shouldCompleteNow) taskUpdates.completedAt = serverTimestamp();
        await updateDoc(taskDocRef, taskUpdates);
      }

      if (reqId) {
        const linkedTasksSnap = await getDocs(query(collection(db, "tasks"), where("linkedRequestId", "==", reqId)));
        await Promise.all(linkedTasksSnap.docs.map((taskDoc) => {
          const linkedTaskUpdates: any = {
            status: nextStatus,
            progress: shouldCompleteNow || isFinal ? 100 : 90,
            deliveredBy: myUid,
            deliveredByName: myName,
            lastDeliveredBy: myUid,
            lastDeliveredByName: myName,
            revisionRequested: false,
            updatedAt: serverTimestamp()
          };
          if (shouldCompleteNow) {
            linkedTaskUpdates.completedAt = serverTimestamp();
            linkedTaskUpdates.revisionNote = "";
          }
          return updateDoc(taskDoc.ref, linkedTaskUpdates);
        }));
      }

      // ── Dispatch Delivery Notifications ──
      try {
        if (sendNotification && hasExternalReviewer) {
          await addDoc(collection(db, "notifications"), {
            type: 'task_delivered',
            targetDept: task.sourceDept,
            fromDept: task.targetDept,
            fromDeptName: DEPARTMENTS.find((d: any) => d.id === task.targetDept)?.nameAr || task.targetDept,
            taskTitle: task.title,
            isRead: false,
            createdAt: new Date().toISOString(),
            createdBy: myName
          });

          if (onSendTelegram && telegramConfig) {
            const route = resolveDepartmentLeadership(telegramConfig, task.sourceDept, "manager_and_deputy");
            const msg = `📎 <b>تم تسليم نسخة جديدة (معاينة)</b>\n\n📌 <b>المهمة:</b> ${task.title}\n🎨 <b>بواسطة القسم:</b> ${DEPARTMENTS.find((d: any) => d.id === task.targetDept)?.nameAr || task.targetDept}\n👤 <b>المنفذ:</b> ${myName}\n🔢 <b>الإصدار:</b> Submission ${nextVersion}`;
            sendTelegramToChatIds(onSendTelegram, route.chatIds, msg, route.botToken);
          }
        }
      } catch(e) { console.error('Delivery notification dispatch error:', e); }

      if (shouldCompleteNow) {
        await awardTaskCompletionPointsOnce({
          requestId: reqId,
          taskId,
          fallbackUserId: myUid,
          fallbackUserName: myName,
          taskTitle: task.title
        });
      }

      setCompletedImmediately(shouldCompleteNow);
      setHasSubmitted(true);
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء إتمام عملية التسليم");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      dir="rtl"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
            <span>🎨 مركز تسليم التصاميم (Delivery Center)</span>
          </h3>
          {!isSubmitting && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
              <X size={20} />
            </button>
          )}
        </div>

        {hasSubmitted ? (
          /* Submission Completed Screen */
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl animate-bounce">
              ✓
            </div>
            <h4 className="text-base font-black text-slate-800 dark:text-white">☑ تم إرسال النسخة بنجاح!</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">
              {completedImmediately
                ? "تم إغلاق المهمة وتسجيلها كمكتملة."
                : "بانتظار مراجعة واعتماد القسم المرسل للطلب وإشعاركم بأي ملاحظات."}
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs py-3 rounded-2xl shadow-lg transition"
              >
                إغلاق مركز التسليم
              </button>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <form onSubmit={handleSubmitDelivery} className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
            
            {/* Checklist options */}
            <div className="space-y-2 text-right">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400">قائمة التحقق للمرفقات (Checklist)</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(checklist) as Array<keyof typeof checklist>).map((key) => {
                  const labels: Record<string, string> = {
                    psd: "ملف العمل المفتوح (PSD)",
                    png: "صورة التصميم (PNG)",
                    fonts: "الخطوط المستخدمة (Fonts)",
                    mockup: "معاينة العرض (Mockup)"
                  };
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => toggleChecklist(key)}
                      disabled={isSubmitting}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-[11px] font-bold text-right transition ${
                        checklist[key]
                          ? 'border-indigo-200 bg-indigo-50/30 text-indigo-700 dark:border-indigo-900 dark:text-indigo-400'
                          : 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:text-slate-350'
                      }`}
                    >
                      {checklist[key] ? <CheckSquare size={14} /> : <Square size={14} />}
                      <span>{labels[key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description / Optional Message */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400">رسالة توضيحية للمستلم</label>
              <textarea
                className="w-full h-20 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                placeholder="اكتب هنا أي تفاصيل بخصوص هذه النسخة أو التحديثات الحالية..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Upload component */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400">رفع المرفقات والتصاميم</label>
              <CloudinaryUpload
                onUploadComplete={handleUploadComplete}
                onUploadStart={handleUploadStart}
                maxSizeMB={100}
              />
            </div>

            {/* Version & Submission workflow settings */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3 text-right">
              <div className="flex justify-between items-center text-xs font-black">
                <span className="text-slate-500">إصدار النسخة الحالي:</span>
                <span className="text-indigo-650 dark:text-indigo-400">Submission {nextVersion}</span>
              </div>
              
              <div className="border-t border-slate-100 dark:border-slate-800 my-2"></div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-650 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isFinal}
                    onChange={e => setIsFinal(e.target.checked)}
                    disabled={isSubmitting}
                    className="rounded border-slate-355 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>اعتماد هذه كنسخة نهائية جاهزة للاستلام (Final Version)</span>
                </label>
                
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-650 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={closeTask}
                    onChange={e => setCloseTask(e.target.checked)}
                    disabled={isSubmitting}
                    className="rounded border-slate-355 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>طلب إغلاق المهمة تلقائياً بمجرد الاعتماد</span>
                </label>

                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-650 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={e => setSendNotification(e.target.checked)}
                    disabled={isSubmitting}
                    className="rounded border-slate-355 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>إرسال إشعار بالبريد والتليجرام للقسم الطالب</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || uploadActive || uploadedMetadata.length === 0}
                className="flex-1 bg-indigo-600 text-white font-black text-xs py-3 rounded-2xl shadow-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>جاري إتمام التسليم...</span>
                  </>
                ) : (
                  <span>إرسال وتسليم النسخة v{nextVersion}</span>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 font-black text-xs rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-800"
              >
                إلغاء
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
