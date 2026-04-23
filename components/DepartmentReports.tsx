
import React, { useState, useEffect, useRef } from "react";
import { db } from "../services/firebase";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, setDoc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { User } from "firebase/auth";
import { 
    ClipboardList, 
    Save, 
    Lock, 
    User as UserIcon, 
    ArrowRight,
    AlertTriangle,
    Lightbulb,
    Unlock,
    X,
    AlignLeft,
    Trash2,
    UserPlus,
    Printer,
    FileText,
    Copy,
    Send,
    UserCog,
    LogIn,
    CheckCircle2,
    Edit,
    RotateCcw,
    Calendar,
    Clock,
    ChevronDown,
    ChevronUp,
    LayoutDashboard,
    History,
    Shield,
    Crown,
    LogOut,
    UserX
} from "lucide-react";

interface DepartmentReportsProps {
  user: User;
  userProfile?: any;
  departments: any[];
  telegramConfig?: any;
  onSendTelegram?: (target: string, text: string, botToken?: string) => void;
}

import { DEPARTMENTS, SUPER_ADMIN_EMAIL } from "../utils/constants";

// --- Report Section Component (Input Mode) ---
const ReportSection = ({ title, icon: Icon, value, onChange, colorClass, placeholder, readOnly, heightClass = "h-32" }: any) => {
    const isNone = value === "لا يوجد";
    // Map colorClass to gradient/text colors
    const colorMap: Record<string, { grad: string; icon: string; bar: string }> = {
        'border-green-500':  { grad: 'from-emerald-50 to-white dark:from-emerald-900/10 dark:to-gray-800', icon: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600', bar: 'bg-emerald-500' },
        'border-blue-500':   { grad: 'from-blue-50 to-white dark:from-blue-900/10 dark:to-gray-800',    icon: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',    bar: 'bg-blue-500'    },
        'border-red-500':    { grad: 'from-rose-50 to-white dark:from-rose-900/10 dark:to-gray-800',    icon: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600',    bar: 'bg-rose-500'    },
        'border-yellow-500': { grad: 'from-amber-50 to-white dark:from-amber-900/10 dark:to-gray-800',  icon: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',  bar: 'bg-amber-500'   },
    };
    const colors = colorMap[colorClass] ?? colorMap['border-blue-500'];

    return (
        <div className={`bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl overflow-hidden shadow-premium border border-gray-100 dark:border-white/5 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 group h-full flex flex-col relative`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${colors.grad} opacity-30`}/>
            <div className="relative z-10 flex flex-col h-full">
            {/* Accent Bar */}
            <div className={`h-1 w-full ${colors.bar} opacity-80`}/>
            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${colors.icon}`}>
                        <Icon size={15}/>
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-sm">{title}</h3>
                </div>
                {!readOnly && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer"
                            checked={isNone}
                            onChange={e => onChange(e.target.checked ? "لا يوجد" : "")}
                        />
                        <span className="text-[10px] font-bold text-gray-400">لا يوجد</span>
                    </label>
                )}
            </div>
            {/* Textarea */}
            <div className="flex-1 px-3 pb-3">
                <textarea
                    readOnly={readOnly || isNone}
                    className={`w-full ${heightClass} p-3 rounded-xl resize-none outline-none transition text-sm leading-relaxed text-gray-800 dark:text-white custom-scrollbar
                        ${readOnly || isNone
                            ? 'bg-transparent border-none placeholder-gray-300'
                            : 'bg-white/80 dark:bg-gray-900/50 border border-transparent focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-300 dark:focus:border-indigo-700 focus:ring-2 focus:ring-indigo-500/10'
                        }`}
                    placeholder={readOnly ? "لا يوجد محتوى" : placeholder}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                />
            </div>
          </div>
        </div>
    );
};

const ReportFormLayout = ({ data, setData, readOnly, selectedDept }: any) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
            <ReportSection 
                title="ما تم إنجازه" 
                icon={CheckCircle2} 
                colorClass="border-green-500" 
                value={data.doneText}
                onChange={(val: string) => setData({...data, doneText: val})}
                placeholder={selectedDept === 'art' ? "• القسم: ... - تم تنفيذ: ..." : "• تم الانتهاء من..."}
                readOnly={readOnly}
            />
            <ReportSection 
                title="الخطة القادمة" 
                icon={AlignLeft} 
                colorClass="border-blue-500" 
                value={data.futureText}
                onChange={(val: string) => setData({...data, futureText: val})}
                placeholder="• سيتم البدء في..."
                readOnly={readOnly}
            />
            <ReportSection 
                title="المشاكل والتحديات" 
                icon={AlertTriangle} 
                colorClass="border-red-500" 
                value={data.problemsText}
                onChange={(val: string) => setData({...data, problemsText: val})}
                placeholder="• واجهتنا مشكلة في..."
                readOnly={readOnly}
            />
            <ReportSection 
                title="الطلبات" 
                icon={Lightbulb} 
                colorClass="border-yellow-500" 
                value={data.suggestionsText}
                onChange={(val: string) => setData({...data, suggestionsText: val})}
                placeholder="• طلب شراء / توفير..."
                readOnly={readOnly}
            />
        </div>
    );
};

const HistoryCard = ({ report, isAuthorized, currentRole, isEditing, editingData, onEdit, onUpdate, onCancel, onDelete, onCopy, onSend, setEditingData, selectedDept }: any) => {
    const [expanded, setExpanded] = useState(true);

    const renderContent = (text: string, fallback: string) => {
        if (!text || text === "لا يوجد") return <span className="text-gray-400 italic text-xs">{fallback}</span>;
        return <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{text}</p>;
    };

    const SectionBlock = ({ title, icon: Icon, color, bgGrad, text }: any) => (
        <div className={`p-4 rounded-xl bg-gradient-to-br ${bgGrad} border border-opacity-50`}>
            <h4 className={`font-bold ${color} flex items-center gap-2 text-xs mb-2 uppercase tracking-wider`}><Icon size={13}/> {title}</h4>
            {renderContent(text, "لا يوجد")}
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300 group">
            {/* Card Header — Gradient */}
            <div className="relative bg-gradient-to-l from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/80 p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-none shrink-0">
                        <Calendar size={18} className="text-white"/>
                    </div>
                    <div>
                        <p className="font-bold text-gray-800 dark:text-white text-sm">{report.dateString}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                            <UserIcon size={10}/> بواسطة: <span className="font-semibold text-gray-600 dark:text-gray-300">{report.managerName}</span>
                            {report.roleLabel && <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold">{report.roleLabel}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {isAuthorized && (
                        isEditing ? (
                            <>
                                <button onClick={onUpdate} className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition">حفظ</button>
                                <button onClick={onCancel} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-xl text-xs font-bold">إلغاء</button>
                            </>
                        ) : (
                            <>
                                <button onClick={onCopy} className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition" title="نسخ"><Copy size={15}/></button>
                                <button onClick={onSend} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="إرسال تيليجرام"><Send size={15}/></button>
                                {currentRole === 'manager' && (
                                    <>
                                        <button onClick={onEdit} className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"><Edit size={15}/></button>
                                        <button onClick={onDelete} className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"><Trash2 size={15}/></button>
                                    </>
                                )}
                            </>
                        )
                    )}
                    <div className={`p-1.5 rounded-lg ${expanded ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'text-gray-400'}`}>
                        {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="p-5">
                    {isEditing
                        ? <ReportFormLayout data={editingData} setData={setEditingData} readOnly={false} selectedDept={selectedDept}/>
                        : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <SectionBlock title="ما تم إنجازه" icon={CheckCircle2} text={report.doneText}    color="text-emerald-700 dark:text-emerald-400" bgGrad="from-emerald-50 to-white dark:from-emerald-900/10 dark:to-gray-800"/>
                            <SectionBlock title="الخطة القادمة" icon={AlignLeft}    text={report.futureText}   color="text-blue-700 dark:text-blue-400"    bgGrad="from-blue-50 to-white dark:from-blue-900/10 dark:to-gray-800"/>
                            <SectionBlock title="المشاكل"       icon={AlertTriangle} text={report.problemsText} color="text-rose-700 dark:text-rose-400"    bgGrad="from-rose-50 to-white dark:from-rose-900/10 dark:to-gray-800"/>
                            <SectionBlock title="الطلبات"       icon={Lightbulb}     text={report.suggestionsText} color="text-amber-700 dark:text-amber-400" bgGrad="from-amber-50 to-white dark:from-amber-900/10 dark:to-gray-800"/>
                        </div>
                    }
                </div>
            )}
        </div>
    );
};

