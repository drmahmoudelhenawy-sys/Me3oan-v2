import { Crown, BookOpen, Stethoscope, Megaphone, Heart, PenTool, Users, Activity, Flag, AlertCircle, CheckCircle, Clock } from "lucide-react";

export const SUPER_ADMIN_EMAIL = "dr.mahmoud.elhenawy@gmail.com";
export const TELEGRAM_BOT_TOKEN = (import.meta as any).env?.VITE_TELEGRAM_BOT_TOKEN || "";

export const DEPARTMENTS = [
  // Special Department: Senior Management
  { 
    id: "management", 
    name: "الإدارة العليا", 
    nameAr: "الإدارة العليا",
    icon: Crown, 
    bgClass: "bg-gradient-to-br from-slate-900 via-slate-800 to-black border-2 border-yellow-500/50 shadow-yellow-500/20", 
    textClass: "text-yellow-500", 
    description: "التخطيط الاستراتيجي والقرارات التنفيذية", 
    stats: "مجلس الإدارة", 
    primaryColor: "text-yellow-500",
    isSpecial: true
  },
  { id: "educational", name: "القسم التعليمي", nameAr: "القسم التعليمي", icon: BookOpen, bgClass: "bg-yellow-400", textClass: "text-yellow-900", description: "المحتوى الأكاديمي والمراجعات", stats: "المحاضرات", primaryColor: "text-yellow-600" },
  { id: "medical", name: "القسم الطبي", nameAr: "القسم الطبي", icon: Stethoscope, bgClass: "bg-pink-500", textClass: "text-white", description: "القوافل الطبية والتوعية الصحية", stats: "الرعاية الصحية", primaryColor: "text-pink-600" },
  { id: "dawah", name: "القسم الدعوي", nameAr: "القسم الدعوي", icon: Megaphone, bgClass: "bg-purple-500", textClass: "text-white", description: "الأنشطة الدينية وتحفيظ القرآن", stats: "الدعوة", primaryColor: "text-purple-600" },
  { id: "charity", name: "القسم الخيري", nameAr: "القسم الخيري", icon: Heart, bgClass: "bg-blue-500", textClass: "text-white", description: "المساعدات الاجتماعية والزيارات", stats: "العمل الخيري", primaryColor: "text-blue-600" },
  { id: "art", name: "الإخراج الفني", nameAr: "الإخراج الفني", icon: PenTool, bgClass: "bg-green-400", textClass: "text-white", description: "التصميم والمونتاج والديكور", stats: "الفن والتصميم", primaryColor: "text-green-600" },
  { id: "hr", name: "الموارد البشرية", nameAr: "الموارد البشرية", icon: Users, bgClass: "bg-orange-400", textClass: "text-white", description: "إدارة المتطوعين والهيكل الإداري", stats: "الموارد البشرية", primaryColor: "text-orange-600" },
  { id: "waman_ahyaaha", name: "ومن أحياها", nameAr: "ومن أحياها", icon: Activity, bgClass: "bg-red-500", textClass: "text-white", description: "بنك الدم والطوارئ", stats: "بنك الدم", primaryColor: "text-red-600" },
];

export const TELEGRAM_ROLES = [
    { id: "super_admin", name: "👑 المدير العام / المالك" },
    { id: "announcement_channel", name: "📢 قناة الإعلانات العامة" },
    { id: "distress_channel", name: "🚨 قناة الاستغاثات (ومن أحياها)" },
    ...DEPARTMENTS.map(d => ({ id: d.id, name: `مدير/عضو ${d.name}` }))
];

export const USER_ROLES = [
    { id: 'member', name: 'عضو' },
    { id: 'deputy', name: 'نائب مسؤول' },
    { id: 'manager', name: 'مدير' }
];

export const CHARITY_ROLES = [
    { id: 'charity_member', name: 'عضو' },
    { id: 'charity_president', name: 'رئيس' },
    { id: 'charity_deputy', name: 'نائب' },
    { id: 'charity_clothing_manager', name: 'مسؤول كساء' },
    { id: 'charity_feeding_manager', name: 'مسؤول اطعام' },
    { id: 'charity_individual_cases', name: 'مسؤول حالات فردية' }
];

export const TASK_STATUSES = {
  TODO: 'todo',
  PENDING_ACCEPTANCE: 'pending_acceptance',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  BLOCKED: 'blocked',
  COMPLETED: 'completed'
};

export const PROJECT_CATEGORIES = [
  { id: 'campaign', nameAr: 'حملة تسويقية', icon: 'Megaphone' },
  { id: 'event', nameAr: 'فعالية/حدث', icon: 'Calendar' },
  { id: 'production', nameAr: 'إنتاج مرئي/مسموع', icon: 'Video' },
  { id: 'admin', nameAr: 'تطوير إداري', icon: 'Settings' }
];

export const HANDOFF_STATUSES = {
  PENDING: 'pending_acceptance',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  REVISION: 'revision_requested'
};

export const WORKFLOW_TEMPLATES = {
  PRODUCTION_FLOW: [
    { deptId: 'educational', title: 'كتابة السيناريو والمحتوى', stage: 1 },
    { deptId: 'art', title: 'المونتاج والإخراج الفني', stage: 2 },
    { deptId: 'general', title: 'المراجعة والاعتماد النهائي', stage: 3 },
    { deptId: 'pr', title: 'النشر والتوزيع', stage: 4 }
  ]
};

export const PRIORITIES: Record<string, any> = {
  p1: { label: "P1", labelAr: "P1 - عاجل جداً", color: "bg-red-100 text-red-800 border-red-200", icon: Flag },
  p2: { label: "P2", labelAr: "P2 - هام", color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertCircle },
  p3: { label: "P3", labelAr: "P3 - عادي", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle },
  p4: { label: "P4", labelAr: "P4 - منخفض", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Clock },
  urgent: { label: "عاجل", labelAr: "عاجل", color: "bg-red-100 text-red-800 border-red-200", icon: Flag },
  high: { label: "هام", labelAr: "هام", color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertCircle },
  normal: { label: "عادي", labelAr: "عادي", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle },
  low: { label: "منخفض", labelAr: "منخفض", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Clock },
};
