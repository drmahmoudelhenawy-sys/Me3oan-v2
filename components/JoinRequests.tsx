import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { Users, Mail, Calendar, Loader2, FileText, X, Download, FileSpreadsheet, Phone, School, Briefcase, Trash2 } from "lucide-react";
import { DEPARTMENTS } from "../utils/constants";
import { User } from 'firebase/auth';
import * as XLSX from 'xlsx';

const JOIN_DEPARTMENTS = DEPARTMENTS.filter(d => d.id !== 'hr' && d.id !== 'management');

interface JoinRequestsProps {
    user: User;
    userProfile?: any;
}

export default function JoinRequests({ user, userProfile }: JoinRequestsProps) {
    const hasFullAccess = userProfile?.controlAccess === 'full' || userProfile?.canViewAllVolunteers;
    
    // Determine the initial department to show
    const getInitialDept = () => {
        if (hasFullAccess) return 'all';
        return userProfile?.departmentId || (JOIN_DEPARTMENTS[0]?.id || 'all');
    };

    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(getInitialDept());
    const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

    useEffect(() => {
        const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSubmissions(subs);
            setLoading(false);


        });

        return () => unsubscribe();
    }, []);

    const handleExport = () => {
        const dataToExport = filteredSubmissions.map(s => ({
            'الاسم': s.name,
            'البريد الإلكتروني': s.email,
            'رقم الهاتف': s.phone,
            'الجامعة': s.university,
            'الكلية': s.faculty,
            'السنة الدراسية': s.year,
            'سبب الانضمام': s.reason,
            'الخبرات السابقة': s.experience,
            'تاريخ التقديم': formatDate(s.createdAt),
            'رابط الـPDF': s.pdfUrl
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "طلبات التطوع");
        XLSX.writeFile(wb, `طلبات_تطوع_${activeTab}_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
    };

    const formatDate = (val: any) => {
        if (!val?.seconds) return "-";
        return new Date(val.seconds * 1000).toLocaleString('ar-EG', { dateStyle: 'medium' });
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`هل أنت متأكد من حذف طلب ${name}؟`)) {
            try {
                await deleteDoc(doc(db, "submissions", id));
            } catch (error) {
                console.error("Error deleting document: ", error);
                alert("حدث خطأ أثناء الحذف");
            }
        }
    };

    const filteredSubmissions = activeTab === 'all' 
        ? submissions 
        : submissions.filter(s => {
            if (s.section === activeTab) return true;
            const dept = JOIN_DEPARTMENTS.find(d => d.id === activeTab);
            if (!dept) return false;
            // Check for exact match on ID, NameAr, Name, or partial match if it's educational
            return s.section === dept.nameAr || s.section === dept.name || s.section === dept.id || 
                   (dept.id === 'educational' && (s.section.includes('تعليم') || s.section.toLowerCase().includes('education')));
        });

    return (
        <div className="animate-fade-in-up space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2"><Users className="text-indigo-600" /> طلبات التطوع</h2>
                    <p className="text-gray-500 text-sm mt-1">عرض وتصدير الطلبات المستلمة</p>
                </div>
                <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700">
                    <FileSpreadsheet size={16} /> تصدير Excel
                </button>
            </div>

            {hasFullAccess ? (
                <div className="flex flex-wrap gap-2 p-2 bg-gray-100 dark:bg-gray-900 rounded-full">
                    <button onClick={() => setActiveTab('all')} className={`px-4 py-2 text-sm font-bold rounded-full transition ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>الكل</button>
                    {JOIN_DEPARTMENTS.map(dept => (
                        <button key={dept.id} onClick={() => setActiveTab(dept.id)} className={`px-4 py-2 text-sm font-bold rounded-full transition ${activeTab === dept.id ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>
                            {dept.nameAr}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">أنت تظهر طلبات قسم:</span>
                    <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
                        {DEPARTMENTS.find(d => d.id === userProfile?.departmentId)?.nameAr || userProfile?.departmentId || "غير محدد"}
                    </span>
                </div>
            )}
            <div className="overflow-x-auto rounded-[2rem] bg-white dark:bg-gray-800 shadow-sm border">
                <table className="w-full text-right min-w-[800px]">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs font-bold uppercase">
                        <tr>
                            <th className="px-6 py-4">الاسم</th>
                            <th className="px-6 py-4">الجامعة</th>
                            <th className="px-6 py-4">السيرة الذاتية (PDF)</th>
                            <th className="px-6 py-4">وقت الإرسال</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredSubmissions.map((req) => (
                            <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                <td className="px-6 py-4">
                                    <p className="font-bold">{req.name || "-"}</p>
                                    <p className="text-xs text-gray-500">{req.email || "-"}</p>
                                </td>
                                <td className="px-6 py-4 text-sm"><p>{req.university || "-"}</p></td>
                                <td className="px-6 py-4">
                                    {req.pdfUrl ? (
                                        <a href={req.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full hover:bg-red-200">
                                            <Download size={12} /> تحميل السيرة الذاتية
                                        </a>
                                    ) : (
                                        <span className="text-xs text-gray-400">لا يوجد ملف</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500"><Calendar size={14} className="inline ml-1"/>{formatDate(req.createdAt)}</td>
                                <td className="px-6 py-4 flex items-center gap-2">
                                    <button onClick={() => setSelectedSubmission(req)} className="px-3 py-1 text-xs font-bold bg-indigo-100 text-indigo-700 rounded-full">عرض التفاصيل</button>
                                    <button onClick={() => handleDelete(req.id, req.name)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition" title="حذف الطلب">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedSubmission && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedSubmission(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 space-y-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-2xl">تفاصيل الطلب</h3>
                            <button onClick={() => setSelectedSubmission(null)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><X/></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl"><Users className="text-indigo-500" size={20}/><div><p className="font-bold">الاسم</p><p>{selectedSubmission.name}</p></div></div>
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl"><Mail className="text-indigo-500" size={20}/><div><p className="font-bold">البريد</p><p>{selectedSubmission.email}</p></div></div>
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl"><Phone className="text-indigo-500" size={20}/><div><p className="font-bold">الهاتف</p><p>{selectedSubmission.phone}</p></div></div>
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl"><School className="text-indigo-500" size={20}/><div><p className="font-bold">الجامعة/الكلية</p><p>{`${selectedSubmission.university} - ${selectedSubmission.faculty}`}</p></div></div>
                            <div className="md:col-span-2 flex items-start gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl"><FileText className="text-indigo-500 mt-1" size={20}/><div><p className="font-bold">لماذا تريد الانضمام؟</p><p className="whitespace-pre-wrap">{selectedSubmission.reason}</p></div></div>
                            <div className="md:col-span-2 flex items-start gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl"><Briefcase className="text-indigo-500 mt-1" size={20}/><div><p className="font-bold">الخبرات السابقة</p><p className="whitespace-pre-wrap">{selectedSubmission.experience}</p></div></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}