const MonthlyReportCard = ({ report, departments, selectedDept }: any) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-gray-800 rounded-3xl shadow-md border-2 border-indigo-100 dark:border-indigo-900/30 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="p-5 border-b border-indigo-100 dark:border-indigo-900/30 flex justify-between items-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
                        <ClipboardList size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white leading-tight">{report.title}</h3>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1 flex items-center gap-1">
                            <Calendar size={12} /> {report.dateString} • تم تجميع {report.reports?.length || 0} تقارير
                        </p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-700 p-2 rounded-full shadow-sm">
                    {expanded ? <ChevronUp size={20} className="text-indigo-600"/> : <ChevronDown size={20} className="text-indigo-600"/>}
                </div>
            </div>
            
            {expanded && (
                <div className="p-6 space-y-8 animate-fade-in">
                    {report.reports && report.reports.map((subReport: any, index: number) => (
                        <div key={subReport.id} className="relative">
                            {index !== report.reports.length - 1 && (
                                <div className="absolute left-[-15px] top-10 bottom-[-30px] w-0.5 bg-indigo-100 dark:bg-indigo-900/30"></div>
                            )}
                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">التقرير {index + 1}</span>
                                <span className="text-xs text-gray-400">{subReport.dateString}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/50 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                <div className="space-y-1">
                                    <h4 className="text-[10px] font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={12}/> ما تم إنجازه</h4>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{subReport.doneText || "لا يوجد"}</p>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><AlignLeft size={12}/> الخطة القادمة</h4>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{subReport.futureText || "لا يوجد"}</p>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[10px] font-bold text-red-600 flex items-center gap-1"><AlertTriangle size={12}/> المشاكل</h4>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{subReport.problemsText || "لا يوجد"}</p>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[10px] font-bold text-yellow-600 flex items-center gap-1"><Lightbulb size={12}/> الطلبات</h4>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{subReport.suggestionsText || "لا يوجد"}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="pt-4 border-t border-indigo-50 dark:border-indigo-900/20 text-center">
                        <button 
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition"
                        >
                            <Printer size={16} /> طباعة التقرير الشهري
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function DepartmentReports({ user, userProfile, departments, telegramConfig, onSendTelegram }: DepartmentReportsProps) {
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAutoAuthorized, setIsAutoAuthorized] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [deptSettings, setDeptSettings] = useState<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Auth State
  const [authRole, setAuthRole] = useState<'manager' | 'deputy'>('manager');
  const [managerName, setManagerName] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [managerId, setManagerId] = useState(""); // New ID Field
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Current session role
  const [currentRole, setCurrentRole] = useState<'manager' | 'deputy' | null>(null);

  // Report State
  const [view, setView] = useState<'current' | 'history'>('current');
  const [historyReports, setHistoryReports] = useState<any[]>([]);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<any>({});
  const [reportData, setReportData] = useState({ doneText: "", futureText: "", problemsText: "", suggestionsText: "" });
  
  // Monthly Reports State
  const [monthlyReports, setMonthlyReports] = useState<any[]>([]);
  const [historySubView, setHistorySubView] = useState<'daily' | 'monthly'>('daily');

  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  // Auto-select department if user has only one or is assigned to one
  useEffect(() => {
      if (!selectedDept) {
          // If the user has a specific departmentId in their profile and isn't Super Admin, auto-select it
          if (!isSuperAdmin && userProfile?.departmentId) {
              if (departments.some(d => d.id === userProfile.departmentId)) {
                  setSelectedDept(userProfile.departmentId);
              }
          } 
          // Fallback: If only one department exists overall
          else if (departments.length === 1) {
              setSelectedDept(departments[0].id);
          }
      }
  }, [departments, userProfile, isSuperAdmin, selectedDept]);

  // Reset state when changing department
  useEffect(() => {
      setIsAuthorized(false);
      setIsAutoAuthorized(false);
      setDeptSettings(null);
      setShowLogin(false);
      
      setPasswordInput("");
      setManagerName(""); 
      setManagerId("");
      setCurrentRole(null);
      
      let isAuthFound = false;

      if (selectedDept) {
          // Check if userProfile grants access
          if (userProfile && userProfile.departmentId === selectedDept) {
              if (userProfile.role === 'manager' || userProfile.role === 'charity_president') {
                  setIsAuthorized(true);
                  setIsAutoAuthorized(true);
                  setCurrentRole('manager');
                  setManagerName(userProfile.displayName || 'رئيس القسم');
                  isAuthFound = true;
              } else if (userProfile.role === 'deputy' || userProfile.role === 'charity_deputy') {
                  setIsAuthorized(true);
                  setIsAutoAuthorized(true);
                  setCurrentRole('deputy');
                  setManagerName(userProfile.displayName || 'نائب القسم');
                  isAuthFound = true;
              }
          }

          // Check Persistent Auth if not auto-authorized
          if (!isAuthFound) {
              const savedAuth = localStorage.getItem(`ma3wan_dept_auth_${selectedDept}`);
              if (savedAuth) {
                  try {
                      const session = JSON.parse(savedAuth);
                      if (session.loggedIn) {
                          setIsAuthorized(true);
                          setCurrentRole(session.role);
                          setManagerName(session.name);
                          isAuthFound = true;
                      }
                  } catch(e) { }
              }
          }

          // Load Drafts
          const savedDraft = localStorage.getItem(`report_draft_${selectedDept}`);
          if (savedDraft) setReportData(JSON.parse(savedDraft));
          else setReportData({ doneText: "", futureText: "", problemsText: "", suggestionsText: "" });
      }
      
      // Default view: 'current' (Write) if authorized, 'history' (Read) if not
      setView(isAuthFound ? 'current' : 'history');

  }, [selectedDept, userProfile]);

  // Auto-save Draft
  useEffect(() => {
      if (selectedDept && view === 'current') localStorage.setItem(`report_draft_${selectedDept}`, JSON.stringify(reportData));
  }, [reportData, selectedDept, view]);

  // Check Department Settings
  useEffect(() => {
      if (!selectedDept) return;
      const checkSettings = async () => {
          const docSnap = await getDoc(doc(db, "department_settings", selectedDept));
          if (docSnap.exists()) {
              setDeptSettings(docSnap.data());
          } else {
              setDeptSettings(null);
          }
          // Removed Super Admin auto-authorization per user request
      };
      checkSettings();
  }, [selectedDept, isSuperAdmin, showLogin]);

  // Determine mode based on existing settings and selected role
  useEffect(() => {
      if (deptSettings) {
          const roleData = deptSettings[authRole];
          setIsRegistering(!roleData); // Register if no data for this role
      } else {
          setIsRegistering(true); // No doc at all, first time register
      }
  }, [authRole, deptSettings]);

  // Fetch History
  useEffect(() => {
      if (!selectedDept) return;
      const fetchHistory = async () => {
          const q = query(collection(db, "department_reports"), where("deptId", "==", selectedDept));
          const snapshot = await getDocs(q);
          const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          reports.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
          setHistoryReports(reports);
      };
      fetchHistory();
  }, [selectedDept, view, historySubView]);

  // Fetch Monthly History
  useEffect(() => {
    if (!selectedDept || view !== 'history') return;
     const fetchMonthly = async () => {
          const q = query(collection(db, "monthly_reports"), where("deptId", "==", selectedDept));
          const snapshot = await getDocs(q);
          const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          reports.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
          setMonthlyReports(reports);
      };
      fetchMonthly();
  }, [selectedDept, view]);

  const validateName = (name: string) => name.trim().split(/\s+/).length >= 2;

  // Auth Handlers
  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDept || !managerName || !passwordInput) return;
      if (!validateName(managerName)) { alert("الرجاء كتابة الاسم ثنائي على الأقل"); return; }

      // Check if role is already taken in DB (Double check)
      if (deptSettings && deptSettings[authRole]) {
          alert(`يوجد بالفعل ${authRole === 'manager' ? 'مدير' : 'نائب'} مسجل لهذا القسم. يجب أن يقوم بتسجيل الخروج النهائي (إخلاء الطرف) أولاً.`);
          return;
      }

      const newRoleData = { name: managerName, password: passwordInput, id: managerId };
      const updateData: any = {};
      updateData[authRole] = newRoleData;

      try {
          await setDoc(doc(db, "department_settings", selectedDept), updateData, { merge: true });
          // Update local state
          const docSnap = await getDoc(doc(db, "department_settings", selectedDept));
          setDeptSettings(docSnap.data());
          
          setIsAuthorized(true);
          setShowLogin(false);
          setCurrentRole(authRole);
          localStorage.setItem(`ma3wan_dept_auth_${selectedDept}`, JSON.stringify({ loggedIn: true, role: authRole, name: managerName }));
          alert(`تم إنشاء ملف ${authRole === 'manager' ? 'المدير' : 'النائب'} بنجاح`);
      } catch (e: any) { alert("حدث خطأ أثناء الحفظ: " + e.message); }
  };

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (deptSettings) {
           const roleData = deptSettings[authRole]; 
           if (roleData && roleData.password === passwordInput) {
               setIsAuthorized(true);
               setShowLogin(false);
               setCurrentRole(authRole);
               setManagerName(roleData.name);
               localStorage.setItem(`ma3wan_dept_auth_${selectedDept}`, JSON.stringify({ loggedIn: true, role: authRole, name: roleData.name }));
           } else {
               alert(roleData ? "كلمة المرور غير صحيحة" : "لم يتم إعداد بيانات لهذا الدور بعد.");
           }
      } else {
           alert("لم يتم إعداد القسم بعد.");
      }
  };
  
  const handleLogout = () => {
      if (!selectedDept) return;
      localStorage.removeItem(`ma3wan_dept_auth_${selectedDept}`);
      setIsAuthorized(false);
      setManagerName("");
      setCurrentRole(null);
      alert("تم تسجيل الخروج من الجهاز.");
  };

  const handleDeleteProfile = async () => {
      if (!selectedDept || !currentRole) return;
      if (!deptSettings || !deptSettings[currentRole]) {
          alert("أنت مسجل دخولك تلقائياً بحسابك الأساسي. لا يوجد ملف شخصي محلي لحذفه.");
          return;
      }
      if (!window.confirm("هل أنت متأكد من حذف بروفايلك نهائياً؟\nسيسمح هذا لمستخدم آخر بالتسجيل مكانك.")) return;
      
      const confirmPass = prompt("الرجاء إدخال كلمة المرور للتأكيد:");
      if (!confirmPass) return;

      if (deptSettings[currentRole].password !== confirmPass) {
          alert("كلمة المرور غير صحيحة");
          return;
      }

      try {
          // Remove the specific role field from Firestore
          // Note: Firestore update deleteField logic or simpler override
          // Since we can't easily delete a map field with simple merge without special value, we re-set
          
          const newSettings = { ...deptSettings };
          delete newSettings[currentRole];
          
          await setDoc(doc(db, "department_settings", selectedDept), newSettings);
          
          handleLogout(); // Clear local session
          setDeptSettings(newSettings); // Update UI
          alert("تم إخلاء الطرف بنجاح.");
      } catch (e: any) {
          alert("حدث خطأ: " + e.message);
      }
  };

  const saveReport = async () => {
      if (!selectedDept) return;
      if (currentRole !== 'manager') {
          alert("عذراً، كتابة التقارير متاحة لرئيس القسم فقط.");
          return;
      }
      if (!window.confirm("هل أنت متأكد من حفظ التقرير؟")) return;
      try {
          let finalManagerName = managerName || 'عضو الفريق';
          let roleLabel = currentRole === 'manager' ? "رئيس القسم" : "نائب القسم";

          await addDoc(collection(db, "department_reports"), {
              deptId: selectedDept,
              createdAt: Date.now(),
              dateString: new Date().toLocaleDateString('ar-EG'),
              managerName: finalManagerName,
              roleLabel: roleLabel,
              handledInMonthlyReport: false,
              ...reportData
          });
          
          // Check for monthly report (based on un-handled reports only)
          const q = query(
              collection(db, "department_reports"), 
              where("deptId", "==", selectedDept),
              where("handledInMonthlyReport", "!=", true)
          );
          const snapshot = await getDocs(q);
          const count = snapshot.size;

          if (count >= 4) {
              // Get the last 4 unhandled reports
              const unhandledReports = snapshot.docs
                  .map(doc => ({ id: doc.id, ...doc.data() }))
                  .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
                  .slice(0, 4);
              
              const deptName = departments.find(d => d.id === selectedDept)?.name || "القسم";
              
              await addDoc(collection(db, "monthly_reports"), {
                  deptId: selectedDept,
                  createdAt: Date.now(),
                  dateString: new Date().toLocaleDateString('ar-EG'),
                  title: `التقرير الشهري لاجتماعات معوان - ${deptName}`,
                  reports: unhandledReports,
                  managerName: finalManagerName
              });

              // Mark these 4 as handled
              const batch = writeBatch(db);
              unhandledReports.forEach(r => {
                  batch.update(doc(db, "department_reports", r.id), { handledInMonthlyReport: true });
              });
              await batch.commit();

              alert("🎉 تم إصدار التقرير الشهري بنجاح لتجميع آخر 4 تقارير جديدة!");

              // Notify via Telegram about Monthly Report
              if (onSendTelegram && telegramConfig?.rules?.departments) {
                  const rule = telegramConfig.rules.departments[selectedDept || ''];
                  if (rule) {
                      const bot = telegramConfig.bots?.find((b: any) => b.id === rule.botId);
                      const botToken = bot?.token || telegramConfig.defaultBotToken;

                      const recipientIds = [rule.managerId, rule.deputyId].filter(Boolean);
                      const recipientChatIds = recipientIds
                          .map((rid: string) => telegramConfig.people?.find((p: any) => p.id === rid)?.chatId)
                          .filter(Boolean);

                      if (recipientChatIds.length > 0) {
                          const msg = `📅 <b>تم إصدار التقرير الشهري</b>\n📍 القسم: ${deptName}\n👤 بواسطة: ${finalManagerName}\n\n✅ تم تجميع آخر 4 تقارير يومية في ملف واحد باجتماعات معوان.`;
                          recipientChatIds.forEach((chatId: string) => onSendTelegram(chatId, msg, botToken));
                      }
                  }
              }
          }

          localStorage.removeItem(`report_draft_${selectedDept}`);
          setReportData({ doneText: "", futureText: "", problemsText: "", suggestionsText: "" });
          alert("تم حفظ التقرير بنجاح");
          setView('history');
          setHistorySubView('daily');
      } catch (e) { alert("حدث خطأ أثناء الحفظ"); }
  };

  const handleDeleteReport = async (reportId: string) => {
      if (currentRole !== 'manager') { 
          alert("عذراً، حذف التقارير متاح لرئيس القسم فقط."); 
          return; 
      }
      
      const confirm1 = window.confirm("تحذير: هل أنت متأكد تماماً من حذف هذا التقرير؟");
      if (!confirm1) return;
      
      const confirm2 = window.confirm("هذا الإجراء لا يمكن التراجع عنه. هل تريد الاستمرار بالحذف؟");
      if (!confirm2) return;

      try {
          await deleteDoc(doc(db, "department_reports", reportId));
          setHistoryReports(prev => prev.filter(r => r.id !== reportId));
          alert("تم حذف التقرير بنجاح");
      } catch (e: any) { alert("خطأ: " + e.message); }
  };

  const [telegramChatId, setTelegramChatId] = useState("");
  const [isEditingTelegram, setIsEditingTelegram] = useState(false);

  // ... (existing useEffects)

  // Load Telegram ID from settings
  useEffect(() => {
      if (deptSettings && deptSettings.telegramChatId) {
          setTelegramChatId(deptSettings.telegramChatId);
      } else {
          setTelegramChatId("");
      }
  }, [deptSettings]);

  const saveTelegramChatId = async () => {
      if (!selectedDept) return;
      try {
          await updateDoc(doc(db, "department_settings", selectedDept), { telegramChatId: telegramChatId });
          setDeptSettings(prev => ({ ...prev, telegramChatId: telegramChatId }));
          setIsEditingTelegram(false);
          alert("تم حفظ معرف تليجرام بنجاح");
      } catch (e: any) { alert("حدث خطأ: " + e.message); }
  };

  // ... (handleSendToTelegram update)
  const handleSendToTelegram = (report: any) => {
      if (!onSendTelegram || !telegramConfig) {
          alert("خدمة التليجرام غير متوفرة حالياً");
          return;
      }

      // --- NEW RULE-BASED TELEGRAM LOGIC ---
      const rule = telegramConfig.rules?.departments?.[selectedDept || ''];
      if (!rule) {
          alert("لم يتم ضبط قواعد تلقي الإشعارات لهذا القسم في لوحة الأم");
          return;
      }

      const bot = telegramConfig.bots?.find((b: any) => b.id === rule.botId);
      const botToken = bot?.token || telegramConfig.defaultBotToken;

      const recipientIds = [rule.managerId, rule.deputyId].filter(Boolean);
      const recipientChatIds = recipientIds
          .map((rid: string) => telegramConfig.people?.find((p: any) => p.id === rid)?.chatId)
          .filter(Boolean);

      if (recipientChatIds.length === 0) {
          alert("لم يتم تحديد مستلمين لهذا القسم في لوحة الأم");
          return;
      }

      if (!window.confirm("هل تريد إرسال هذا التقرير إلى المسؤولين المحددين؟")) return;

      const reportText = `📊 <b>تقرير ${departments.find(d => d.id === selectedDept)?.name}</b>\n` +
                         `📅 التاريخ: ${report.dateString}\n` +
                         `👤 بواسطة: ${report.managerName} (${report.roleLabel})\n\n` +
                         `✅ <b>ما تم إنجازه:</b>\n${report.doneText || "لا يوجد"}\n\n` +
                         `🚀 <b>الخطة القادمة:</b>\n${report.futureText || "لا يوجد"}\n\n` +
                         `⚠️ <b>المشاكل والتحديات:</b>\n${report.problemsText || "لا يوجد"}\n\n` +
                         `💡 <b>الطلبات:</b>\n${report.suggestionsText || "لا يوجد"}`;

      recipientChatIds.forEach((chatId: string) => {
          onSendTelegram(chatId, reportText, botToken);
      });
      alert("تم الإرسال بنجاح ✅");
  };

  // ... (History Editing & Export functions mostly same as before) ...
  const handleHistoryEdit = (report: any) => {
      setEditingReportId(report.id);
      setEditingData({ doneText: report.doneText, futureText: report.futureText, problemsText: report.problemsText, suggestionsText: report.suggestionsText });
  };
  const handleHistoryUpdate = async () => {
      if (!editingReportId) return;
      if (currentRole !== 'manager') {
          alert("عذراً، تعديل التقارير متاح لرئيس القسم فقط.");
          return;
      }
      await updateDoc(doc(db, "department_reports", editingReportId), { ...editingData });
      setHistoryReports(prev => prev.map(r => r.id === editingReportId ? { ...r, ...editingData } : r));
      setEditingReportId(null);
  };
  const formatReportText = () => { 
      const deptName = departments.find(d => d.id === selectedDept)?.name;
      const date = new Date().toLocaleDateString('ar-EG');
      const roleLabel = currentRole === 'manager' ? "رئيس القسم" : currentRole === 'deputy' ? "نائب القسم" : "عضو";
      
      return `📊 *تقرير ${deptName}*\n📅 التاريخ: ${date}\n👤 بواسطة: ${managerName} (${roleLabel})\n\n` +
             `✅ *ما تم إنجازه:*\n${reportData.doneText || "لا يوجد"}\n\n` +
             `🚀 *الخطة القادمة:*\n${reportData.futureText || "لا يوجد"}\n\n` +
             `⚠️ *المشاكل والتحديات:*\n${reportData.problemsText || "لا يوجد"}\n\n` +
             `💡 *الطلبات:*\n${reportData.suggestionsText || "لا يوجد"}`;
  };
  const formatSpecificReport = (report: any) => {
      const deptName = departments.find(d => d.id === selectedDept)?.name;
      return `📊 *تقرير ${deptName}*\n📅 التاريخ: ${report.dateString}\n👤 بواسطة: ${report.managerName} (${report.roleLabel})\n\n` +
             `✅ *ما تم إنجازه:*\n${report.doneText || "لا يوجد"}\n\n` +
             `🚀 *الخطة القادمة:*\n${report.futureText || "لا يوجد"}\n\n` +
             `⚠️ *المشاكل والتحديات:*\n${report.problemsText || "لا يوجد"}\n\n` +
             `💡 *الطلبات:*\n${report.suggestionsText || "لا يوجد"}`;
  };

  const handleCopyText = () => { navigator.clipboard.writeText(formatReportText()); alert("تم النسخ!"); };
  const handlePrintPDF = () => { window.print(); };

  if (!selectedDept) {
      return (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 animate-fade-in-up">
              {departments.map(dept => (
                  <button key={dept.id} onClick={() => setSelectedDept(dept.id)} className={`${dept.bgClass} text-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-lg md:shadow-xl hover:scale-105 transition flex flex-col items-center justify-center gap-2 md:gap-4 min-h-[120px] md:min-h-[200px] relative overflow-hidden group`}>
                      <div className="absolute top-0 right-0 w-full h-full bg-black/10 group-hover:bg-transparent transition"></div>
                      <dept.icon size={28} className="relative z-10 md:w-12 md:h-12" />
                      <span className="font-bold text-sm md:text-xl relative z-10 text-center leading-tight">{dept.name}</span>
                  </button>
              ))}
          </div>
      );
  }

  // --- Auth Modal (Unified) ---
  if (showLogin) {
      const roleLabel = authRole === 'manager' ? (selectedDept === 'hr' ? 'المدير العام (HR)' : 'رئيس القسم') : (selectedDept === 'hr' ? 'عضو/نائب (HR)' : 'نائب القسم');
      const modalTitle = isRegistering ? `إعداد بيانات ${roleLabel}` : `دخول ${roleLabel}`;
      const btnText = isRegistering ? "حفظ البيانات" : "دخول";

      return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] animate-fade-in-up">
                {/* Gradient Header */}
                <div className={`relative p-6 pb-14 overflow-hidden ${authRole === 'manager' ? 'bg-gradient-to-br from-indigo-600 to-purple-700' : 'bg-gradient-to-br from-blue-600 to-cyan-700'}`}>
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"/>
                    <button onClick={() => setShowLogin(false)} className="absolute top-4 left-4 w-8 h-8 bg-white/20 hover:bg-white/30 flex items-center justify-center rounded-full transition text-white">
                        <X size={16}/>
                    </button>
                    <div className="text-center">
                        <div className="w-16 h-16 bg-white/20 border-2 border-white/40 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white shadow-xl">
                            {authRole === 'manager' ? <Crown size={30}/> : <Shield size={30}/>}
                        </div>
                        <h2 className="text-lg font-black text-white">{modalTitle}</h2>
                        <p className="text-white/70 text-xs mt-1">{departments.find(d => d.id === selectedDept)?.name}</p>
                    </div>
                </div>

                <div className="-mt-8 mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 border border-gray-100 dark:border-gray-700">
                    {/* Role Switcher */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-5">
                        <button onClick={() => setAuthRole('manager')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${authRole === 'manager' ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-white' : 'text-gray-500'}`}><Crown size={14}/> {selectedDept === 'hr' ? 'المدير العام' : 'رئيس القسم'}</button>
                        <button onClick={() => setAuthRole('deputy')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${authRole === 'deputy' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-white' : 'text-gray-500'}`}><Shield size={14}/> {selectedDept === 'hr' ? 'عضو / نائب' : 'نائب القسم'}</button>
                    </div>

                    <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-3">
                        {isRegistering ? (
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">الاسم</label>
                                <input className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm" value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="الاسم الثنائي..." required/>
                            </div>
                        ) : (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl text-center">
                                <p className="text-xs text-gray-400 mb-0.5">مرحباً بـ</p>
                                <p className="font-bold text-indigo-700 dark:text-indigo-300">{deptSettings?.[authRole]?.name}</p>
                            </div>
                        )}
                        {isRegistering && <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">المعرف / ID (اختياري)</label>
                            <input className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white outline-none text-sm focus:ring-2 focus:ring-indigo-500" value={managerId} onChange={e => setManagerId(e.target.value)} placeholder="رقم وظيفي / كود"/>
                        </div>}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">كلمة المرور</label>
                            <input type="password" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white outline-none text-sm focus:ring-2 focus:ring-indigo-500" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} required placeholder="••••••"/>
                        </div>
                        <button className={`w-full text-white py-3 rounded-xl font-bold hover:opacity-90 shadow-lg transition text-sm ${authRole === 'manager' ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-gradient-to-r from-blue-600 to-cyan-600'}`}>{btnText}</button>
                    </form>
                    <p className="text-center text-[10px] text-gray-400 mt-3">{isRegistering ? 'إعداد لأول مرة (المقعد فارغ)' : 'المقعد محجوز'}</p>
                </div>
                <div className="h-4"/>
            </div>
          </div>
      );
  }

  return (
    <div className="animate-fade-in-up pb-24">
        {/* Reports Header */}
        <div id="reports-header" className="relative overflow-hidden bg-gradient-to-l from-indigo-600/10 via-white to-white dark:from-indigo-900/20 dark:via-gray-800 dark:to-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl shadow-sm mb-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button onClick={() => setSelectedDept(null)} className="p-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition text-gray-600 dark:text-white shadow-sm">
                        <ArrowRight size={18}/>
                    </button>
                    <div>
                        <h2 className="font-black text-lg text-gray-800 dark:text-white flex items-center gap-2">
                            {departments.find(d => d.id === selectedDept)?.name}
                            {isSuperAdmin && <span className="bg-gradient-to-r from-red-500 to-pink-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black">Admin</span>}
                        </h2>
                        <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                            {isAuthorized
                                ? <><span className={`w-2 h-2 rounded-full inline-block ${currentRole === 'manager' ? 'bg-indigo-500' : 'bg-blue-500'}`}/> {managerName} ({currentRole === 'manager' ? 'رئيس' : 'نائب'})</>
                                : <><span className="w-2 h-2 rounded-full bg-gray-400 inline-block"/> يجب تسجيل الدخول</>}
                        </p>
                    </div>
                </div>
                <div id="reports-actions" className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
                    {!isAuthorized && (
                        <button onClick={() => setShowLogin(true)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${ selectedDept === 'hr' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40' }`}>
                            {selectedDept === 'hr' ? <><UserPlus size={15}/> دخول HR</> : deptSettings ? <><LogIn size={15}/> تسجيل دخول</> : <><Unlock size={15}/> إعداد المدير</>}
                        </button>
                    )}
                    {isAuthorized && view === 'current' && (
                        <div className="flex gap-1 bg-gray-50 dark:bg-gray-700/50 p-1 rounded-xl">
                            {currentRole === 'manager' && <button onClick={() => setShowLogin(true)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-indigo-600" title="إدارة الصلاحيات"><UserCog size={16}/></button>}
                            <button onClick={handlePrintPDF} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200" title="طباعة"><Printer size={16}/></button>
                            <button onClick={handleCopyText} className="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/20 text-emerald-600" title="نسخ النص"><Copy size={16}/></button>
                            {!isAutoAuthorized && (
                                <>
                                    <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200" title="خروج"><LogOut size={16}/></button>
                                    <button onClick={handleDeleteProfile} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 border border-red-100 dark:border-red-900/30 bg-white dark:bg-gray-800 ml-1" title="إخلاء الطرف"><UserX size={16}/></button>
                                </>
                            )}
                        </div>
                    )}
                    <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
                        <button onClick={() => setView('current')} className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${view === 'current' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500'}`}>
                            <LayoutDashboard size={13}/> {isAuthorized ? 'كتابة' : 'المسودة'}
                        </button>
                        <button onClick={() => setView('history')} className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${view === 'history' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500'}`}>
                            <History size={13}/> الأرشيف
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {view === 'current' ? (
            <div className="space-y-4 md:space-y-6 relative" ref={reportRef}>
                {!isAuthorized && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 flex items-center gap-3 text-blue-800 dark:text-blue-200 mb-4 shadow-sm">
                        <Lock size={20} className="shrink-0" />
                        <span className="text-xs md:text-sm font-bold leading-relaxed">أنت في وضع العرض فقط. لعرض التقارير السابقة، انتقل إلى "أرشيف التقارير".</span>
                    </div>
                )}
                {isAuthorized && <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 mb-2"><Save size={12}/> المسودة محفوظة محلياً</div>}
            <ReportFormLayout data={reportData} setData={setReportData} readOnly={!isAuthorized} selectedDept={selectedDept}/>
                {isAuthorized && (
                    <div className="sticky bottom-6 flex flex-col items-center gap-3 pt-4 z-20">
                        <button
                            onClick={saveReport}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-3.5 rounded-2xl font-black hover:opacity-90 shadow-2xl shadow-indigo-500/40 flex items-center gap-3 text-sm transition transform hover:scale-[1.03] border-2 border-white/20"
                        >
                            <Save size={18}/> حفظ واعتماد التقرير
                        </button>
                        <p className="text-[10px] text-gray-400 bg-white/90 dark:bg-gray-800/90 px-4 py-1.5 rounded-full backdrop-blur-sm shadow-sm border border-gray-100 dark:border-gray-700">
                            <Save size={10} className="inline ml-1"/> المسودة محفوظة محلياً تلقائياً
                        </p>
                    </div>
                )}
            </div>
        ) : (
            <div className="space-y-6">
                <div className="flex justify-center mb-6">
                    <div className="bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl flex gap-1 shadow-inner border border-gray-200 dark:border-gray-800">
                        <button 
                            onClick={() => setHistorySubView('daily')}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2 ${historySubView === 'daily' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <FileText size={16}/> التقارير اليومية
                        </button>
                        <button 
                            onClick={() => setHistorySubView('monthly')}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2 ${historySubView === 'monthly' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-none scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Calendar size={16}/> التقارير الشهرية
                        </button>
                    </div>
                </div>

                {historySubView === 'daily' ? (
                    historyReports.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2rem]">
                           <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-full mb-4"><ClipboardList size={48} className="text-gray-400" /></div>
                           <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300">لا يوجد سجل تقارير يومية</h3>
                           {isAuthorized && <button onClick={() => setView('current')} className="mt-6 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition">إنشاء تقرير جديد</button>}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {historyReports.map((report) => (
                                <HistoryCard key={report.id} report={report} isAuthorized={isAuthorized} currentRole={currentRole} isEditing={editingReportId === report.id} editingData={editingData} setEditingData={setEditingData} onEdit={() => handleHistoryEdit(report)} onUpdate={handleHistoryUpdate} onCancel={() => setEditingReportId(null)} onDelete={() => handleDeleteReport(report.id)} onCopy={() => { navigator.clipboard.writeText(formatSpecificReport(report)); alert("تم نسخ التقرير!"); }} onSend={() => handleSendToTelegram(report)} selectedDept={selectedDept} />
                            ))}
                        </div>
                    )
                ) : (
                    monthlyReports.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up border-2 border-dashed border-indigo-100 dark:border-indigo-900/30 rounded-[2rem] bg-indigo-50/10">
                           <div className="bg-indigo-50 dark:bg-indigo-900/30 p-6 rounded-full mb-4"><Calendar size={48} className="text-indigo-400" /></div>
                           <h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-300">لا توجد تقارير شهرية بعد</h3>
                           <p className="text-xs text-gray-500 mt-2">يتم إصدار تقرير شهري تلقائياً كل 4 تقارير يومية مكتملة</p>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-fade-in-up">
                            <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg mb-6 flex items-center gap-3">
                                <ClipboardList size={20} />
                                <span className="text-sm font-bold">يتم تجميع التقارير الأربعة الأخيرة في تقرير اجتماعات موحد</span>
                            </div>
                            {monthlyReports.map((report) => (
                                <MonthlyReportCard key={report.id} report={report} departments={departments} selectedDept={selectedDept} />
                            ))}
                        </div>
                    )
                )}
            </div>
        )}
    </div>
  );
}
