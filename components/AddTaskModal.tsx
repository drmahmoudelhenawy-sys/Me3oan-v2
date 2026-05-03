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
  { id: "p4", label: "عادي", className: "border-gray-200 bg-gray-50 text-gray-600" },
  { id: "p3", label: "متوسط", className: "border-blue-200 bg-blue-50 text-blue-700" },
  { id: "p2", label: "هام", className: "border-orange-200 bg-orange-50 text-orange-700" },
  { id: "p1", label: "عاجل جدًا", className: "border-red-200 bg-red-50 text-red-700" },
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
  const isArtContext = activeDeptId === "art" || form.targetDept === "art";
  const showLogoPicker = isArtContext && brandLogos.length > 0;

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
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4"
          onClick={onClose}
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 md:max-h-[calc(100dvh-2rem)] md:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <header className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200 md:hidden" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-1 text-xs font-black text-indigo-600">
                      {activeDept?.nameAr || "مهمة جديدة"}
                    </p>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">إضافة مهمة</h2>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>

              <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black text-gray-500">عنوان المهمة</span>
                    <input
                      ref={titleRef}
                      value={form.title}
                      onChange={(event) => updateForm({ title: event.target.value })}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-base font-black text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      placeholder="مثال: تجهيز تصميم إعلان الحملة"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black text-gray-500">وصف مختصر</span>
                    <textarea
                      value={form.details}
                      onChange={(event) => updateForm({ details: event.target.value })}
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold leading-relaxed text-gray-700 outline-none transition placeholder:text-gray-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      placeholder="اكتب المطلوب بوضوح..."
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <span className="mb-2 block text-xs font-black text-gray-500">تخص مين؟</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => updateForm({ isForSelf: true, targetDept: "" })}
                          className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-black transition ${
                            form.isForSelf
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                              : "border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"
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
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                              : "border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"
                          }`}
                        >
                          <Send size={15} />
                          لجنة أخرى
                        </button>
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-xs font-black text-gray-500">الموعد النهائي</span>
                      <div className="relative">
                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="date"
                          value={form.deadline}
                          onChange={(event) => updateForm({ deadline: event.target.value })}
                          className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-4 pr-11 text-sm font-bold text-gray-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                    </label>
                  </div>

                  {!form.isForSelf && (
                    <label className="block">
                      <span className="mb-2 block text-xs font-black text-gray-500">اللجنة المستلمة</span>
                      <select
                        value={form.targetDept}
                        onChange={(event) => updateForm({ targetDept: event.target.value })}
                        required={!form.isForSelf}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="">اختر اللجنة</option>
                        {DEPARTMENTS.filter((dept) => dept.id !== activeDeptId).map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.nameAr || dept.name}
                          </option>
                        ))}
                      </select>
                      {targetDept && (
                        <p className="mt-2 text-xs font-bold text-indigo-500">سيتم إرسالها إلى {targetDept.nameAr || targetDept.name}</p>
                      )}
                    </label>
                  )}

                  <div>
                    <span className="mb-2 block text-xs font-black text-gray-500">الأولوية</span>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      {PRIORITIES.map((priority) => (
                        <button
                          key={priority.id}
                          type="button"
                          onClick={() => updateForm({ priority: priority.id })}
                          className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-black transition ${
                            form.priority === priority.id ? priority.className : "border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"
                          }`}
                        >
                          <Flag size={13} />
                          {priority.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced((value) => !value)}
                    className="flex w-full items-center justify-between rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm font-black text-gray-600 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    خيارات متقدمة
                    <ChevronDown size={17} className={`transition ${showAdvanced ? "rotate-180" : ""}`} />
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4 rounded-3xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-xs font-black text-gray-500">المسؤول عن التنفيذ</span>
                          <input
                            value={form.performerName}
                            onChange={(event) => updateForm({ performerName: event.target.value })}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            placeholder="اسم الشخص"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-black text-gray-500">تصنيف داخلي</span>
                          <div className="relative">
                            <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                            <input
                              list="task-categories-list"
                              value={form.category}
                              onChange={(event) => updateForm({ category: event.target.value })}
                              className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-4 pr-11 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              placeholder="مثال: تصميمات"
                            />
                            <datalist id="task-categories-list">
                              {existingCategories.map((category) => (
                                <option key={category} value={category} />
                              ))}
                            </datalist>
                          </div>
                        </label>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-xs font-black text-gray-500">تاريخ التنفيذ</span>
                          <input
                            type="date"
                            value={form.executionDate}
                            onChange={(event) => updateForm({ executionDate: event.target.value })}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </label>

                        {projects.length > 0 && (
                          <label className="block">
                            <span className="mb-2 block text-xs font-black text-gray-500">المشروع المرتبط</span>
                            <select
                              value={form.projectId}
                              onChange={(event) => updateForm({ projectId: event.target.value })}
                              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            >
                              <option value="">بدون مشروع</option>
                              {projects.map((project: any) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>

                      {activeDeptId === "educational" && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={form.eduBatchNumber}
                            onChange={(event) => updateForm({ eduBatchNumber: event.target.value })}
                            className="rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            placeholder="رقم الدفعة"
                          />
                          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-black text-indigo-700">
                            <input
                              type="checkbox"
                              checked={form.eduCreateCover}
                              onChange={(event) => updateForm({ eduCreateCover: event.target.checked })}
                              className="h-4 w-4 rounded text-indigo-600"
                            />
                            إنشاء غلاف
                          </label>
                        </div>
                      )}

                      {!form.isForSelf && (
                        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-black text-indigo-700 dark:bg-gray-800">
                          <input
                            type="checkbox"
                            checked={form.isAlsoForSelf}
                            onChange={(event) => updateForm({ isAlsoForSelf: event.target.checked })}
                            className="h-4 w-4 rounded text-indigo-600"
                          />
                          أضف نسخة في لجنة المنشأ أيضًا
                        </label>
                      )}

                      {showLogoPicker && (
                        <div>
                          <div className="mb-3 flex items-center gap-2 text-xs font-black text-gray-500">
                            <ImageIcon size={15} />
                            اللوجوهات المطلوبة
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {brandLogos.map((logo) => (
                              <button
                                key={logo.name}
                                type="button"
                                onClick={() => toggleLogo(logo.name)}
                                className={`relative aspect-square overflow-hidden rounded-2xl border-2 bg-white p-2 transition ${
                                  selectedLogos.includes(logo.name) ? "border-indigo-500 ring-4 ring-indigo-100" : "border-gray-200 opacity-70 hover:opacity-100"
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
                  )}
                </div>
              </main>

              <footer className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <div className="hidden text-xs font-bold text-gray-400 md:block">
                    {form.isForSelf ? "ستضاف لنفس اللجنة" : targetDept ? `ستحول إلى ${targetDept.nameAr || targetDept.name}` : "اختر اللجنة المستلمة"}
                  </div>
                  <div className="mr-auto flex w-full gap-2 md:w-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 rounded-2xl bg-gray-100 px-5 py-3 text-sm font-black text-gray-600 transition hover:bg-gray-200 md:flex-none dark:bg-gray-800 dark:text-gray-300"
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
                      إضافة المهمة
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
