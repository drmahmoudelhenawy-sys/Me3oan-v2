import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { Download, ExternalLink, Eye, FileText, Image as ImageIcon, Video, FolderArchive, Calendar, User, X, Copy, Trash2, MoreVertical } from "lucide-react";
import toast from "react-hot-toast";

interface TaskAttachmentsProps {
  taskId: string;
  collName: "tasks" | "requests";
  userProfile: any;
}

export default function TaskAttachments({ taskId, collName, userProfile }: TaskAttachmentsProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewingFile, setPreviewingFile] = useState<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || !collName) return;
    const q = query(
      collection(db, collName, taskId, "files"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFiles(docs);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [taskId, collName]);

  // Group files by Submission Version
  const groupedFiles = files.reduce((acc: any, file) => {
    const versionNum = file.submissionVersion || 1;
    const versionStr = `التسليم ${versionNum} (Submission ${versionNum})`;
    if (!acc[versionStr]) {
      acc[versionStr] = [];
    }
    acc[versionStr].push(file);
    return acc;
  }, {});

  const getFileIcon = (format: string, resourceType: string) => {
    const fmt = format?.toLowerCase();
    if (resourceType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fmt)) {
      return <ImageIcon size={22} className="text-blue-500 shrink-0" />;
    }
    if (resourceType === 'video' || ['mp4', 'webm', 'mov', 'avi'].includes(fmt)) {
      return <Video size={22} className="text-indigo-500 shrink-0" />;
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(fmt)) {
      return <FolderArchive size={22} className="text-amber-500 shrink-0" />;
    }
    return <FileText size={22} className="text-slate-500 shrink-0" />;
  };

  const isPreviewable = (format: string, resourceType: string) => {
    const fmt = format?.toLowerCase();
    return (
      resourceType === 'image' ||
      resourceType === 'video' ||
      ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm'].includes(fmt)
    );
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط الملف بنجاح!");
    setActiveMenuId(null);
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الملف؟")) return;
    try {
      await deleteDoc(doc(db, collName, taskId, "files", fileId));
      toast.success("تم حذف الملف بنجاح");
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء حذف الملف");
    }
    setActiveMenuId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 font-bold text-xs animate-pulse">
        جاري تحميل الملفات...
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-16 opacity-30 text-slate-400">
        <FileText size={48} className="mx-auto mb-2" />
        <p className="text-xs font-bold">لا توجد ملفات مرفقة أو مسلمة لهذه المهمة حتى الآن</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {Object.keys(groupedFiles).map((versionKey) => (
        <div key={versionKey} className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <span className="w-1.5 h-3 rounded bg-indigo-600"></span>
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-350">{versionKey}</h4>
            {groupedFiles[versionKey].some((f: any) => f.isFinal) && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">النسخة النهائية معتمدة</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groupedFiles[versionKey].map((file: any) => {
              const format = file.format?.toLowerCase() || "";
              const previewable = isPreviewable(format, file.resourceType);

              return (
                <div
                  key={file.id}
                  className="flex flex-col justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:shadow-md transition duration-200 relative"
                >
                  
                  {/* File Metadata & Icon */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      {getFileIcon(format, file.resourceType)}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate" title={file.originalFilename}>
                          {file.originalFilename}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5 font-mono">
                          {format.toUpperCase()} • {(file.bytes / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    {/* Action Dropdown Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === file.id ? null : file.id)}
                        className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {activeMenuId === file.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)}></div>
                          <div className="absolute left-0 mt-1 w-36 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-1 rounded-xl shadow-lg z-40 text-right">
                            {previewable && (
                              <button
                                onClick={() => {
                                  setPreviewingFile(file);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-right px-2.5 py-1.5 text-[10px] font-bold text-slate-650 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 rounded-lg flex items-center gap-1.5"
                              >
                                <Eye size={12} /> معاينة
                              </button>
                            )}
                            <a
                              href={file.secureUrl}
                              download={file.originalFilename}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full text-right px-2.5 py-1.5 text-[10px] font-bold text-slate-650 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 rounded-lg flex items-center gap-1.5"
                            >
                              <Download size={12} /> تحميل
                            </a>
                            <button
                              onClick={() => handleCopyLink(file.secureUrl)}
                              className="w-full text-right px-2.5 py-1.5 text-[10px] font-bold text-slate-650 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 rounded-lg flex items-center gap-1.5"
                            >
                              <Copy size={12} /> نسخ الرابط
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="w-full text-right px-2.5 py-1.5 text-[10px] font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg flex items-center gap-1.5"
                            >
                              <Trash2 size={12} /> حذف الملف
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail / Image Preview */}
                  {(file.resourceType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(format)) && (
                    <div className="mt-3 aspect-video w-full rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                      <img
                        src={file.secureUrl}
                        alt={file.originalFilename}
                        className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition duration-300"
                        onClick={() => setPreviewingFile(file)}
                      />
                    </div>
                  )}

                  {/* User Upload Details */}
                  <div className="mt-3 pt-2 border-t border-slate-50 dark:border-slate-850/80 flex items-center justify-between text-[9px] text-slate-400 font-bold">
                    <span className="flex items-center gap-1">
                      <User size={10} />
                      {file.uploadedBy || 'مصمم'}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar size={10} />
                      {file.createdAt?.toDate ? file.createdAt.toDate().toLocaleDateString('en-CA') : ''}
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Preview Dialog */}
      {previewingFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setPreviewingFile(null)}>
          <div className="relative max-w-4xl w-full max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden flex flex-col p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewingFile(null)}
              className="absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition"
            >
              <X size={18} />
            </button>

            <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
              {(() => {
                const format = previewingFile.format?.toLowerCase();
                const type = previewingFile.resourceType;

                if (type === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(format)) {
                  return (
                    <img
                      src={previewingFile.secureUrl}
                      alt={previewingFile.originalFilename}
                      className="max-w-full max-h-[70vh] object-contain rounded-2xl"
                    />
                  );
                }
                if (type === 'video' || ['mp4', 'webm', 'mov'].includes(format)) {
                  return (
                    <video
                      src={previewingFile.secureUrl}
                      controls
                      autoPlay
                      className="max-w-full max-h-[70vh] rounded-2xl outline-none"
                    />
                  );
                }
                if (format === 'pdf') {
                  return (
                    <iframe
                      src={previewingFile.secureUrl}
                      title={previewingFile.originalFilename}
                      className="w-full h-[70vh] rounded-2xl border-0"
                    />
                  );
                }
                return (
                  <div className="text-center py-12 text-slate-400">
                    لا تتوفر معاينة مباشرة لهذا الملف.
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate pr-4">
                {previewingFile.originalFilename}
              </span>
              <a
                href={previewingFile.secureUrl}
                download={previewingFile.originalFilename}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition shrink-0"
              >
                <Download size={14} />
                تحميل الملف
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
