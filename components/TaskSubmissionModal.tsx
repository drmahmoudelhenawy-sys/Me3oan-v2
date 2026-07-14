import React, { useState, useRef, DragEvent } from "react";
import { X, Upload, FileText, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { uploadToCloudinary } from "../services/cloudinary";
import toast from "react-hot-toast";

interface TaskSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  onSubmit: (message: string, uploadedFiles: any[]) => Promise<void>;
}

export default function TaskSubmissionModal({
  isOpen,
  onClose,
  task,
  onSubmit
}: TaskSubmissionModalProps) {
  const [message, setMessage] = useState("");
  const [filesToUpload, setFilesToUpload] = useState<Array<{
    id: string;
    file: File;
    progress: number;
    status: 'idle' | 'uploading' | 'success' | 'error';
    result?: any;
  }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = () => {
    if (fileInputRef.current?.files) {
      addFiles(Array.from(fileInputRef.current.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const updated = newFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'idle' as const
    }));
    setFilesToUpload(prev => [...prev, ...updated]);
  };

  const removeFile = (id: string) => {
    if (isSubmitting) return;
    setFilesToUpload(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const uploadPromises = filesToUpload.map(async (item, idx) => {
        if (item.status === 'success') return item.result;

        // Update status to uploading
        setFilesToUpload(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));

        try {
          const result = await uploadToCloudinary(item.file, (progress) => {
            setFilesToUpload(prev => prev.map(f => f.id === item.id ? { ...f, progress } : f));
          });

          setFilesToUpload(prev => prev.map(f => f.id === item.id ? { ...f, status: 'success', result } : f));
          return result;
        } catch (err) {
          setFilesToUpload(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f));
          throw err;
        }
      });

      const uploadedMetadata = await Promise.all(uploadPromises);
      await onSubmit(message, uploadedMetadata);
      toast.success("تم تسليم التصميم بنجاح!");
      setMessage("");
      setFilesToUpload([]);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء رفع الملفات، يرجى المحاولة مرة أخرى");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-black text-slate-800 dark:text-white">تسليم المهمة: {task?.title}</h3>
          <button onClick={onClose} disabled={isSubmitting} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          
          {/* Text Message */}
          <div className="space-y-1.5 text-right">
            <label className="text-xs font-black text-slate-500 dark:text-slate-400">ملاحظات أو رسالة التسليم (اختياري)</label>
            <textarea
              className="w-full h-24 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="اكتب هنا أي تفاصيل أو ملاحظات بخصوص الملفات المسلمة..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              className="hidden"
              disabled={isSubmitting}
            />
            <Upload size={32} className="text-indigo-500 mb-3" />
            <p className="text-sm font-black text-slate-700 dark:text-slate-200">اسحب الملفات وأفلتها هنا لتسليمها</p>
            <p className="text-xs text-slate-400 mt-1 font-bold">أو اضغط لاختيار الملفات من جهازك</p>
          </div>

          {/* Uploading / File List */}
          {filesToUpload.length > 0 && (
            <div className="space-y-2 text-right">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400">الملفات المختارة للتسليم ({filesToUpload.length})</label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {filesToUpload.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800 rounded-2xl"
                  >
                    <FileText size={20} className="text-indigo-500 shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{item.file.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold shrink-0">{(item.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                      
                      {/* Progress bar or status indicators */}
                      {item.status === 'uploading' && (
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full transition-all duration-150" style={{ width: `${item.progress}%` }}></div>
                        </div>
                      )}
                      {item.status === 'success' && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 size={11} />
                          <span>تم الرفع بنجاح</span>
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
                          <AlertCircle size={11} />
                          <span>فشل الرفع، يرجى إعادة المحاولة</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(item.id);
                      }}
                      disabled={isSubmitting}
                      className="text-slate-400 hover:text-rose-500 transition shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting || filesToUpload.length === 0}
              className="flex-1 bg-indigo-600 text-white font-black text-xs py-3 rounded-2xl shadow-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "جاري رفع وتسليم الملفات..." : "تسليم الآن"}
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
      </div>
    </div>
  );
}
