import { DEPARTMENTS } from "./constants";

const firstValue = (data: any, keys: string[]) => {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
};

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
    university: firstValue(data, ["university", "college", "school"]),
    faculty: firstValue(data, ["faculty", "major", "studyField"]),
    year: firstValue(data, ["year", "academicYear", "grade"]),
    reason: firstValue(data, ["reason", "motivation", "whyJoin", "joinReason", "message"]),
    experience: firstValue(data, ["experience", "experiences", "skills", "previousExperience"]),
    pdfUrl: firstValue(data, ["pdfUrl", "cvUrl", "resumeUrl", "fileUrl", "attachmentUrl"]),
    section: normalizeDepartmentId(rawSection),
    rawSection,
    createdAt,
    createdAtMs: getSubmissionCreatedMs(data) || 0,
    source,
    collectionName
  };
};

export const sortVolunteerSubmissions = (items: any[]) => {
  return [...items].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
};
