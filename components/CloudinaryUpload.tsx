import React, { useState, useRef, DragEvent } from "react";
import { Upload, X, CheckCircle2, AlertCircle, RefreshCw, Trash2, FileText } from "lucide-react";
import { uploadToCloudinary } from "../services/cloudinary";
import toast from "react-hot-toast";

interface CloudinaryUploadProps {
  onUploadComplete: (uploadedFiles: any[]) => void;
  onUploadStart?: () => void;
  maxSizeMB?: number;
}

export interface UploadFileItem {
  id: string;
  file: File;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  result?: any;
}

const BLOCKED_EXTENSIONS = ["exe", "bat", "dll", "js", "sh", "com", "msi"];

const compressImageFile = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 1200;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const compressedFile = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now()
          });
          resolve(compressedFile);
        }, "image/jpeg", 0.75);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};


export default function CloudinaryUpload({
  onUploadComplete,
  onUploadStart,
  maxSizeMB = 100
}: CloudinaryUploadProps) {
  const [filesList, setFilesList] = useState<UploadFileItem[]>([]);
  const [compressImages, setCompressImages] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const validateFile = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase() || "";
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      toast.error(`الملف "${file.name}" غير مسموح بروعه لأسباب أمنية.`);
      return false;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`الملف "${file.name}" يتجاوز الحد الأقصى للحجم (${maxSizeMB}MB).`);
      return false;
    }
    return true;
  };

  const addFiles = async (newFiles: File[]) => {
    const validFiles = newFiles.filter(validateFile);
    if (validFiles.length === 0) return;

    // Apply compression if enabled
    const processedFiles = await Promise.all(
      validFiles.map(async (file) => {
        if (compressImages && file.type.startsWith("image/")) {
          const loadingToast = toast.loading(`جاري ضغط وتقليل حجم "${file.name}"...`);
          try {
            const compressed = await compressImageFile(file);
            toast.success(`تم ضغط "${file.name}" بنجاح!`, { id: loadingToast });
            return compressed;
          } catch (e) {
            toast.error(`فشل ضغط "${file.name}"، سيتم الرفع بالحجم الأصلي.`, { id: loadingToast });
            return file;
          }
        }
        return file;
      })
    );

    // Filter duplicates by name and size to prevent double submit
    const currentNames = filesList.map(f => `${f.file.name}_${f.file.size}`);
    const filtered = processedFiles.filter(file => !currentNames.includes(`${file.name}_${file.size}`));

    if (filtered.length === 0) {
      toast.error("هذه الملفات مضافة بالفعل.");
      return;
    }

    const items: UploadFileItem[] = filtered.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'idle'
    }));

    setFilesList(prev => [...prev, ...items]);
    triggerUploads(items);
  };

  const triggerUploads = async (items: UploadFileItem[]) => {
    onUploadStart?.();
    const uploadPromises = items.map(item => uploadFile(item));
    try {
      const results = await Promise.all(uploadPromises);
      const successful = results.filter(Boolean);
      if (successful.length > 0) {
        onUploadComplete(successful);
      }
    } catch (e) {
      console.error("Some files failed to upload", e);
    }
  };

  const uploadFile = async (item: UploadFileItem) => {
    setFilesList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));
    try {
      const result = await uploadToCloudinary(item.file, (progress) => {
        setFilesList(prev => prev.map(f => f.id === item.id ? { ...f, progress } : f));
      });
      setFilesList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'success', result } : f));
      return result;
    } catch (err) {
      setFilesList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f));
      return null;
    }
  };

  const retryUpload = async (id: string) => {
    const item = filesList.find(f => f.id === id);
    if (!item) return;
    const result = await uploadFile(item);
    if (result) {
      onUploadComplete([result]);
    }
  };

  const removeFile = (id: string) => {
    setFilesList(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-4 w-full">
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer transition text-center ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20'
            : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 bg-slate-50/30'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          className="hidden"
        />
        <Upload size={28} className="text-indigo-500 mb-2" />
        <p className="text-xs font-black text-slate-700 dark:text-slate-200">اسحب الملفات وأفلتها هنا للرفع</p>
        <p className="text-[10px] text-slate-400 mt-0.5 font-bold">أو اضغط لاختيار الملفات (الحد الأقصى {maxSizeMB}MB)</p>
      </div>

      {/* Compress image checkbox */}
      <div className="flex items-center gap-2 justify-end px-2 text-[10px] md:text-xs">
        <label className="text-slate-500 dark:text-slate-400 font-black cursor-pointer select-none" htmlFor="compress_images_cb">
          تقليل حجم وجودة الصور تلقائياً (سرعة رفع أعلى للمعاينة)
        </label>
        <input
          id="compress_images_cb"
          type="checkbox"
          checked={compressImages}
          onChange={(e) => setCompressImages(e.target.checked)}
          className="w-4 h-4 cursor-pointer rounded border-slate-350 accent-indigo-650"
        />
      </div>

      {/* Files progress list */}
      {filesList.length > 0 && (
        <div className="space-y-2 pr-1 max-h-40 overflow-y-auto custom-scrollbar">
          {filesList.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-white border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800 rounded-2xl shadow-sm text-right"
              dir="rtl"
            >
              <FileText size={18} className="text-indigo-500 shrink-0" />
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{item.file.name}</span>
                  <span className="text-[9px] text-slate-400 font-bold shrink-0">{(item.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                
                {item.status === 'uploading' && (
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full transition-all duration-150" style={{ width: `${item.progress}%` }}></div>
                  </div>
                )}
                {item.status === 'success' && (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                    <CheckCircle2 size={10} />
                    <span>تم الرفع بنجاح</span>
                  </div>
                )}
                {item.status === 'error' && (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-rose-600">
                    <AlertCircle size={10} />
                    <span>فشل الرفع</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.status === 'error' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      retryUpload(item.id);
                    }}
                    className="text-indigo-600 hover:text-indigo-700 transition p-1 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                    title="إعادة المحاولة"
                  >
                    <RefreshCw size={12} className="animate-spin-hover" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(item.id);
                  }}
                  className="text-slate-400 hover:text-rose-500 transition p-1 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                  title="حذف"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
