import { DEPARTMENTS } from "./constants";

const firstValue = (data: any, keys: string[]) => {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
};

const listValue = (data: any, keys: string[]) => {
  const value = firstValue(data, keys);
  if (Array.isArray(value)) return value.filter(Boolean).join("، ");
  return value;
};

const escapeHtml = (value: any) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

const formatLine = (label: string, value: any) => `• <b>${label}:</b> ${escapeHtml(value || "-")}`;

export const getSubmissionCreatedMs = (data: any) => {
  const value = firstValue(data, ["createdAt", "submittedAt", "timestamp", "created_at", "date"]);
  if (!value) return null;
  if (typeof value === "number") return value;
  if (value?.seconds) return value.seconds * 1000;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

export const normalizeDepartmentId = (raw: any) => {
  const section = String(raw || "").trim();
  if (!section) return "general";

  const exact = DEPARTMENTS.find((dept) => (
    dept.id === section ||
    dept.nameAr === section ||
    dept.name === section
  ));
  if (exact) return exact.id;

  const lower = section.toLowerCase();
  if (lower.includes("art") || section.includes("إخراج") || section.includes("اخراج") || section.includes("فني")) return "art";
  if (lower.includes("education") || section.includes("تعليم")) return "educational";
  if (lower.includes("medical") || section.includes("طبي")) return "medical";
  if (lower.includes("dawah") || lower.includes("daawa") || section.includes("دعوي") || section.includes("دعوة")) return "dawah";
  if (lower.includes("charity") || section.includes("خيري")) return "charity";
  if (lower.includes("blood") || section.includes("أحياها") || section.includes("احياها")) return "waman_ahyaaha";
  return section;
};

export const normalizeVolunteerSubmission = (
  id: string,
  data: any,
  source: "current" | "legacy",
  collectionName: string
) => {
  const rawSection = firstValue(data, [
    "section",
    "departmentId",
    "department",
    "committee",
    "team",
    "desiredDepartment",
    "targetDept",
    "selectedDepartment"
  ]);

  const createdAt = firstValue(data, ["createdAt", "submittedAt", "timestamp", "created_at", "date"]);

  return {
    ...data,
    id,
    name: firstValue(data, ["name", "fullName", "displayName", "applicantName", "studentName"]),
    email: firstValue(data, ["email", "mail"]),
    phone: firstValue(data, ["phone", "phoneNumber", "mobile", "whatsapp", "whatsApp"]),
    age: firstValue(data, ["age", "studentAge"]),
    gender: firstValue(data, ["gender", "sex", "type"]),
    university: firstValue(data, ["university", "college", "school"]),
    faculty: firstValue(data, ["faculty", "collegeName", "major", "studyField"]),
    governorate: firstValue(data, ["governorate", "province", "city", "addressGovernorate"]),
    year: firstValue(data, ["year", "academicYear", "grade", "studyYear", "academicLevel"]),
    skills: listValue(data, ["skills", "selectedSkills", "abilities", "talents"]),
    telegramUsername: firstValue(data, ["telegramUsername", "telegramUserName", "telegram", "telegramId", "userName", "username"]),
    referralSource: firstValue(data, ["referralSource", "howDidYouKnow", "howKnow", "knownFrom", "source"]),
    reason: firstValue(data, ["reason", "motivation", "whyJoin", "joinReason", "message"]),
    experience: firstValue(data, ["experience", "experiences", "previousExperience", "workExperience", "about", "bio", "summary"]),
    pdfUrl: firstValue(data, ["pdfUrl", "cvUrl", "resumeUrl", "fileUrl", "attachmentUrl"]),
    section: normalizeDepartmentId(rawSection),
    rawSection,
    createdAt,
    createdAtMs: getSubmissionCreatedMs(data) || 0,
    source,
    collectionName
  };
};

export const getVolunteerSubmissionRows = (submission: any) => ([
  ["الاسم ثنائي", submission.name],
  ["رقم الواتساب", submission.phone],
  ["السن", submission.age],
  ["النوع", submission.gender],
  ["الجامعة", submission.university],
  ["الكلية / الجامعة", submission.faculty],
  ["المحافظة", submission.governorate],
  ["الفرقة الدراسية", submission.year],
  ["المهارات", submission.skills],
  ["معرف تيليجرام", submission.telegramUsername],
  ["كيف تعرفت على معاون؟", submission.referralSource],
  ["لماذا تود الانضمام للفريق؟", submission.reason],
  ["نبذة عنك", submission.experience],
  ["السيرة الذاتية (PDF)", submission.pdfUrl],
  ["تاريخ التقديم", submission.createdAt]
]);

export const formatVolunteerSubmissionForTelegram = (submission: any, departmentName: string) => {
  const rows = getVolunteerSubmissionRows(submission).filter(([label]) => label !== "تاريخ التقديم");
  const lines = [
    `🔔 <b>طلب تطوع جديد لقسم ${escapeHtml(departmentName)}</b>`,
    ...rows
      .filter(([label, value]) => label !== "السيرة الذاتية (PDF)" || value)
      .map(([label, value]) => {
        if (label === "السيرة الذاتية (PDF)") {
          return `• <b>${label}:</b> <a href="${escapeHtml(value)}">تحميل PDF</a>`;
        }
        return formatLine(label, value);
      })
  ];

  return lines.join("\n");
};

export const sortVolunteerSubmissions = (items: any[]) => {
  return [...items].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
};
