import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  ChevronDown,
  CheckCircle2,
  Flag,
  Hash,
  Image as ImageIcon,
  Send,
  User,
  X,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { DEPARTMENTS } from "../utils/constants";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: any) => void;
  activeDeptId: string;
  user: any;
  initialData?: any;
  existingCategories?: string[];
  projects?: any[];
}

const PRIORITIES = [
  { id: "p4", label: "عادي", className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30" },
  { id: "p3", label: "متوسط", className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-400" },
  { id: "p2", label: "هام", className: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/30 dark:bg-orange-900/10 dark:text-orange-400" },
  { id: "p1", label: "عاجل جدًا", className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400" },
];

export const REQUEST_TEMPLATES = [
  { id: "poster", label: "تصميم بوستر", type: "graphic", defaultTitle: "تصميم بوستر: ", defaultDetails: "المقاسات المطلوب تصميمها:\nمحتوى البوستر:\nالهوية البصرية المعتمدة:" },
  { id: "social_post", label: "بوست سوشيال", type: "graphic", defaultTitle: "بوست سوشيال: ", defaultDetails: "موضوع المنشور:\nتاريخ النشر المقترح:\nالمنصات المستهدفة:" },
  { id: "video", label: "فيديو", type: "media", defaultTitle: "فيديو: ", defaultDetails: "فكرة الفيديو الأساسية:\nالمدة التقريبية:\nالمادة الخام (فيديوهات/صور):\nالنص/السيناريو المرفق:" },
  { id: "reels", label: "ريلز", type: "media", defaultTitle: "ريلز: ", defaultDetails: "فكرة الريلز:\nالصوت المستخدم:\nالنص الكتابي على الفيديو:" },
  { id: "visual_identity", label: "هوية بصرية", type: "graphic", defaultTitle: "تصميم هوية بصرية: ", defaultDetails: "اسم المشروع/الفعالية:\nالألوان المقترحة:\nالانطباع العام المطلوب:" },
  { id: "flyer", label: "فلاير", type: "graphic", defaultTitle: "تصميم فلاير: ", defaultDetails: "المقاس:\nالوجهين أم وجه واحد:\nالنصوص المكتوبة:\nمعلومات الاتصال المضافة:" },
  { id: "certificate", label: "شهادة", type: "graphic", defaultTitle: "تصميم شهادة شكر وتقدير: ", defaultDetails: "أسماء المكرمين:\nمناسبة التكريم:\nتوقيعات الاعتماد:" },
  { id: "motion_graphics", label: "موشن جرافيك", type: "media", defaultTitle: "فيديو موشن جرافيك: ", defaultDetails: "السيناريو بالتفصيل:\nالتعليق الصوتي المرفق:\nالمدة المطلوبة:" },
  { id: "software_dev", label: "تطوير برمجي", type: "tech", defaultTitle: "تطوير برمجي: ", defaultDetails: "المشكلة/الطلب بالتفصيل:\nالخطوات المتوقعة:\nالنتيجة المطلوبة:" },
  { id: "content_writing", label: "كتابة محتوى", type: "content", defaultTitle: "كتابة محتوى: ", defaultDetails: "نوع المحتوى:\nالفئة المستهدفة:\nالأسلوب والنبرة:" },
];

const getDefaultState = (initialData?: any) => ({
  title: initialData?.title || "",
  details: initialData?.details || "",
  deadline: initialData?.deadline || "",
  executionDate: initialData?.executionDate || "",
  priority: initialData?.priority || "p4",
  targetDept: initialData?.targetDept || "",
  isForSelf: !initialData?.targetDept,
  isAlsoForSelf: false,
  category: initialData?.category || "",
  performerName: initialData?.performerName || "",
  eduBatchNumber: initialData?.eduBatchNumber || "",
  eduCreateCover: Boolean(initialData?.eduCreateCover),
  projectId: initialData?.projectId || "",
  requestType: initialData?.requestType || "",
  attachments: initialData?.attachments || "",
});

export default function AddTaskModal({
  isOpen,
  onClose,
  onAdd,
  activeDeptId,
  initialData,
  existingCategories = [],
  projects = [],
}: AddTaskModalProps) {
  const [form, setForm] = useState(() => getDefaultState(initialData));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [brandLogos, setBrandLogos] = useState<{ name: string; url: string }[]>([]);
  const [selectedLogos, setSelectedLogos] = useState<string[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  const activeDept = DEPARTMENTS.find((dept) => dept.id === activeDeptId);
  const targetDept = DEPARTMENTS.find((dept) => dept.id === form.targetDept);
  const selectedPriority = PRIORITIES.find((priority) => priority.id === form.priority) || PRIORITIES[0];

  const selectedTemplate = REQUEST_TEMPLATES.find(t => t.id === form.requestType);
  const isGraphicTemplate = selectedTemplate?.type === "graphic" || activeDeptId === "art" || form.targetDept === "art";
  const showLogoPicker = isGraphicTemplate && brandLogos.length > 0;

  useEffect(() => {
    if (!isOpen) return;

    const nextState = getDefaultState(initialData);
    if (!initialData) {
      const savedPerformer = localStorage.getItem("ma3wan_last_performer");
      const savedCategory = localStorage.getItem("ma3wan_last_category");
      const savedTargetDept = localStorage.getItem("ma3wan_last_targetDept");

      if (savedPerformer) nextState.performerName = savedPerformer;
      if (savedCategory) nextState.category = savedCategory;
      if (savedTargetDept && savedTargetDept !== activeDeptId) {
        nextState.targetDept = savedTargetDept;
        nextState.isForSelf = false;
      }
    }

    setForm(nextState);
    setSelectedLogos([]);
    setShowAdvanced(false);
    setTimeout(() => titleRef.current?.focus(), 100);
  }, [activeDeptId, initialData, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchLogos = async () => {
      try {
        const docSnap = await getDoc(doc(db, "app_settings", "brand_identity"));
        if (docSnap.exists()) {
          setBrandLogos(docSnap.data().additionalLogos || []);
        }
      } catch (error) {
        console.error("Error fetching brand logos", error);
      }
    };

    fetchLogos();
  }, [isOpen]);

  const updateForm = (updates: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...updates }));
  };

  const handleTemplateChange = (typeId: string) => {
    const template = REQUEST_TEMPLATES.find(t => t.id === typeId);
    if (template) {
      updateForm({
        requestType: typeId,
        title: template.defaultTitle,
        details: template.defaultDetails,
      });
    } else {
      updateForm({
        requestType: "",
        title: "",
        details: "",
      });
    }
  };

  const toggleLogo = (logoName: string) => {
    setSelectedLogos((current) =>
      current.includes(logoName) ? current.filter((name) => name !== logoName) : [...current, logoName]
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    if (form.performerName) localStorage.setItem("ma3wan_last_performer", form.performerName);
    if (form.category) localStorage.setItem("ma3wan_last_category", form.category);
    if (!form.isForSelf && form.targetDept) localStorage.setItem("ma3wan_last_targetDept", form.targetDept);

    onAdd({
      ...form,
      title: form.title.trim(),
      details: form.details.trim(),
      targetDept: form.isForSelf ? activeDeptId : form.targetDept,
      selectedLogos,
    });

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="task-modal-shell fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm md:items-center md:p-4"
          onClick={onClose}
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="task-modal-panel flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-xl dark:bg-slate-950 md:max-h-[calc(100dvh-2rem)] md:rounded-[28px] border border-slate-100 dark:border-slate-800"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <header className="border-b border-slate-100/80 px-6 py-5 dark:border-slate-800/80">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 md:hidden" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="mb-1 text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Sparkles size={12} /> {activeDept?.nameAr || "مهمة جديدة"}
                    </span>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">إنشاء طلب جديد</h2>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:bg-slate-900 dark:text-slate-500"
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>

              <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6">
                
                {/* 1. Request Type / Template */}
                <div>
                  <span className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">نوع الطلب (قوالب جاهزة)</span>
                  <select
                    value={form.requestType}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <option value="">طلب مخصص (بدون قالب)</option>
                    {REQUEST_TEMPLATES.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Title */}
                <div>
                  <span className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">عنوان الطلب</span>
                  <input
                    ref={titleRef}
                    value={form.title}
                    onChange={(event) => updateForm({ title: event.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-black text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    placeholder="مثال: تصميم بوستر إعلان الحملة الشتوية"
                    required
                  />
                </div>

                {/* 3. Description / details */}
                <div>
                  <span className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">وصف الطلب</span>
                  <textarea
                    value={form.details}
                    onChange={(event) => updateForm({ details: event.target.value })}
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    placeholder="اكتب تفاصيل طلبك بوضوح هنا..."
                    required
                  />
                </div>

                {/* 4. Target Dept & Deadline Row */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <span className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">الجهة المنفذة</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateForm({ isForSelf: true, targetDept: "" })}
                        className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-black transition ${
                          form.isForSelf
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                            : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        <User size={15} />
                        نفس اللجنة
                      </button>
                      <button
                        type="button"
                        onClick={() => updateForm({ isForSelf: false, targetDept: form.targetDept || "" })}
                        className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-black transition ${
                          !form.isForSelf
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                            : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        <Send size={15} />
                        لجنة أخرى
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">الموعد النهائي</span>
                    <div className="relative font-mono">
                      <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="date"
                        value={form.deadline}
                        onChange={(event) => updateForm({ deadline: event.target.value })}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Committee select */}
                {!form.isForSelf && (
                  <div>
                    <span className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">اللجنة المستلمة للطلب</span>
                    <select
                      value={form.targetDept}
                      onChange={(event) => updateForm({ targetDept: event.target.value })}
                      required={!form.isForSelf}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <option value="">اختر اللجنة المستلمة</option>
                      {DEPARTMENTS.filter((dept) => dept.id !== activeDeptId).map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.nameAr || dept.name}
                        </option>
                      ))}
                    </select>
                    {targetDept && (
                      <p className="mt-2 text-xs font-bold text-indigo-500 dark:text-indigo-400">سيتم إرسال الطلب تلقائياً إلى إدارة قسم: {targetDept.nameAr || targetDept.name}</p>
                    )}
                  </div>
                )}

                {/* 6. Priority */}
                <div>
                  <span className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">درجة الأهمية (الأولوية)</span>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {PRIORITIES.map((priority) => (
                      <button
                        key={priority.id}
                        type="button"
                        onClick={() => updateForm({ priority: priority.id })}
                        className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-black transition ${
                          form.priority === priority.id ? priority.className : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900/50"
                        }`}
                      >
                        <Flag size={13} />
                        {priority.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 7. Attachments & Visual Identity */}
                <div className="space-y-4">
                  <div>
                    <span className="mb-2 block text-xs font-black text-slate-500 dark:text-slate-400">رابط المرفقات / الهوية البصرية (اختياري)</span>
                    <div className="relative">
                      <LinkIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        type="url"
                        value={form.attachments}
                        onChange={(event) => updateForm({ attachments: event.target.value })}
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                        placeholder="أدخل رابط ملفات Drive أو Figma أو Dropbox"
                      />
                    </div>
                  </div>

                  {showLogoPicker && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                      <div className="mb-3 flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400">
                        <ImageIcon size={15} />
                        تحديد اللوجوهات أو الهويات المطلوبة للطلب
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {brandLogos.map((logo) => (
                          <button
                            key={logo.name}
                            type="button"
                            onClick={() => toggleLogo(logo.name)}
                            className={`relative aspect-square overflow-hidden rounded-2xl border-2 bg-white p-2 transition ${
                              selectedLogos.includes(logo.name) ? "border-indigo-500 ring-4 ring-indigo-50" : "border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100"
                            }`}
                          >
                            <img src={logo.url} alt={logo.name} className="h-full w-full object-contain" />
                            {selectedLogos.includes(logo.name) && (
                              <span className="absolute right-1 top-1 rounded-full bg-indigo-600 p-1 text-white">
                                <CheckCircle2 size={11} />
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Advanced Collapse Options */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((value) => !value)}
                    className="flex w-full items-center justify-between rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-black text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900/20"
                  >
                    خيارات إضافية
                    <ChevronDown size={17} className={`transition ${showAdvanced ? "rotate-180" : ""}`} />
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-xs font-black text-slate-500">المسؤول المقترح للتنفيذ</span>
                          <input
                            value={form.performerName}
                            onChange={(event) => updateForm({ performerName: event.target.value })}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                            placeholder="اسم الشخص"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-black text-slate-500">تصنيف داخلي</span>
                          <div className="relative">
                            <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                              list="task-categories-list"
                              value={form.category}
                              onChange={(event) => updateForm({ category: event.target.value })}
                              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                              placeholder="مثال: تصاميم"
                            />
                            <datalist id="task-categories-list">
                              {existingCategories.map((category) => (
                                <option key={category} value={category} />
                              ))}
                            </datalist>
                          </div>
                        </label>
                      </div>

                      {!form.isForSelf && (
                        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-black text-indigo-700 dark:bg-slate-900">
                          <input
                            type="checkbox"
                            checked={form.isAlsoForSelf}
                            onChange={(event) => updateForm({ isAlsoForSelf: event.target.checked })}
                            className="h-4 w-4 rounded text-indigo-600"
                          />
                          أضف نسخة في لجنة المنشأ أيضًا
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </main>

              <footer className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div className="hidden text-xs font-bold text-slate-400 md:block">
                    {form.isForSelf ? "سيضاف لنفس لجنتك" : targetDept ? `سيحول إلى ${targetDept.nameAr || targetDept.name}` : "اختر اللجنة المستلمة"}
                  </div>
                  <div className="mr-auto flex w-full gap-2 md:w-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-500 transition hover:bg-slate-200 md:flex-none dark:bg-slate-900 dark:text-slate-400"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={!form.title.trim() || (!form.isForSelf && !form.targetDept)}
                      className={`flex-1 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg transition md:flex-none ${
                        selectedPriority.id === "p1" ? "bg-red-600 shadow-red-600/20" : "bg-indigo-600 shadow-indigo-600/20"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      إنشاء الطلب
                    </button>
                  </div>
                </div>
              </footer>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
