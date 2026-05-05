
import React, { useState, useEffect, useRef } from "react";
import { User, signOut } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { recruitmentDb } from "../services/recruitmentFirebase";
import { 
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, 
  where, getDoc, getDocs, setDoc, orderBy, limit, writeBatch, arrayUnion, serverTimestamp 
} from "firebase/firestore";
import { 
  LayoutDashboard, Calendar, FileText, Settings, LogOut, 
  MessageCircle, Menu, X, Bell, Network, Palette, Activity, 
  Briefcase, UserPlus, Users, ClipboardList, Megaphone, CheckCircle2, AlertCircle, Clock, ArrowLeft, Table as TableIcon, Home, ArrowUpRight, Radio, Edit, Trash2,
  ChevronDown, PanelLeft, Plus, Search, Inbox, LayoutGrid, Hash, BarChart2, ShieldCheck, Sun, Moon, Droplet
} from "lucide-react";


import TaskBoard from "./TaskBoard";
import ChatSystem from "./ChatSystem";
import CalendarSystem from "./CalendarSystem";
import DepartmentReports from "./DepartmentReports";
import IdentitySystem from "./IdentitySystem";
import JoinRequests from "./JoinRequests";
import AdminTable from "./AdminTable";
import OrgStructureSystem from "./OrgStructureSystem";
import UserManagement from "./UserManagement";
import WamanAhyaahaSystem from "./WamanAhyaahaSystem";
import TaskPulseDrawer from "./TaskPulseDrawer";
import AddTaskModal from "./AddTaskModal";
import HelpModal from "./HelpModal";
import TelegramMotherPanel from "./TelegramMotherPanel";
import ControlCenter from "./ControlCenter";

import { 
    WelcomeModal, UserManagementModal, CustomizeDashboardModal, 
    SettingsModal, ForwardTaskModal, 
    CreateEventModal, TelegramConfigModal, ProfileSetupModal, HRProfileModal 
} from "./DashboardModals";
import { DEPARTMENTS, SUPER_ADMIN_EMAIL, CHARITY_ROLES, USER_ROLES } from "../utils/constants";
import { TRANSLATIONS } from "../utils/translations";
import {
  resolveDepartmentLeadership,
  resolveMeetingAnnouncementRoute,
  resolveMeetingRoute,
  resolveVolunteerRoute,
  sendTelegramToChatIds,
  type TelegramNotifyMode
} from "../utils/telegramRouting";
import { getSubmissionCreatedMs, normalizeVolunteerSubmission } from "../utils/volunteerSubmissions";
import toast, { Toaster } from 'react-hot-toast';

const DEFAULT_MEETING_REMINDERS = [2880, 1440, 60, 30];

const normalizeMeetingReminders = (reminders?: number[]) =>
  Array.from(new Set((reminders || DEFAULT_MEETING_REMINDERS).map(Number).filter((value) => value > 0)))
    .sort((a, b) => b - a);

const getDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getReminderKey = (occurrence: Date, reminderMinutes: number) => {
  const hours = String(occurrence.getHours()).padStart(2, "0");
  const minutes = String(occurrence.getMinutes()).padStart(2, "0");
  return `${getDateKey(occurrence)}T${hours}:${minutes}|${reminderMinutes}`;
};

const formatReminderLead = (minutes: number) => {
  if (minutes % 1440 === 0) return `${minutes / 1440} يوم`;
  if (minutes % 60 === 0) return `${minutes / 60} ساعة`;
  return `${minutes} دقيقة`;
};

// New Interfaces for Telegram Configuration
interface TelegramContact {
  name: string;
  chatId: string;
  role?: string;
}

interface TelegramDepartmentContacts {
  departmentId: string;
  contacts: TelegramContact[];
}

interface TelegramWamanAhyaahaContacts {
  type: 'donor' | 'distress';
  contacts: TelegramContact[];
}

interface AppTelegramConfig {
  generalContacts: TelegramDepartmentContacts[];
  volunteerContacts: TelegramDepartmentContacts[];
  wamanAhyaahaContacts: TelegramWamanAhyaahaContacts[];
}

interface DashboardProps {
  user: User;
  telegramConfig?: any;
  onSendTelegram?: (target: string, text: string, botToken?: string) => void;
  accessLevel?: 'full' | 'charity_restricted';
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export default function Dashboard({ user, telegramConfig, onSendTelegram, accessLevel = 'full', darkMode, setDarkMode }: DashboardProps) {
  const [currentView, setCurrentView] = useState("overview"); // Default to Overview
  const [adminSubView, setAdminSubView] = useState<'table' | 'structure'>('table'); // Sub-view for General Admin
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [taskFilter, setTaskFilter] = useState<'inbox' | 'today' | 'upcoming' | 'delayed' | 'projects' | 'all'>('all');
  const [isAddingTaskGlobal, setIsAddingTaskGlobal] = useState(false);
  const [newTaskDefaults, setNewTaskDefaults] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [deptSettings, setDeptSettings] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // Special Login State
  const [specialLoginPassword, setSpecialLoginPassword] = useState<string | null>(null);
  const [showMyDeptOnly, setShowMyDeptOnly] = useState(false);
  
  const filteredDepartments = DEPARTMENTS.filter(dept => {
      // Admin has full access
      if (user.email === SUPER_ADMIN_EMAIL) {
          if (showMyDeptOnly) return dept.id === userProfile?.departmentId || dept.id === 'general';
          return true;
      }
      
      // Special Login Logic
      if (specialLoginPassword === 'Me3oan2026') {
          return dept.id === userProfile?.departmentId || dept.id === 'general';
      }
      
      // Default: Restrict to user's own department + general + granted management
      const isOwnDept = dept.id === userProfile?.departmentId;
      const isGeneral = dept.id === 'general';
      const isManagementGranted = dept.id === 'management' && userProfile?.canAccessSeniorManagement;
      
      return isOwnDept || isGeneral || isManagementGranted;
  });
  
  useEffect(() => {
      const password = localStorage.getItem('special_login_password');
      if (password) {
          setSpecialLoginPassword(password);
      }
  }, [userProfile]);

  // Profile Setup State
  const [profileSetup, setProfileSetup] = useState({ name: "", departmentId: "", role: "member" });
  
  // Task Board State
  const [newTask, setNewTask] = useState<any>({ title: "", details: "", deadline: "", priority: "p4", targetDept: "", assignedToName: "", category: "", performerName: "" });
  const [eduType, setEduType] = useState('note');
  const [eduData, setEduData] = useState({ subjectName: "", noteType: "", batchNumber: "", requestType: "" });
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Modals State
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showTelegramConfig, setShowTelegramConfig] = useState(false);
  
  // HR Specific State
  const [showHRModal, setShowHRModal] = useState(false);
  const [hrTempName, setHrTempName] = useState("");
  const [hrProfileData, setHrProfileData] = useState<any>(null); // Store current HR session data

  const [tempName, setTempName] = useState("");
  const [editProfileName, setEditProfileName] = useState("");
  
  // Forward Modal State
  const [forwardModal, setForwardModal] = useState({ isOpen: false, task: null, targetDept: "" });
  const [forwardNote, setForwardNote] = useState("");
  const [forwardMemberName, setForwardMemberName] = useState("");

  // Event Modal State
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState<any>({ 
      id: "", title: "", date: "", time: "", type: "offline", link: "", details: "", 
      isRecurring: false, recurrenceDay: 'Thursday',
      notificationSettings: { enabled: true, includeTime: true, includeLocation: true, includeDetails: true, reminders: DEFAULT_MEETING_REMINDERS },
      sendImmediateNotification: true 
  });
  
  // Telegram Contact State
  const [widgets, setWidgets] = useState([
      { id: 'tasks', label: 'المهام', visible: true },
      { id: 'calendar', label: 'التقويم', visible: true },
      { id: 'reports', label: 'التقارير', visible: true }
  ]);

  const t = TRANSLATIONS['ar'];
  const isMagicSession = localStorage.getItem('ma3wan_magic_session') === 'true';
  const isSuperAdmin = (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) || isMagicSession;
  
  const isCharityRestricted = (userProfile?.departmentId === 'charity' && CHARITY_ROLES.some(r => r.id === userProfile.role)) || accessLevel === 'charity_restricted';

  useEffect(() => {
      if (!userProfile?.departmentId || isSuperAdmin || currentView !== 'overview') return;
      if (DEPARTMENTS.some(dept => dept.id === userProfile.departmentId)) {
          setCurrentView(userProfile.departmentId);
          setTaskFilter('all');
      }
  }, [userProfile?.departmentId, isSuperAdmin, currentView]);

  const getDeptRuleMeta = (deptId: string) => {
      const rule = telegramConfig?.rules?.departments?.[deptId] || {};
      const deputyIds = Array.isArray(rule?.deputyIds)
          ? rule.deputyIds
          : (rule?.deputyId ? [rule.deputyId] : []);
      const route = resolveDepartmentLeadership(telegramConfig, deptId, 'manager_and_deputy');
      return { rule, botToken: route.botToken, deputyIds };
  };

  const getDeptLeadershipRecipients = (deptId: string, mode: TelegramNotifyMode = 'manager_and_deputy') => {
      return resolveDepartmentLeadership(telegramConfig, deptId, mode).chatIds;
  };

  const sendToAllDeptLeadership = (message: string) => {
      if (!onSendTelegram || !telegramConfig?.rules?.departments) return;
      Object.keys(telegramConfig.rules.departments).forEach((deptId: string) => {
          const route = resolveDepartmentLeadership(telegramConfig, deptId, 'manager_and_deputy');
          sendTelegramToChatIds(onSendTelegram, route.chatIds, message, route.botToken);
      });
  };

  const truncateForTelegram = (text: string, maxLen = 220) => {
      const t = (text || "").replace(/\s+/g, " ").trim();
      if (!t) return "";
      return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
  };

  useEffect(() => {
      if (isCharityRestricted) {
          const allowedViews = ['charity'];
          if (userProfile?.role === 'charity_president' || userProfile?.role === 'charity_deputy') {
              allowedViews.push('reports');
          }
          if (!allowedViews.includes(currentView)) {
              setCurrentView('charity');
          }
      }
  }, [isCharityRestricted, currentView, userProfile?.role]);

  // --- Effects ---
  // (تذكيرات الاجتماعات: يُستخدم المؤقت أدناه الذي يقرأ كل سجلات management_meetings لتفادي التكرار وعدم تفويت الاجتماعات)

  useEffect(() => {
      // Load User Profile
      const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              setUserProfile(data);
              
              // Check for force logout
              if (data.forceLogout) {
                  updateDoc(doc(db, "users", user.uid), { forceLogout: false });
                  signOut(auth);
              }

              setEditProfileName(data.displayName || "");
              if (!data.displayName || !data.departmentId || !data.role) {
                  console.log("User profile incomplete. Showing ProfileSetupModal.");
                  setProfileSetup({ 
                    name: data.displayName || "", 
                    departmentId: data.departmentId || "", 
                    role: data.role || "member" 
                  });
                  setShowNameModal(true);
              } else {
                  setShowNameModal(false);
              }
          } else {
              console.log("User document does not exist. Showing ProfileSetupModal.");
              setShowNameModal(true);
          }
      });

      // Load Tasks
      const qTasks = query(collection(db, "tasks"));
      const unsubTasks = onSnapshot(qTasks, (snapshot) => {
          const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTasks(tasksData);
          setLoading(false);
      });

      // Load Announcements (Management Meetings)
      const qAnnouncements = query(collection(db, "management_meetings"), orderBy("createdAt", "desc"), limit(5));
      const unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAnnouncements(data);
      });

      // Load Widgets Preference
      const savedWidgets = localStorage.getItem('ma3wan_dashboard_widgets');
      if (savedWidgets) setWidgets(JSON.parse(savedWidgets));

      // Show Welcome once
      if (!localStorage.getItem("ma3wan_welcome_shown")) {
          setShowWelcome(true);
          localStorage.setItem("ma3wan_welcome_shown", "true");
      }

      // ── Subscribe to Projects ──
      const projectsQuery = query(collection(db, "projects"), orderBy("created_at", "desc"));
      const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
          setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // ── Subscribe to Dept Settings ──
      let unsubSettings: any = null;
      if (userProfile?.departmentId) {
          unsubSettings = onSnapshot(doc(db, "department_settings", userProfile.departmentId), (docSnap) => {
              if (docSnap.exists()) setDeptSettings(docSnap.data());
          });
      }

      return () => { 
        unsubUser(); 
        unsubTasks(); 
        unsubAnnouncements(); 
        unsubProjects(); 
        if (unsubSettings) unsubSettings();
      };
  }, [user.uid, userProfile?.departmentId]);

  // Listen for new join requests (Submissions)
  useEffect(() => {
    // Listen to 'submissions' collection instead of 'join_requests'
    const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && onSendTelegram && !change.doc.metadata.fromCache && telegramConfig?.rules) {
          const rawData = change.doc.data();
          const data = normalizeVolunteerSubmission(change.doc.id, rawData, "current", "submissions");
          
          // Avoid processing old documents on initial load (check if created within last minute)
          const createdAt = data.createdAtMs || (rawData.createdAt?.seconds ? rawData.createdAt.seconds * 1000 : Date.now());
          if (Date.now() - createdAt > 60000) return;

          // Display toast notification for new request
          toast.success(`طلب انضمام جديد من: ${data.name}`,
            {
              icon: '🚀',
              style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
              }
            }
          );

          // Map section name to ID if necessary
          let targetDeptId = data.section;
          const deptObj = DEPARTMENTS.find(d => d.nameAr === data.rawSection || d.name === data.rawSection || d.id === data.rawSection || d.id === data.section);
          if (deptObj) targetDeptId = deptObj.id;

          // --- NEW RULE-BASED TELEGRAM LOGIC ---
          if (telegramConfig?.rules) {
              const volunteerRoute = resolveVolunteerRoute(telegramConfig, targetDeptId);
              if (volunteerRoute.chatIds.length > 0) {
                  // Get Bot Token
                  const botToken = volunteerRoute.botToken;

                  // Get Recipient Chat IDs
                  const recipientChatIds = volunteerRoute.chatIds;

                  if (recipientChatIds.length > 0) {
                      let msg = `🔔 <b>طلب تطوع جديد لقسم ${deptObj?.nameAr || targetDeptId}</b>\n`;
                      msg += `👤 <b>الاسم:</b> ${data.name}\n`;
                      msg += `📱 <b>الهاتف:</b> ${data.phone}\n`;
                      msg += `🎓 <b>الجامعة:</b> ${data.university} - ${data.faculty}\n`;
                      msg += `📝 <b>السبب:</b> ${data.reason}\n`;
                      if (data.pdfUrl) msg += `📄 <b>السيرة الذاتية:</b> <a href="${data.pdfUrl}">تحميل PDF</a>`;

                      sendTelegramToChatIds(onSendTelegram, recipientChatIds, msg, botToken);
                  }
              } else {
                  console.warn("No Telegram volunteer recipients resolved", {
                      targetDeptId,
                      rawSection: data.rawSection,
                      volunteerRules: telegramConfig?.rules?.volunteers,
                      people: telegramConfig?.people
                  });
              }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [telegramConfig, onSendTelegram]);

  useEffect(() => {
    if (!onSendTelegram || !telegramConfig?.rules) return;

    const notifyLegacyVolunteer = (rawData: any, docId: string, collectionName: string) => {
        const createdAt = getSubmissionCreatedMs(rawData);
        if (!createdAt || Date.now() - createdAt > 60000) return;

        const data = normalizeVolunteerSubmission(docId, rawData, "legacy", collectionName);
        const targetDeptId = data.section || "general";
        const deptObj = DEPARTMENTS.find(d => d.id === targetDeptId || d.nameAr === data.rawSection || d.name === data.rawSection);
        const volunteerRoute = resolveVolunteerRoute(telegramConfig, targetDeptId);
        if (!volunteerRoute.chatIds.length) return;

        toast.success(`طلب انضمام جديد من الموقع القديم: ${data.name || "متطوع جديد"}`, {
            icon: '🚀',
            style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });

        let msg = `🔔 <b>طلب تطوع جديد لقسم ${deptObj?.nameAr || targetDeptId}</b>\n`;
        msg += `👤 <b>الاسم:</b> ${data.name || "-"}\n`;
        msg += `📱 <b>الهاتف:</b> ${data.phone || "-"}\n`;
        msg += `🎓 <b>الجامعة:</b> ${data.university || "-"}${data.faculty ? ` - ${data.faculty}` : ""}\n`;
        msg += `📝 <b>السبب:</b> ${data.reason || "-"}\n`;
        if (data.pdfUrl) msg += `📄 <b>السيرة الذاتية:</b> <a href="${data.pdfUrl}">تحميل PDF</a>`;
        sendTelegramToChatIds(onSendTelegram, volunteerRoute.chatIds, msg, volunteerRoute.botToken);
    };

    const sources = [
        { collectionName: "join_requests", queryRef: query(collection(recruitmentDb, "join_requests")) },
        { collectionName: "submissions", queryRef: query(collection(recruitmentDb, "submissions")) }
    ];

    const unsubscribers = sources.map((source) => onSnapshot(source.queryRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" && !change.doc.metadata.fromCache) {
                notifyLegacyVolunteer(change.doc.data(), change.doc.id, source.collectionName);
            }
        });
    }, (error) => {
        console.warn(`Unable to listen to legacy volunteer source ${source.collectionName}`, error);
    }));

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [telegramConfig, onSendTelegram]);


  // HR Profile Check
  useEffect(() => {
      if (currentView === 'hr') {
          const hrProfile = localStorage.getItem("ma3wan_hr_profile");
          if (!hrProfile) {
              setShowHRModal(true);
              setHrProfileData(null);
          } else {
              setHrProfileData(JSON.parse(hrProfile));
          }
      }
  }, [currentView]);

  // --- AUTO REMINDER SYSTEM (Interval Check) ---
  useEffect(() => {
      const checkReminders = async () => {
          // Runs every minute to check if any meeting needs a reminder
          const now = new Date();
          
          try {
              // 1. Check One-time events (reminderSent == false)
              const snapshot = await getDocs(query(collection(db, "management_meetings"))); 
              
              snapshot.docs.forEach(async (docSnap) => {
                  const data = docSnap.data();
                  if (data.notificationSettings && data.notificationSettings.enabled === false) return;

                  // A. Recurring Events Logic
                  if (data.isRecurring && data.recurrenceDay && data.time) {
                      const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      const targetDayIndex = DAYS.indexOf(data.recurrenceDay);
                      if (targetDayIndex === -1) return;

                      const todayIndex = now.getDay();
                      let daysUntil = targetDayIndex - todayIndex;
                      if (daysUntil < 0) daysUntil += 7;
                      
                      const nextOccurrence = new Date(now);
                      nextOccurrence.setDate(now.getDate() + daysUntil);
                      const [hours, minutes] = data.time.split(':');
                      nextOccurrence.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                      
                      // If calculated occurrence is in the past (e.g. earlier today), it means next one is next week
                      // BUT, if it's earlier today, we might still be in the "reminder window" if the window is large?
                      // No, reminders are usually "before". If event passed, we look to next week.
                      // However, if we are checking at 10:00 AM for a 10:30 AM event today, daysUntil is 0.
                      
                      if (nextOccurrence < now) {
                          nextOccurrence.setDate(nextOccurrence.getDate() + 7);
                      }

                      if (data.date) {
                          const startOccurrence = new Date(`${data.date}T${data.time}`);
                          while (nextOccurrence < startOccurrence) {
                              nextOccurrence.setDate(nextOccurrence.getDate() + 7);
                          }
                      }

                      const diffMs = nextOccurrence.getTime() - now.getTime();
                      const diffMins = diffMs / (1000 * 60);
                      
                      const reminders = normalizeMeetingReminders(data.notificationSettings?.reminders);
                      const matchingReminder = reminders.find((r: number) => diffMins >= 0 && Math.abs(diffMins - r) <= 2);
                      if (!matchingReminder) return;

                      const reminderKey = getReminderKey(nextOccurrence, matchingReminder);
                      const sentReminders = Array.isArray(data.sentReminders) ? data.sentReminders : [];
                      if (sentReminders.includes(reminderKey)) return;

                      if (matchingReminder) {
                          let msg = `⏰ <b>تذكير اجتماع متكرر</b> (قبل ${formatReminderLead(matchingReminder)})\n\n📌 <b>${data.topic}</b>\n🔄 <b>يتكرر:</b> ${data.recurrenceDay}\n📅 <b>تاريخ الاجتماع:</b> ${getDateKey(nextOccurrence)}\n🕒 <b>الساعة:</b> ${data.time}\n`;
                          if (data.locationType === 'online') msg += `🔗 <b>الرابط:</b> ${data.link}`; 
                          else msg += `📍 <b>المكان:</b> ${data.details}`;
                          sendToAllDeptLeadership(msg);
                          await updateDoc(doc(db, "management_meetings", docSnap.id), {
                              sentReminders: arrayUnion(reminderKey),
                              lastReminderSentAt: serverTimestamp()
                          });
                          console.log("Auto-reminder sent for recurring", data.topic);
                      }
                  } 
                  // B. One-time Events Logic
                  else if (!data.isRecurring && data.date && data.time) {
                      const eventTime = new Date(`${data.date}T${data.time}`);
                      const diffMs = eventTime.getTime() - now.getTime();
                      const diffMins = diffMs / (1000 * 60);
                      
                      const reminders = normalizeMeetingReminders(data.notificationSettings?.reminders);
                      const matchingReminder = reminders.find((r: number) => diffMins >= 0 && Math.abs(diffMins - r) <= 2);
                      if (!matchingReminder) return;

                      const reminderKey = getReminderKey(eventTime, matchingReminder);
                      const sentReminders = Array.isArray(data.sentReminders) ? data.sentReminders : [];
                      if (sentReminders.includes(reminderKey)) return;

                      if (matchingReminder) {
                          let msg = `⏰ <b>تذكير اجتماع</b> (قبل ${formatReminderLead(matchingReminder)})\n\n📌 <b>${data.topic}</b>\n📅 <b>التاريخ:</b> ${data.date}\n🕒 <b>الساعة:</b> ${data.time}\n`;
                          if (data.locationType === 'online') msg += `🔗 <b>الرابط:</b> ${data.link}`; 
                          else msg += `📍 <b>المكان:</b> ${data.details}`;
                          sendToAllDeptLeadership(msg);
                          await updateDoc(doc(db, "management_meetings", docSnap.id), {
                              sentReminders: arrayUnion(reminderKey),
                              lastReminderSentAt: serverTimestamp()
                          });
                          console.log("Auto-reminder sent for", data.topic);
                      }
                  }
              });
          } catch(e) { console.error("Auto reminder error", e); }
      };

      const interval = setInterval(checkReminders, 60000); // Check every minute
      return () => clearInterval(interval);
  }, [telegramConfig, onSendTelegram]);


  // --- Handlers ---

  const handleLogout = async () => {
      // Clear all ma3wan related storage
      Object.keys(localStorage).forEach(key => {
          if (key.startsWith('ma3wan_') || key === 'special_login_password' || key === 'atef_password_verified') {
              localStorage.removeItem(key);
          }
      });
      sessionStorage.clear();
      await signOut(auth);
  };

  const handleHRLogout = () => {
      if(confirm("هل أنت متأكد من تسجيل الخروج من جلسة الموارد البشرية؟")) {
          localStorage.removeItem("ma3wan_hr_profile");
          localStorage.removeItem("ma3wan_hr_session_active");
          setHrProfileData(null);
          setShowHRModal(true);
      }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await updateDoc(doc(db, "users", user.uid), { 
              displayName: editProfileName,
              role: userProfile?.role || 'member'
          });
          setShowSettings(false);
          toast.success("تم تحديث الملف الشخصي بنجاح");
      } catch (error) {
          console.error("Error updating profile:", error);
          toast.error("حدث خطأ أثناء تحديث الملف الشخصي");
      }
  };

  const saveUserProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profileSetup.name.trim() || !profileSetup.departmentId) {
          toast.error("الرجاء إكمال جميع البيانات");
          return;
      }
      try {
          await setDoc(doc(db, "users", user.uid), {
              uid: user.uid,
              email: user.email,
              displayName: profileSetup.name,
              departmentId: profileSetup.departmentId,
              role: profileSetup.role,
              updatedAt: new Date().toISOString()
          }, { merge: true });
          setShowNameModal(false);
          toast.success("تم إعداد الملف الشخصي بنجاح");
      } catch (e) {
          console.error("Error saving profile:", e);
          toast.error("حدث خطأ أثناء حفظ البيانات");
      }
  };

  const handleCreateHRProfile = (e: React.FormEvent) => {
      e.preventDefault();
      if (!hrTempName.trim()) return;
      
      // Values are set in the Modal via localStorage, we just finalize here
      const profileData = {
          name: hrTempName,
          section: localStorage.getItem("ma3wan_hr_section") || "general",
          role: localStorage.getItem("ma3wan_hr_role") || "member",
          id: localStorage.getItem("ma3wan_hr_id") || "",
          createdAt: new Date().toISOString()
      };
      
      localStorage.setItem("ma3wan_hr_profile", JSON.stringify(profileData));
      setHrProfileData(profileData);
      setShowHRModal(false);
      alert(`تم تسجيل الدخول بصفتك: ${hrTempName}`);
  };

  // Task Handlers
  const handleAddTask = async (e?: React.FormEvent, taskData?: any, returnRef?: boolean) => {
      if (e) e.preventDefault();
      
      const dataToUse = taskData || newTask;
      if (!dataToUse.title.trim()) return;
      
      let finalTitle = dataToUse.title;
      let finalDetails = dataToUse.details;

      // Handle Educational Specific Fields
      if (activeDeptId === 'educational') {
          if (dataToUse.eduBatchNumber) {
              finalDetails = `الدفعة: ${dataToUse.eduBatchNumber}\n${finalDetails}`;
          }
          if (dataToUse.eduCreateCover) {
              finalTitle = `[غلاف مذكرة] ${finalTitle}`;
          }
      }

      if (dataToUse.selectedLogos && dataToUse.selectedLogos.length > 0) {
          finalDetails += `\n\n🖼 اللوجوهات المطلوبة: ${dataToUse.selectedLogos.join(', ')}`;
      }

      // Determine Target Department
      let targetDept = dataToUse.targetDept;
      if (!targetDept) {
          if (dataToUse.isForSelf) {
              // If for self, use active department or user's department
              targetDept = activeDeptId !== 'overview' && activeDeptId !== 'all' ? activeDeptId : (userProfile?.departmentId || 'general');
          } else {
              // If not specified and not for self (rare case if form is valid), default to general or active
              targetDept = activeDeptId !== 'overview' && activeDeptId !== 'all' ? activeDeptId : 'general';
          }
      }

      let createdByName = userProfile?.displayName || user.email;
      if (userProfile?.departmentId === 'charity' && userProfile?.role) {
          const roleName = CHARITY_ROLES.find(r => r.id === userProfile.role)?.name;
          if (roleName) {
              createdByName = `${createdByName} (${roleName})`;
          }
      }

      const docRef = await addDoc(collection(db, "tasks"), {
          ...dataToUse,
          title: finalTitle,
          details: finalDetails,
          sourceDept: userProfile?.departmentId || 'general', 
          targetDept: targetDept,
          assignedToName: dataToUse.isAlsoForSelf ? (userProfile?.displayName || user.email) : (dataToUse.assignedToName || ""),
          status: 'pending',
          created_at: new Date().toISOString(),
          created_by: user.email,
          created_by_name: createdByName,
          category: dataToUse.category || 'general',
          executionDate: dataToUse.executionDate || ""
      });

      setNewTask({ title: "", details: "", deadline: "", executionDate: "", priority: "p4", targetDept: "", assignedToName: "", category: "", performerName: "" });
      setEduData({ subjectName: "", noteType: "", batchNumber: "", requestType: "" });
      
      // --- NEW RULE-BASED TELEGRAM LOGIC ---
      if (!dataToUse.isForSelf && targetDept && onSendTelegram && telegramConfig?.rules?.departments) {
          const route = resolveDepartmentLeadership(telegramConfig, targetDept, 'manager_and_deputy');
          if (route.chatIds.length > 0) {
              const botToken = route.botToken;
              const sourceDeptName = DEPARTMENTS.find(d => d.id === (userProfile?.departmentId || activeDeptId))?.nameAr || userProfile?.departmentId || activeDeptId;
              const targetDeptName = DEPARTMENTS.find(d => d.id === targetDept)?.nameAr || targetDept;

              const recipientChatIds = route.chatIds;

              if (recipientChatIds.length > 0) {
                  let msg = `📢 <b>تكليف جديد من الموارد البشرية</b>\n\n📌 <b>المهمة:</b> ${finalTitle}\n📝 <b>التفاصيل:</b> ${finalDetails}\n🚨 <b>الأولوية:</b> ${dataToUse.priority}\n👤 <b>بواسطة:</b> ${userProfile?.displayName}`;
                  if (dataToUse.assignedToName) msg += `\n🎯 <b>المكلف:</b> ${dataToUse.assignedToName}`;
                  if (dataToUse.selectedLogos && dataToUse.selectedLogos.length > 0) msg += `\n🖼 <b>اللوجوهات:</b> ${dataToUse.selectedLogos.join(', ')}`;

                  msg += `\n📤 <b>من قسم:</b> ${sourceDeptName}\n📥 <b>إلى قسم:</b> ${targetDeptName}`;
                  recipientChatIds.forEach((chatId: string) => {
                      onSendTelegram(chatId, msg, botToken);
                  });
              }
          }
      }

      if (returnRef) {
          return docRef;
      }
  };

  const toggleTaskStatus = async (task: any) => {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const updates: any = { status: newStatus };
      if (newStatus === 'completed') {
          updates.completedAt = Date.now();
      }
      await updateDoc(doc(db, "tasks", task.id), updates);

      // Status Sync for Forwarded Tasks
      if (task.originalTaskId) {
          try {
              // Update original task. Also update artTaskStatus for legacy compatibility if needed.
              await updateDoc(doc(db, "tasks", task.originalTaskId), { 
                  status: newStatus, 
                  artTaskStatus: newStatus,
                  lastSyncedAt: Date.now()
              });
          } catch (e) {
              console.error("Error syncing original task:", e);
          }
      }

      // --- NEW RULE-BASED TELEGRAM LOGIC ---
      const originalSourceDept = task.originalSourceDept || task.forwardedFrom;
      if (newStatus === 'completed' && originalSourceDept && originalSourceDept !== task.targetDept && onSendTelegram) {
          const { botToken } = getDeptRuleMeta(originalSourceDept);
          const recipientChatIds = getDeptLeadershipRecipients(originalSourceDept, 'manager_and_deputy');
          if (recipientChatIds.length > 0) {
              const completedAtText = new Date().toLocaleString('ar-EG');
              const msg = `✅ <b>تم إنجاز المهمة</b>\n\n📌 <b>المهمة:</b> ${task.title}\n📤 <b>قسم طلب العمل:</b> ${DEPARTMENTS.find(d => d.id === originalSourceDept)?.nameAr || originalSourceDept}\n📥 <b>قسم التنفيذ:</b> ${DEPARTMENTS.find(d => d.id === task.targetDept)?.nameAr || task.targetDept}\n👤 <b>أُنجزت بواسطة:</b> ${userProfile?.displayName || user.email}\n📅 <b>تاريخ ووقت الإنجاز:</b> ${completedAtText}\n🎨 <b>التسليم:</b> تم تنفيذ التصميم وسيتم التسليم من خلال وصلة الإخراج الفني.`;
              recipientChatIds.forEach((chatId: string) => onSendTelegram(chatId, msg, botToken));
          }
      }
  };

  const handleForwardToArt = async (task: any, note: string, extraDetails?: string, selectedLogos?: string[]) => {
      try {
        let detailsContent = `تم التحويل من القسم التعليمي\n\nملاحظات: ${note}\n\n${extraDetails || ''}`;
        if (selectedLogos && selectedLogos.length > 0) {
            detailsContent += `\n\nاللوجوهات المطلوبة: ${selectedLogos.join(', ')}`;
        }
        detailsContent += `\n\n${task.details || ''}`;

        // Create new task for Art Direction
        await addDoc(collection(db, "tasks"), {
            title: task.title || "مهمة محولة",
            details: detailsContent,
            sourceDept: 'art',
            forwardedFrom: 'educational',
            originalTaskId: task.id,
            priority: task.priority || 'normal',
            deadline: task.deadline || null,
            status: 'pending',
            created_at: new Date().toISOString(),
            created_by: user.email || 'unknown'
        });

        // Update original task
        await updateDoc(doc(db, "tasks", task.id), { 
            forwardedToArt: true,
            artTaskStatus: 'pending'
        });
        
        // Telegram Notification
        if (onSendTelegram) {
            const route = resolveDepartmentLeadership(telegramConfig, 'art', 'manager_and_deputy');
            const finalContacts = route.chatIds.map((chatId: string) => ({ chatId }));

            if (finalContacts.length > 0) {
                let msg = `🎨 <b>مهمة جديدة للإخراج الفني</b>\n\n` +
                            `📌 <b>العنوان:</b> ${task.title}\n` +
                            `📝 <b>ملاحظات:</b> ${note || 'لا توجد'}\n` +
                            `📋 <b>تفاصيل إضافية:</b>\n${extraDetails || 'لا توجد'}\n`;
                
                if (selectedLogos && selectedLogos.length > 0) {
                    msg += `🖼 <b>اللوجوهات:</b> ${selectedLogos.join(', ')}\n`;
                }

                msg += `👤 <b>بواسطة:</b> ${userProfile?.displayName || user.email}`;
                
                finalContacts.forEach((contact: any) => {
                    onSendTelegram(contact.chatId, msg, route.botToken);
                });
            }
        }
        
        toast.success("تم التحويل لقسم الإخراج الفني بنجاح");
      } catch (e) {
          console.error("Error forwarding to art:", e);
          toast.error("حدث خطأ أثناء التحويل: " + (e as any).message);
      }
  };

  const renameCategory = async (oldCategory: string, newCategory: string) => {
      if (!oldCategory || !newCategory || oldCategory === newCategory) return;
      try {
          const q = query(collection(db, "tasks"), where("category", "==", oldCategory));
          const snapshot = await getDocs(q);
          
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => {
              batch.update(doc.ref, { category: newCategory });
          });
          
          await batch.commit();
          toast.success("تم تغيير اسم القسم بنجاح");
      } catch (e) {
          console.error("Error renaming category:", e);
          toast.error("حدث خطأ أثناء تغيير الاسم");
      }
  };

  const deleteTask = async (taskId: string) => {
      if (confirm("هل أنت متأكد من حذف المهمة؟")) {
          await deleteDoc(doc(db, "tasks", taskId));
      }
  };

  const initiateForward = (task: any, targetDept: string) => {
      setForwardModal({ isOpen: true, task, targetDept });
  };

  const confirmForwardTask = async (selectedLogos?: string[], urgency?: string, overrideTargetDeptId?: string) => {
      const finalTargetDeptId = forwardModal.targetDept || overrideTargetDeptId;
      if (!forwardModal.task || !finalTargetDeptId) return;
      
      const sourceDeptName = DEPARTMENTS.find(d => d.id === activeDeptId)?.nameAr || activeDeptId;
      const targetDeptName = DEPARTMENTS.find(d => d.id === finalTargetDeptId)?.nameAr || finalTargetDeptId;

      let details = `تم التحويل من ${sourceDeptName}\n\nملاحظات التحويل: ${forwardNote}`;
      if (forwardMemberName) details += `\n\n تعيين إلى: ${forwardMemberName}`;
      if (selectedLogos?.length) details += `\n\n اللوجوهات المطلوبة: ${selectedLogos.join(', ')}`;
      details += `\n\n${forwardModal.task.details || ''}`;

      const forwardedAt = new Date().toISOString();

      // Create the forwarded task copy — sourceDept stays as activeDeptId (who forwarded)
      const newTaskRef = await addDoc(collection(db, "tasks"), {
          title: forwardModal.task.title,
          details: details,
          sourceDept: activeDeptId,           // ← the dept that SENT it
          originalSourceDept: activeDeptId,   // ← يبقى ثابتاً لإشعارات القبول/الإنجاز
          targetDept: finalTargetDeptId,     // ← the dept that RECEIVES it
          forwardedFrom: activeDeptId,
          forwardedByName: userProfile?.displayName || user.email,
          originalTaskId: forwardModal.task.id || null,
          priority: urgency === 'very_urgent' ? 'p1' : urgency === 'urgent' ? 'p2' : (forwardModal.task.priority || 'p4'),
          forwardUrgency: urgency || 'normal',
          forwardNote: forwardNote,
          assignedTo: forwardMemberName || null,
          deadline: forwardModal.task.deadline,
          status: 'pending_acceptance',
          forwardStatus: 'new',
          forwardedAt,
          created_at: forwardedAt,
          created_by: user.email,
          created_by_name: userProfile?.displayName,
          selectedLogos: selectedLogos || [],
      });

      // Create in-app notification for the target dept
      try {
          await addDoc(collection(db, "notifications"), {
              type: 'task_forwarded',
              targetDept: finalTargetDeptId,
              fromDept: activeDeptId,
              fromDeptName: sourceDeptName,
              taskId: newTaskRef.id,
              taskTitle: forwardModal.task.title,
              forwardNote: forwardNote,
              assignedTo: forwardMemberName || null,
              urgency: urgency || 'normal',
              isRead: false,
              createdAt: forwardedAt,
              createdBy: userProfile?.displayName || user.email,
          });
      } catch(e) { console.error('Notification error:', e); }

      // ── Telegram notification logic ──────────
      if (onSendTelegram) {
          const urgencyEmoji = urgency === 'very_urgent' ? '🔴🔴 عاجل جداً 🔴🔴' : urgency === 'urgent' ? '🟠 عاجل' : '📋';
          const forwardedAtText = new Date().toLocaleString('ar-EG');
          const detailsPreview = truncateForTelegram(forwardModal.task.details || "", 240);
          const msg = `${urgencyEmoji}\n<b>مهمة محوَّلة جديدة</b>\n\n📤 <b>من القسم:</b> ${sourceDeptName}\n👤 <b>المحوِّل:</b> ${userProfile?.displayName || user.email}\n📥 <b>إلى القسم:</b> ${targetDeptName}\n📌 <b>عنوان المهمة:</b> ${forwardModal.task.title}${detailsPreview ? `\n📝 <b>نص المهمة:</b> ${detailsPreview}` : ''}\n🚦 <b>الأولوية / الحالة:</b> ${urgency === 'very_urgent' ? 'عاجلة جداً' : urgency === 'urgent' ? 'عاجلة' : 'عادية'}\n📅 <b>تاريخ ووقت التحويل:</b> ${forwardedAtText}${forwardNote ? `\n💬 <b>ملاحظة التحويل:</b> ${forwardNote}` : ''}${forwardMemberName ? `\n👤 <b>تعيين إلى:</b> ${forwardMemberName}` : ''}${(selectedLogos ?? []).length > 0 ? `\n🖼 <b>اللوجوهات:</b> ${selectedLogos!.join(', ')}` : ''}`;

          try {
              const deptRule = telegramConfig?.rules?.departments?.[finalTargetDeptId];
              const notifyMode = 'manager_and_deputy';
              const route = resolveDepartmentLeadership(telegramConfig, finalTargetDeptId, notifyMode);
              const sent = sendTelegramToChatIds(onSendTelegram, route.chatIds, msg, route.botToken);
              if (!sent) {
                  console.warn("No Telegram forwarding recipients resolved", {
                      finalTargetDeptId,
                      notifyMode,
                      departmentRule: deptRule,
                      people: telegramConfig?.people
                  });
                  toast.error("تم التحويل، لكن لا يوجد مستلم تيليجرام مضبوط لهذا القسم");
              } else {
                  console.log(`Telegram notifications sent to ${route.chatIds.length} targets for ${finalTargetDeptId}`);
              }

          } catch(e) { console.error('Telegram forwarding logic error:', e); }
      }

      setForwardModal({ isOpen: false, task: null, targetDept: "" });
      setForwardNote("");
      setForwardMemberName("");
      toast.success("تم تحويل المهمة بنجاح");

      // ── Log to Pulse ──
      try {
          await addDoc(collection(db, "tasks", newTaskRef.id, "pulse"), {
              type: 'activity',
              text: `تم تحويل المهمة من قسم ${sourceDeptName} إلى قسم ${targetDeptName}`,
              user: userProfile?.displayName || user.email,
              timestamp: serverTimestamp()
          });
      } catch(e) { console.error('Pulse log error:', e); }
  };

  const handleAcceptTask = async (task: any) => {
      try {
          if (!task?.id) {
              toast.error("تعذر قبول المهمة: معرف المهمة غير موجود");
              return;
          }

          const actorId = user?.email || userProfile?.email || user?.uid || 'unknown_user';
          const actorName = userProfile?.displayName || user?.email || user?.uid || 'مستخدم';

          await updateDoc(doc(db, "tasks", task.id), {
              status: 'todo',
              forwardStatus: 'accepted',
              acceptedAt: serverTimestamp(),
              acceptedBy: actorId,
              // Once accepted, treat it as an internal task for receiver dept.
              originalSourceDept: task.originalSourceDept || task.sourceDept || null,
              sourceDept: task.targetDept || task.sourceDept
          });

          // Pulse logging should not block accepting the task.
          try {
              await addDoc(collection(db, "tasks", task.id, "pulse"), {
                  type: 'activity',
                  text: `تم قبول المهمة في قسم ${DEPARTMENTS.find(d => d.id === task.targetDept)?.nameAr}`,
                  user: actorName,
                  timestamp: serverTimestamp()
              });
          } catch (pulseError) {
              console.error("Pulse log failed after accept:", pulseError);
          }

          // Notify source department that target approved the task.
          const sourceDeptToNotify = task.originalSourceDept || task.forwardedFrom || task.sourceDept;
          if (onSendTelegram && sourceDeptToNotify) {
              const { botToken } = getDeptRuleMeta(sourceDeptToNotify);
              const recipients = getDeptLeadershipRecipients(sourceDeptToNotify, 'manager_and_deputy');
              const acceptedAtText = new Date().toLocaleString('ar-EG');
              const acceptanceMsg = `✅ <b>تم قبول المهمة</b>\n\n📌 <b>المهمة:</b> ${task.title}\n📤 <b>قسم التحويل:</b> ${DEPARTMENTS.find(d => d.id === sourceDeptToNotify)?.nameAr || sourceDeptToNotify}\n📥 <b>قسم التنفيذ:</b> ${DEPARTMENTS.find(d => d.id === task.targetDept)?.nameAr || task.targetDept}\n👤 <b>قُبلت بواسطة:</b> ${actorName}\n📅 <b>تاريخ ووقت القبول:</b> ${acceptedAtText}`;
              recipients.forEach((chatId: string) => onSendTelegram(chatId, acceptanceMsg, botToken));
          }

          toast.success("تم قبول المهمة وبدء العمل عليها");
      } catch (e) {
          console.error(e);
          const errorCode = (e as any)?.code || "";
          const errorMessage = (e as any)?.message || "";
          const suffix = errorCode || errorMessage ? `: ${errorCode} ${errorMessage}`.trim() : "";
          toast.error(`حدث خطأ أثناء قبول المهمة${suffix}`);
      }
  };

  const handleRejectTask = async (task: any, reason: string) => {
      try {
          if (!task?.id) {
              toast.error("تعذر رفض المهمة: معرف المهمة غير موجود");
              return;
          }

          const actorId = user?.email || userProfile?.email || user?.uid || 'unknown_user';
          const actorName = userProfile?.displayName || user?.email || user?.uid || 'مستخدم';

          await updateDoc(doc(db, "tasks", task.id), {
              status: 'rejected',
              forwardStatus: 'rejected',
              rejectionReason: reason,
              rejectedAt: serverTimestamp(),
              rejectedBy: actorId
          });

          // Pulse logging should not block rejecting the task.
          try {
              await addDoc(collection(db, "tasks", task.id, "pulse"), {
                  type: 'activity',
                  text: `تم رفض المهمة. السبب: ${reason}`,
                  user: actorName,
                  timestamp: serverTimestamp()
              });
          } catch (pulseError) {
              console.error("Pulse log failed after reject:", pulseError);
          }

          const sourceDeptToNotify = task.originalSourceDept || task.forwardedFrom || task.sourceDept;
          if (onSendTelegram && sourceDeptToNotify) {
              const route = resolveDepartmentLeadership(telegramConfig, sourceDeptToNotify, 'manager_and_deputy');
              const rejectedAtText = new Date().toLocaleString('ar-EG');
              const rejectionMsg = `❌ <b>تم رفض المهمة</b>\n\n📌 <b>المهمة:</b> ${task.title}\n📤 <b>قسم التحويل:</b> ${DEPARTMENTS.find(d => d.id === sourceDeptToNotify)?.nameAr || sourceDeptToNotify}\n📥 <b>قسم التنفيذ:</b> ${DEPARTMENTS.find(d => d.id === task.targetDept)?.nameAr || task.targetDept}\n👤 <b>رُفضت بواسطة:</b> ${actorName}\n📝 <b>السبب:</b> ${reason}\n📅 <b>تاريخ ووقت الرفض:</b> ${rejectedAtText}`;
              sendTelegramToChatIds(onSendTelegram, route.chatIds, rejectionMsg, route.botToken);
          }

          toast.success("تم رفض المهمة وإرسال التغذية الراجعة");
      } catch (e) {
          console.error(e);
          const errorCode = (e as any)?.code || "";
          const errorMessage = (e as any)?.message || "";
          const suffix = errorCode || errorMessage ? `: ${errorCode} ${errorMessage}`.trim() : "";
          toast.error(`حدث خطأ أثناء رفض المهمة${suffix}`);
      }
  };



  // --- CONFIRM ATTENDANCE LOGIC ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const confirmEventId = params.get('confirmEvent');
    
    if (confirmEventId && user && user.email) {
        handleConfirmAttendance(confirmEventId);
    }
  }, [user]);

  const handleConfirmAttendance = async (eventId: string) => {
      try {
        const docRef = doc(db, "management_meetings", eventId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;
        
        const data = docSnap.data();
        const attendees = data.attendees || [];
        const confirmedIds = Array.from(new Set([...(Array.isArray(attendees) ? attendees : []), user.uid]));
        
        if (attendees.includes(user.uid)) {
            alert("لقد قمت بتأكيد الحضور مسبقاً");
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }
        
        await updateDoc(docRef, {
            attendees: arrayUnion(user.uid)
        });

        const meetingRoute = resolveMeetingRoute(telegramConfig);
        if (onSendTelegram && meetingRoute.chatIds.length > 0) {
            const attendeeName = userProfile?.displayName || user.displayName || user.email || "مستخدم";
            const confirmedAtText = new Date().toLocaleString('ar-EG');
            const usersSnapshot = await getDocs(collection(db, "users"));
            const allUsers = usersSnapshot.docs.map((userDoc) => ({ id: userDoc.id, ...(userDoc.data() as any) }));
            const configuredAudienceIds = [
                ...(Array.isArray(data.invitedUserIds) ? data.invitedUserIds : []),
                ...(Array.isArray(data.targetUserIds) ? data.targetUserIds : []),
                ...(Array.isArray(data.expectedAttendeeIds) ? data.expectedAttendeeIds : [])
            ].filter(Boolean);
            const audienceUsers = configuredAudienceIds.length > 0
                ? allUsers.filter((item) => configuredAudienceIds.includes(item.id) || configuredAudienceIds.includes(item.uid))
                : allUsers;
            const getUserDisplayName = (item: any) => item.displayName || item.name || item.email || item.id;
            const isConfirmedUser = (item: any) => confirmedIds.includes(item.id) || confirmedIds.includes(item.uid);
            const confirmedNames = audienceUsers.filter(isConfirmedUser).map(getUserDisplayName);
            if (!confirmedNames.includes(attendeeName)) confirmedNames.push(attendeeName);
            const remainingNames = audienceUsers.filter((item) => !isConfirmedUser(item)).map(getUserDisplayName);
            const formatNames = (names: string[]) => names.length ? names.map((name, index) => `${index + 1}. ${name}`).join("\n") : "-";
            const enrichedMsg = `✅ <b>تأكيد حضور جديد</b>\n\n👤 <b>الاسم:</b> ${attendeeName}\n📌 <b>الاجتماع / الإعلان:</b> ${data.topic || data.title || "-"}\n🕒 <b>وقت التأكيد:</b> ${confirmedAtText}\n\n✅ <b>أكدوا حتى الآن (${confirmedNames.length}):</b>\n${formatNames(confirmedNames)}\n\n⏳ <b>لم يؤكدوا بعد (${remainingNames.length}):</b>\n${formatNames(remainingNames)}`;
            const msg = `✅ <b>تأكيد حضور جديد</b>\n\n👤 <b>الاسم:</b> ${attendeeName}\n📌 <b>الاجتماع / الإعلان:</b> ${data.topic || data.title || "-"}\n🕒 <b>وقت التأكيد:</b> ${confirmedAtText}`;
            sendTelegramToChatIds(onSendTelegram, meetingRoute.chatIds, enrichedMsg || msg, meetingRoute.botToken);
        }
        
        alert("تم تأكيد الحضور بنجاح!");
        
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) { console.error(e); }
  };

  const updateTaskCategory = async (taskId: string, newCategory: string) => {
      try {
          await updateDoc(doc(db, "tasks", taskId), { category: newCategory });
      } catch (e) {
          console.error("Error updating category:", e);
      }
  };

  const updateTaskInternalCategory = async (taskId: string, newInternalCategory: string) => {
      try {
          await updateDoc(doc(db, "tasks", taskId), { internalCategory: newInternalCategory });
      } catch (e) {
          console.error("Error updating internal category:", e);
      }
  };

  const handleUpdateTelegramConfig = async (newConfig: AppTelegramConfig) => {
      // This handler now receives the fully structured AppTelegramConfig
      // No need to manually ensure 'contacts' is an array, as the new structure handles it.
      await setDoc(doc(db, "app_settings", "telegram_config"), newConfig, { merge: true });
      setShowTelegramConfig(false);
      toast.success("تم حفظ إعدادات Telegram بنجاح!");
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const notificationSettings = {
              ...newEvent.notificationSettings,
              reminders: normalizeMeetingReminders(newEvent.notificationSettings?.reminders)
          };

          if (newEvent.id) {
              // UPDATE Existing Event
              await updateDoc(doc(db, "management_meetings", newEvent.id), {
                  topic: newEvent.title,
                  date: newEvent.date,
                  time: newEvent.time,
                  isRecurring: newEvent.isRecurring || false,
                  recurrenceDay: newEvent.isRecurring ? newEvent.recurrenceDay : null,
                  locationType: newEvent.type,
                  link: newEvent.link,
                  details: newEvent.details,
                  notificationSettings
              });
              if (onSendTelegram) {
                  const announcementRoute = resolveMeetingAnnouncementRoute(telegramConfig);
                  const editedAtText = new Date().toLocaleString('ar-EG');
                  const editMsg = `✏️ <b>تم تعديل إعلان اجتماع</b>\n\n📢 <b>${newEvent.title}</b>\n📅 <b>الموعد:</b> ${newEvent.date || "-"} - ${newEvent.time || "-"}\n📍 <b>النوع:</b> ${newEvent.type === "online" ? "أونلاين" : "حضوري"}\n👤 <b>تم التعديل بواسطة:</b> ${userProfile?.displayName || user.email}\n🕒 <b>وقت التعديل:</b> ${editedAtText}`;
                  sendTelegramToChatIds(onSendTelegram, announcementRoute.chatIds, editMsg, announcementRoute.botToken);
              }
              alert("تم تحديث الإعلان بنجاح");
          } else {
              // CREATE New Event
              const docRef = await addDoc(collection(db, "management_meetings"), {
                  topic: newEvent.title,
                  date: newEvent.date,
                  time: newEvent.time,
                  isRecurring: newEvent.isRecurring || false,
                  recurrenceDay: newEvent.isRecurring ? newEvent.recurrenceDay : null,
                  locationType: newEvent.type,
                  link: newEvent.link,
                  details: newEvent.details,
                  notificationSettings, // Store full settings including reminders
                  createdAt: Date.now(),
                  created_by: user.email,
                  created_by_name: userProfile?.displayName,
                  sentReminders: [],
                  attendees: [],
                  apologies: []
              });

              // 2. Send Telegram (Immediate Announcement)
              if (newEvent.sendImmediateNotification && notificationSettings.enabled && onSendTelegram) {
                  let msg = `📣 <b>إعلان اجتماع</b> — يُرسل لرؤساء الأقسام والنواب\n\n📢 <b>${newEvent.title}</b>\n\n`;
                  if (notificationSettings.includeTime) {
                      if (newEvent.isRecurring) {
                          msg += `🔄 <b>يتكرر كل:</b> ${newEvent.recurrenceDay}\n🕒 <b>الساعة:</b> ${newEvent.time}\n`;
                          if (newEvent.date) msg += `📅 <b>بداية من:</b> ${newEvent.date}\n`;
                      } else {
                          msg += `📅 ${newEvent.date} - 🕒 ${newEvent.time}\n`;
                      }
                  }
                  if (notificationSettings.includeLocation) msg += newEvent.type === 'online' ? `🔗 رابط: ${newEvent.link}\n` : `📍 مكان: ${newEvent.details}\n`;
                  if (notificationSettings.includeDetails && newEvent.details && newEvent.type !== 'online') msg += `📝 تفاصيل: ${newEvent.details}\n`;
                  
                  // Add Confirmation Link
                  const confirmLink = `${window.location.origin}?confirmEvent=${docRef.id}`;
                  msg += `\n👤 <b>بواسطة:</b> ${userProfile?.displayName || user.email}`;
                  msg += `\n✅ لتأكيد الحضور: ${confirmLink}`;
                  const announcementRoute = resolveMeetingAnnouncementRoute(telegramConfig);
                  const sent = sendTelegramToChatIds(onSendTelegram, announcementRoute.chatIds, msg, announcementRoute.botToken);
                  if (!sent) {
                      console.warn("No Telegram meeting announcement recipients configured", telegramConfig?.rules?.meetings);
                      toast.error("تم نشر الإعلان، لكن لم يتم تحديد مستلمين لإشعار الميتنج في إعدادات البوت");
                  }
              }
              alert("تم نشر الإعلان بنجاح");
          }

          setShowEventModal(false);
          setNewEvent({ 
              id: "", title: "", date: "", time: "", type: "offline", link: "", details: "", 
              isRecurring: false, recurrenceDay: 'Thursday',
              notificationSettings: { enabled: true, includeTime: true, includeLocation: true, includeDetails: true, reminders: DEFAULT_MEETING_REMINDERS },
              sendImmediateNotification: true
          });
      } catch (err) { console.error(err); alert("حدث خطأ"); }
  };

  const handleDeleteEvent = async (id: string) => {
      if (!window.confirm("هل أنت متأكد من حذف هذا الإعلان؟")) return;
      try {
          const eventRef = doc(db, "management_meetings", id);
          const eventSnap = await getDoc(eventRef);
          const eventData = eventSnap.exists() ? eventSnap.data() : null;
          await deleteDoc(eventRef);
          if (onSendTelegram && eventData) {
              const announcementRoute = resolveMeetingAnnouncementRoute(telegramConfig);
              const deletedAtText = new Date().toLocaleString('ar-EG');
              const deleteMsg = `🗑️ <b>تم حذف إعلان اجتماع</b>\n\n📢 <b>${eventData.topic || eventData.title || "-"}</b>\n📅 <b>الموعد السابق:</b> ${eventData.date || "-"} - ${eventData.time || "-"}\n👤 <b>تم الحذف بواسطة:</b> ${userProfile?.displayName || user.email}\n🕒 <b>وقت الحذف:</b> ${deletedAtText}`;
              sendTelegramToChatIds(onSendTelegram, announcementRoute.chatIds, deleteMsg, announcementRoute.botToken);
          }
          alert("تم الحذف بنجاح");
      } catch (e) { console.error(e); alert("فشل الحذف"); }
  };

  // Determine Active Department
  const activeDeptId = DEPARTMENTS.find(d => d.id === currentView)?.id || (currentView === 'waman_ahyaaha' ? 'waman_ahyaaha' : 'general');

  // Filter tasks based on sidebar selection
  const filteredTasks = tasks.filter(task => {
      // Super Admin Logic: Show ALL tasks unless filtered by specific view
      if (user.email === SUPER_ADMIN_EMAIL) {
          if (DEPARTMENTS.some(d => d.id === currentView)) {
              if (task.targetDept !== currentView && task.sourceDept !== currentView) return false;
          } else if (showMyDeptOnly && userProfile?.departmentId) {
              if (task.targetDept !== userProfile.departmentId && task.sourceDept !== userProfile.departmentId) return false;
          }
      } else if (isCharityRestricted) {
          if (task.targetDept !== 'charity' && task.sourceDept !== 'charity') return false;
      } else {
          // Standard: Only show tasks for my department
          const myDeptId = userProfile?.departmentId || 'general';
          if (task.targetDept !== myDeptId && task.sourceDept !== myDeptId) return false;
      }

      // Search filter
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) && !task.details?.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
      }

      // View-based filtering
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

      if (currentView === 'inbox' || taskFilter === 'inbox') {
          // Inbox: Forwarded to user or user's department
          const isForwardedToMe = task.assignedToName === userProfile?.displayName;
          const isForwardedToMyDept = task.targetDept === userProfile?.departmentId;
          return (isForwardedToMe || isForwardedToMyDept) && task.status !== 'completed';
      }

      if (currentView === 'today' || taskFilter === 'today') {
          // Today: Deadline is today
          if (task.status === 'completed') return false;
          return task.deadline === today;
      }

      if (currentView === 'upcoming' || taskFilter === 'upcoming') {
          // Upcoming: Deadline is in the future
          if (task.status === 'completed') return false;
          return task.deadline > today;
      }

      if (currentView === 'delayed' || taskFilter === 'delayed') {
          // Delayed: Deadline is in the past
          if (task.status === 'completed') return false;
          return task.deadline && task.deadline < today;
      }

      if (currentView === 'all' || taskFilter === 'all') {
          // All: Show all tasks
          return true;
      }

      // Department-specific view
      if (DEPARTMENTS.some(d => d.id === currentView)) {
          // Show tasks targeting this department OR tasks sourced from this department and assigned to the current user (Add to me also) OR sheet items
          return task.targetDept === currentView || (task.sourceDept === currentView && (task.assignedToName === userProfile?.displayName || task.isAlsoForSelf || task.isSheetItem || task.sheetId));
      }

      return true;
  });

  // Stats Logic
  const stats = {
      pendingTasks: tasks.filter(t => t.status !== 'completed').length,
      announcements: announcements.length,
      departments: DEPARTMENTS.length
  };

  const MobileBottomNav = () => {
      const navItems = [
          ...(!isCharityRestricted ? [{ id: 'identity', icon: Palette, label: 'الهوية', grad: 'from-pink-500 to-rose-600', show: true }] : []),
          ...((isSuperAdmin || userProfile?.canViewReports || userProfile?.role === 'manager' || userProfile?.role === 'deputy') ? [{ id: 'reports', icon: BarChart2, label: 'التقارير', grad: 'from-violet-500 to-indigo-600', show: true }] : []),
          ...((isSuperAdmin || userProfile?.canViewAdminTable) && !isCharityRestricted ? [{ id: 'calendar', icon: Calendar, label: 'الأجندة', grad: 'from-blue-500 to-cyan-600', show: true }] : []),
          ...(!isCharityRestricted && (isSuperAdmin || userProfile?.canViewAdminTable) ? [{ id: 'admin', icon: Briefcase, label: 'الإدارة', grad: 'from-amber-500 to-orange-600', show: true }] : []),
      ].filter(x => x.show);

      return (
          <div className="fixed bottom-0 left-0 w-full z-50 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              {/* Blurred backdrop */}
              <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50"/>

              <div className="relative px-4 py-2 flex items-center justify-around">

                  {/* Left side items (before FAB) */}
                  {navItems.slice(0, Math.floor(navItems.length / 2)).map(item => {
                      const isActive = currentView === item.id;
                      return (
                          <button key={item.id} onClick={() => setCurrentView(item.id as any)}
                              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all relative"
                          >
                              {isActive && <div className={`absolute inset-0 bg-gradient-to-b ${item.grad} opacity-10 rounded-2xl`}/>}
                              <div className={`w-6 h-6 flex items-center justify-center transition-all ${ isActive ? 'scale-110' : ''}`}>
                                  <item.icon size={20} className={isActive ? `text-transparent bg-gradient-to-br ${item.grad} bg-clip-text` : 'text-gray-400'} style={isActive ? { filter: 'url(#grad)' } : {}}/>
                              </div>
                              <span className={`text-[9px] font-black transition-all ${ isActive ? 'text-indigo-600' : 'text-gray-400'}`}>{item.label}</span>
                              {isActive && <div className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gradient-to-r ${item.grad} rounded-full`}/>}
                          </button>
                      );
                  })}

                  {/* ── Center FAB ── */}
                  <div className="flex flex-col items-center gap-0.5 -mt-5 relative z-10">
                      <button
                          onClick={() => setIsAddingTaskGlobal(true)}
                          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/40 bg-gradient-to-br from-indigo-500 to-purple-600 text-white transition hover:scale-105 active:scale-95 border-4 border-white dark:border-gray-900"
                      >
                          <Plus size={26} strokeWidth={2.5}/>
                      </button>
                      <span className="text-[9px] font-black text-gray-400">إضافة مهمة</span>
                  </div>

                  {/* Right side items (after FAB) */}
                  {navItems.slice(Math.floor(navItems.length / 2)).map(item => {
                      const isActive = currentView === item.id;
                      return (
                          <button key={item.id} onClick={() => setCurrentView(item.id as any)}
                              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all relative"
                          >
                              {isActive && <div className={`absolute inset-0 bg-gradient-to-b ${item.grad} opacity-10 rounded-2xl`}/>}
                              <div className={`w-6 h-6 flex items-center justify-center transition-all ${ isActive ? 'scale-110' : ''}`}>
                                  <item.icon size={20} className={isActive ? 'text-indigo-600' : 'text-gray-400'}/>
                              </div>
                              <span className={`text-[9px] font-black transition-all ${ isActive ? 'text-indigo-600' : 'text-gray-400'}`}>{item.label}</span>
                              {isActive && <div className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gradient-to-r ${item.grad} rounded-full`}/>}
                          </button>
                      );
                  })}
              </div>
          </div>
      );
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 font-sans text-right pb-16 md:pb-0" dir="rtl">
        <Toaster position="bottom-center" />
        {/* Sidebar (Desktop & Mobile) */}
        {/* Overlay for Mobile */}
        {isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
                onClick={() => setIsSidebarOpen(false)}
            />
        )}

        <aside className={`${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} fixed inset-y-0 right-0 z-50 flex w-[86vw] max-w-[340px] flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-gray-900 md:static md:h-full md:w-72 md:max-w-none md:translate-x-0 md:shadow-none border-l border-gray-100 dark:border-gray-800 shrink-0`}>
            {/* Brand Logo Header */}
            <div className="p-6 pb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700 flex items-center justify-center overflow-hidden p-1.5">
                        <img 
                            src="https://od.lk/s/ODZfNzM1MTAwOTVf/%D9%84%D9%88%D8%AC%D9%88%20%D9%85%D8%B9%D9%88%D8%A7%D9%86.png" 
                            alt="Logo" 
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-800 dark:text-white leading-tight">معوان <span className="text-indigo-600 dark:text-indigo-400">تاسك</span></h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Architecture v2.0</p>
                    </div>
                </div>
            </div>

            {/* User Profile Header */}
            <div className="p-4 flex items-center justify-between group">
                <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 p-1 hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded-lg transition-colors flex-1">
                    <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-[10px] overflow-hidden">
                        {userProfile?.displayName?.[0] || 'U'}
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[120px]">
                        {userProfile?.displayName || user.email?.split('@')[0]}
                    </span>
                    <ChevronDown size={14} className="text-gray-400" />
                </button>
                <div className="flex items-center gap-1">
                    <button className="p-1.5 text-gray-500 hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded-lg relative">
                        <Bell size={18} />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border-2 border-[#FCFAF8] dark:border-gray-900"></span>
                    </button>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1.5 text-gray-500 hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded-lg">
                        <PanelLeft size={18} />
                    </button>
                </div>
            </div>
            
            {/* User Info Bar */}
            <div className="px-4 pb-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center justify-between">
                    <span>{userProfile?.displayName || "مستخدم"}</span>
                    <span>|</span>
                    <span>{DEPARTMENTS.find(d => d.id === userProfile?.departmentId)?.nameAr || "عام"}</span>
                    <span>|</span>
                    <span>{[...USER_ROLES, ...CHARITY_ROLES].find(r => r.id === userProfile?.role)?.name || userProfile?.role || 'عضو'}</span>
                </div>
            </div>
            
            <div className="px-4 mb-2">
                <button 
                    onClick={() => setIsAddingTaskGlobal(true)}
                    className="w-full flex items-center gap-3 px-2 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors group"
                >
                    <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus size={16} strokeWidth={3} />
                    </div>
                    <span className="font-bold text-sm">إضافة مهمة</span>
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 custom-scrollbar">
                <div className="mb-4">
                    <div className="relative px-2 mb-1">
                        <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text"
                            placeholder="بحث"
                            className="w-full pr-9 pl-3 py-1.5 text-sm bg-transparent border-none focus:ring-0 placeholder-gray-400 text-gray-700 dark:text-gray-200"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Overview Button */}
                    <button 
                        onClick={() => { setCurrentView('overview'); setIsSidebarOpen(false); }} 
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors mb-1 ${currentView === 'overview' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                    >
                        <div className="flex items-center gap-3">
                            <Home size={18} className={currentView === 'overview' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                            <span className="font-bold text-sm">النظرة العامة</span>
                        </div>
                    </button>

                    {/* Show these filters ONLY if NOT in Overview */}
                    {currentView !== 'overview' && (
                        <>
                            <button 
                                onClick={() => { setTaskFilter('inbox'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${taskFilter === 'inbox' ? 'bg-[#FEEFEA] text-[#AF3800] dark:bg-red-900/20 dark:text-red-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Inbox size={20} className={taskFilter === 'inbox' ? 'text-[#AF3800]' : 'text-blue-500'} />
                                    <span className="text-sm font-medium">الوارد</span>
                                </div>
                                <span className="text-xs text-gray-400">{tasks.filter(t => (t.assignedToName === userProfile?.displayName || t.targetDept === userProfile?.departmentId) && t.status !== 'completed').length || ''}</span>
                            </button>

                            <button 
                                onClick={() => { setTaskFilter('today'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${taskFilter === 'today' ? 'bg-[#FEEFEA] text-[#AF3800] dark:bg-red-900/20 dark:text-red-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Calendar size={20} className="text-green-600" />
                                    <span className="text-sm font-medium">اليوم</span>
                                </div>
                            </button>

                            <button 
                                onClick={() => { setTaskFilter('upcoming'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${taskFilter === 'upcoming' ? 'bg-[#FEEFEA] text-[#AF3800] dark:bg-red-900/20 dark:text-red-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Calendar size={20} className="text-purple-600" />
                                    <span className="text-sm font-medium">قريباً</span>
                                </div>
                            </button>

                            <button 
                                onClick={() => { setTaskFilter('delayed'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${taskFilter === 'delayed' ? 'bg-[#FEEFEA] text-[#AF3800] dark:bg-red-900/20 dark:text-red-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <AlertCircle size={20} className="text-red-600" />
                                    <span className="text-sm font-medium">متأخرة</span>
                                </div>
                            </button>

                            <button 
                                onClick={() => { setTaskFilter('all'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${taskFilter === 'all' ? 'bg-[#FEEFEA] text-[#AF3800] dark:bg-red-900/20 dark:text-red-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <LayoutDashboard size={20} className="text-indigo-500" />
                                    <span className="text-sm font-medium">الكل</span>
                                </div>
                            </button>

                        {(isSuperAdmin || userProfile?.canViewReports || userProfile?.canManageUsers) && (
                            <button 
                                onClick={() => { setCurrentView('calendar'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${currentView === 'calendar' ? 'bg-[#FEEFEA] text-[#AF3800] dark:bg-red-900/20 dark:text-red-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <LayoutGrid size={20} className="text-orange-500" />
                                    <span className="text-sm font-medium">الأجندة والتقويم</span>
                                </div>
                            </button>
                        )}
                        </>
                    )}
                </div>
                
                <div className="pt-2">
                    {/* Show My Projects ONLY if NOT in Overview */}
                    {currentView !== 'overview' && (
                        <div 
                            onClick={() => { setTaskFilter('projects'); setIsSidebarOpen(false); }}
                            className={`flex items-center justify-between px-3 py-2 group cursor-pointer rounded-lg transition-colors ${taskFilter === 'projects' ? 'bg-[#FEEFEA] text-[#AF3800] dark:bg-red-900/20 dark:text-red-400 font-bold' : 'hover:bg-gray-200/50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                        >
                            <span className="text-sm font-bold">مشاريعي</span>
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); setIsAddingTaskGlobal(true); }} className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-full">
                                    <Plus size={16} className="text-gray-400 hover:text-gray-600" />
                                </button>
                                <ChevronDown size={16} className="text-gray-400" />
                            </div>
                        </div>
                    )}
                    <div className="space-y-0.5 mt-1">
                        {filteredDepartments.filter(d => !isCharityRestricted || d.id === 'charity').map(dept => (
                            <button 
                                key={dept.id} 
                                onClick={() => { setCurrentView(dept.id); setTaskFilter('all'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${currentView === dept.id ? 'bg-[#FEEFEA] text-[#AF3800] dark:bg-red-900/20 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Hash size={18} className={currentView === dept.id ? 'text-[#AF3800]' : 'text-gray-400'} />
                                    <span className="text-sm">{dept.nameAr || dept.name}</span>
                                </div>
                                <span className="text-xs text-gray-400">{tasks.filter(t => t.targetDept === dept.id && t.status !== 'completed').length || ''}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ===== Identity: visible to ALL users ===== */}
                {!isCharityRestricted && (
                    <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
                        <button 
                            onClick={() => { setCurrentView('identity'); setIsSidebarOpen(false); }} 
                            className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${currentView === 'identity' ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                        >
                            <Palette size={18} className="text-pink-500" /> <span className="text-sm">الهوية البصرية</span>
                        </button>
                    </div>
                )}

                {(isSuperAdmin || userProfile?.canManageUsers || userProfile?.canViewAdminTable || userProfile?.canManageOrg || userProfile?.canManageVolunteers || userProfile?.canManageTelegram || userProfile?.canViewReports || userProfile?.role === 'manager' || userProfile?.role === 'deputy') && (
                    <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
                        <p className="text-[10px] font-black text-gray-400 px-3 py-1 uppercase tracking-widest">الإدارة والتحكم</p>
                        
                        {(isSuperAdmin || userProfile?.canManageUsers) && (
                            <button 
                                onClick={() => { setCurrentView('user_management'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${currentView === 'user_management' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <Users size={18} className="text-indigo-600" /> <span className="text-sm">إدارة المستخدمين</span>
                            </button>
                        )}

                        {(isSuperAdmin || userProfile?.canViewAdminTable) && (
                            <button 
                                onClick={() => { setCurrentView('admin'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${currentView === 'admin' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <TableIcon size={18} className="text-green-600" /> <span className="text-sm">جداول البيانات</span>
                            </button>
                        )}

                        {(isSuperAdmin || userProfile?.canManageOrg) && (
                            <button 
                                onClick={() => { setCurrentView('org'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${currentView === 'org' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <Network size={18} className="text-purple-600" /> <span className="text-sm">الهيكلة الإدارية</span>
                            </button>
                        )}

                        {(isSuperAdmin || userProfile?.canEditIdentity) && (
                            <button 
                                onClick={() => { setCurrentView('identity'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${currentView === 'identity' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <Palette size={18} className="text-pink-600" /> <span className="text-sm">تعديل الهوية ✏️</span>
                            </button>
                        )}

                        {(isSuperAdmin || userProfile?.canManageVolunteers) && (
                            <button 
                                onClick={() => { setCurrentView('join_requests'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${currentView === 'join_requests' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <UserPlus size={18} className="text-orange-600" /> <span className="text-sm">طلبات التطوع</span>
                            </button>
                        )}

                        {(isSuperAdmin || userProfile?.canManageTelegram) && (
                            <button 
                                onClick={() => { setShowTelegramConfig(true); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800`}
                            >
                                <Radio size={18} className="text-blue-500" /> <span className="text-sm">إعدادات البوت</span>
                            </button>
                        )}

                        {(isSuperAdmin || userProfile?.canViewReports || userProfile?.role === 'manager' || userProfile?.role === 'deputy') && (
                            <button 
                                onClick={() => { setCurrentView('reports'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${currentView === 'reports' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <ClipboardList size={18} className="text-red-500" /> <span className="text-sm">التقارير</span>
                            </button>
                        )}

                        {isSuperAdmin && (
                            <button 
                                onClick={() => { setCurrentView('blood_bank_users'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${currentView === 'blood_bank_users' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800'}`}
                            >
                                <Droplet size={18} className="text-red-500" /> <span className="text-sm">مستخدمو بنك الدم</span>
                            </button>
                        )}

                        <button onClick={() => { setShowHelp(true); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800">
                            <AlertCircle size={18} /> <span className="text-sm">دليل الاستخدام</span>
                        </button>
                    </div>
                )}
            </nav>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    <LogOut size={16} /> {t.logout}
                </button>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            
            {/* Top Announcement Bar - STATIC SCROLL */}
            {announcements.length > 0 && accessLevel !== 'charity_restricted' && (
                <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg z-50">
                    <div className="flex items-center">
                        <div className="bg-black/20 px-3 py-2 font-black text-xs z-10 flex items-center gap-1 shadow-md whitespace-nowrap shrink-0">
                            <Radio size={14} className="animate-pulse"/> عاجل
                        </div>
                        {/* Static Horizontal Scroll */}
                        <div className="flex-1 overflow-x-auto no-scrollbar py-2 flex items-center gap-6 px-4">
                            {announcements.map((ann, i) => (
                                <span key={i} className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-bold shrink-0">
                                    • {ann.topic} {ann.details && <span className="opacity-80 font-normal">({ann.details})</span>}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Top Bar - Professional Redesign */}
            <header className="bg-white/80 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/60 px-4 md:px-8 py-0 flex justify-between items-center sticky top-0 z-40 h-14 md:h-16">
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition">
                        <PanelLeft size={18} />
                    </button>
                    <button onClick={() => setCurrentView(isSuperAdmin ? 'overview' : (userProfile?.departmentId || 'overview'))} className="md:hidden w-8 h-8 flex items-center justify-center">
                        <img 
                            src="https://od.lk/s/ODZfNzM1MTAwOTVf/%D9%84%D9%88%D8%AC%D9%88%20%D9%85%D8%B9%D9%88%D8%A7%D9%86.png" 
                            alt="Logo" 
                            className="w-full h-full object-contain"
                        />
                    </button>
                    <div className="flex items-center gap-2">
                        {currentView !== 'overview' && (
                            <span className="hidden md:block w-px h-5 bg-gray-200 dark:bg-gray-700" />
                        )}
                        <h2 className="text-sm md:text-base font-semibold text-gray-700 dark:text-gray-200 tracking-tight truncate max-w-[140px] md:max-w-none">
                            {DEPARTMENTS.find(d => d.id === currentView)?.nameAr || 
                             (currentView === 'overview' ? 'نظرة عامة' :
                              currentView === 'calendar' ? t.calendar : 
                              currentView === 'admin' ? t.generalAdmin :
                              currentView === 'reports' ? t.reports :
                              currentView === 'join_requests' ? t.volunteerReq :
                              currentView === 'identity' ? t.identity :
                              currentView === 'org' ? 'الهيكلة الإدارية' : 
                              currentView === 'user_management' ? 'إدارة المستخدمين' : 'لوحة التحكم')}
                        </h2>
                    </div>
                </div>
                
                <div className="flex items-center gap-1.5 md:gap-2">
                    {/* Dark Mode */}
                    <button onClick={() => setDarkMode(!darkMode)} className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition" title={darkMode ? 'وضع نهاري' : 'وضع ليلي'}>
                        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                    
                    {/* Admin Table */}
                    {userProfile?.canViewAdminTable && (
                        <button onClick={() => setCurrentView('admin')} className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition" title="جداول البيانات">
                            <TableIcon size={17} />
                        </button>
                    )}
                    
                    {/* Announcements */}
                    {(isSuperAdmin || userProfile?.canPostAnnouncements) && (
                        <button onClick={() => setShowEventModal(true)} className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition" title="نشر إعلان">
                            <Bell size={17}/>
                        </button>
                    )}
                    
                    {/* Chat */}
                    {accessLevel !== 'charity_restricted' && (isSuperAdmin || userProfile?.role === 'manager' || userProfile?.role === 'deputy') && (
                        <button onClick={() => setCurrentView('chat')} className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition ${currentView === 'chat' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}>
                            <MessageCircle size={17}/>
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                        </button>
                    )}

                    {/* Divider */}
                    <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
                    
                    {/* Profile */}
                    <button onClick={() => setShowSettings(true)} className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">
                        <div className="text-right hidden md:block">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight">{userProfile?.displayName || user.email?.split('@')[0]}</p>
                            <p className="text-[10px] text-gray-400 leading-tight">{[...USER_ROLES, ...CHARITY_ROLES].find(r => r.id === userProfile?.role)?.name || 'عضو'}</p>
                        </div>
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">
                            {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                    </button>
                </div>
            </header>

            {/* View Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                
                {currentView === 'overview' && (
                    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
                        {/* Welcome Banner - Compact on Mobile */}
                        {/* Welcome Banner - Professional Redesign */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-indigo-600 via-indigo-700 to-purple-700 shadow-lg shadow-indigo-500/20">
                            {/* Background texture */}
                            <div className="absolute inset-0 opacity-10" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`}} />
                            {/* Glow */}
                            <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 md:p-6">
                                {/* Left: Identity */}
                                <div>
                                    <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-1">مساء / صباح الخير</p>
                                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-snug">
                                        {userProfile?.displayName || 'عضو الفريق'}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-2.5">
                                        <span className="bg-white/15 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                                            {DEPARTMENTS.find(d => d.id === userProfile?.departmentId)?.nameAr || 'غير محدد'}
                                        </span>
                                        <span className="bg-white/10 text-indigo-200 text-[11px] font-semibold px-3 py-1 rounded-full">
                                            {[...USER_ROLES, ...CHARITY_ROLES].find(r => r.id === userProfile?.role)?.name || 'عضو'}
                                        </span>
                                    </div>
                                </div>
                                {/* Right: Meeting / Announcement */}
                                <div className="w-full md:w-auto md:min-w-[300px]">
                                {announcements.length > 0 ? (
                                    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-right">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">إعلان اجتماع</span>
                                            <Bell size={14} className="text-indigo-200" />
                                        </div>
                                        <p className="text-white font-bold text-sm mb-1">{announcements[0].topic}</p>
                                        <p className="text-indigo-200 text-xs mb-3">{announcements[0].date} — {announcements[0].time}</p>
                                        <div className="flex gap-2">
                                            {(announcements[0].attendees?.includes(user.uid) || announcements[0].apologies?.includes(user.uid)) ? (
                                                <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 py-1.5 rounded-lg text-xs font-semibold text-white w-full justify-center">
                                                    {announcements[0].attendees?.includes(user.uid) ? <><CheckCircle2 size={13} className="text-green-300"/> تم تأكيد الحضور</> : <><X size={13} className="text-red-300"/> تم الاعتذار</>}
                                                </div>
                                            ) : (
                                                <>
                                                    <button 
                                                        onClick={async () => {
                                                            const event = announcements[0];
                                                            if (!event) return;
                                                            await updateDoc(doc(db, "management_meetings", event.id), {
                                                                attendees: [...(event.attendees || []), user.uid]
                                                            });
                                                            const msg = `✅ <b>تأكيد حضور اجتماع</b>\n\n👤 <b>الاسم:</b> ${userProfile?.displayName || user.email}\n📌 <b>الاجتماع:</b> ${event.topic}`;
                                                            if (onSendTelegram && telegramConfig?.generalContacts) {
                                                                telegramConfig.generalContacts.forEach((dept: any) => {
                                                                    dept.contacts.forEach((contact: any) => {
                                                                        if (contact.role === 'hr' || contact.role === 'super_admin') {
                                                                            onSendTelegram(contact.chatId, msg);
                                                                        }
                                                                    });
                                                                });
                                                            }
                                                            alert("تم تأكيد الحضور ✅");
                                                        }}
                                                        className="flex-1 bg-white text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-50 transition flex items-center justify-center gap-1"
                                                    >
                                                        <CheckCircle2 size={13}/> حضور
                                                    </button>
                                                    <button 
                                                        onClick={async () => {
                                                            const reason = prompt("سبب الاعتذار:");
                                                            if(reason) {
                                                                const event = announcements[0];
                                                                await updateDoc(doc(db, "management_meetings", event.id), {
                                                                    apologies: [...(event.apologies || []), user.uid]
                                                                });
                                                                const msg = `❌ <b>اعتذار عن اجتماع</b>\n\n👤 <b>الاسم:</b> ${userProfile?.displayName || user.email}\n📌 <b>الاجتماع:</b> ${event.topic}\n📝 <b>السبب:</b> ${reason}`;
                                                                if (onSendTelegram && telegramConfig?.generalContacts) {
                                                                    telegramConfig.generalContacts.forEach((dept: any) => {
                                                                        dept.contacts.forEach((contact: any) => {
                                                                            if (contact.role === 'hr' || contact.role === 'super_admin') {
                                                                                onSendTelegram(contact.chatId, msg);
                                                                            }
                                                                        });
                                                                    });
                                                                }
                                                                alert("تم إرسال الاعتذار");
                                                            }
                                                        }}
                                                        className="flex-1 bg-white/15 border border-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/25 transition flex items-center justify-center gap-1"
                                                    >
                                                        <X size={13}/> اعتذار
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white/10 border border-white/15 rounded-xl p-4 text-center">
                                        <p className="text-indigo-200 text-xs font-medium">لا توجد اجتماعات معلنة</p>
                                    </div>
                                )}
                                </div>
                            </div>
                        </div>


                        {/* --- MAIN DEPARTMENTS GRID --- */}
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <button onClick={() => setIsAddingTaskGlobal(true)} className="rounded-2xl bg-gray-950 p-4 text-right text-white shadow-sm transition active:scale-[0.98] dark:bg-white dark:text-gray-950">
                                <Plus size={18} className="mb-3" />
                                <p className="text-sm font-black">مهمة جديدة</p>
                                <p className="mt-1 text-[11px] opacity-60">إضافة سريعة للقسم</p>
                            </button>
                            <button onClick={() => { setCurrentView(userProfile?.departmentId || filteredDepartments[0]?.id || 'overview'); setTaskFilter('inbox'); }} className="rounded-2xl border border-gray-200 bg-white p-4 text-right shadow-sm transition active:scale-[0.98] dark:border-gray-700 dark:bg-gray-800">
                                <Inbox size={18} className="mb-3 text-blue-600" />
                                <p className="text-sm font-black text-gray-900 dark:text-white">الوارد</p>
                                <p className="mt-1 text-[11px] text-gray-400">{tasks.filter(t => t.targetDept === userProfile?.departmentId && t.status !== 'completed').length} مهمة</p>
                            </button>
                            <button onClick={() => setCurrentView('calendar')} className="rounded-2xl border border-gray-200 bg-white p-4 text-right shadow-sm transition active:scale-[0.98] dark:border-gray-700 dark:bg-gray-800">
                                <Calendar size={18} className="mb-3 text-emerald-600" />
                                <p className="text-sm font-black text-gray-900 dark:text-white">الأجندة</p>
                                <p className="mt-1 text-[11px] text-gray-400">{announcements.length} إعلان</p>
                            </button>
                            {accessLevel !== 'charity_restricted' && (isSuperAdmin || userProfile?.role === 'manager' || userProfile?.role === 'deputy') && (
                                <button onClick={() => setCurrentView('chat')} className="rounded-2xl border border-gray-200 bg-white p-4 text-right shadow-sm transition active:scale-[0.98] dark:border-gray-700 dark:bg-gray-800">
                                    <MessageCircle size={18} className="mb-3 text-indigo-600" />
                                    <p className="text-sm font-black text-gray-900 dark:text-white">المحادثة</p>
                                    <p className="mt-1 text-[11px] text-gray-400">صفحة كاملة</p>
                                </button>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-xl md:text-2xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                                        <LayoutDashboard size={18} className="text-white"/>
                                    </div>
                                    الأقسام الرئيسية
                                </h3>
                                {user.email === SUPER_ADMIN_EMAIL && (
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 hover:border-indigo-400 hover:text-indigo-600 transition">
                                        <input
                                            type="checkbox"
                                            className="accent-indigo-600 w-3.5 h-3.5"
                                            checked={showMyDeptOnly}
                                            onChange={e => setShowMyDeptOnly(e.target.checked)}
                                        />
                                        عرض قسمي فقط
                                    </label>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                                {filteredDepartments.map(dept => {
                                    return (
                                        <button 
                                            key={dept.id} 
                                            onClick={() => setCurrentView(dept.id)}
                                            className={`relative group overflow-hidden rounded-2xl md:rounded-[2rem] p-4 md:p-6 h-28 md:h-56 flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] border border-gray-100 dark:border-gray-800 ${dept.bgClass} bg-opacity-90 dark:bg-opacity-100`}
                                        >
                                            {/* Decorative Background Icon */}
                                            <dept.icon 
                                                size={100} 
                                                className={`absolute -bottom-6 -left-6 opacity-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 ${dept.textClass} md:w-36 md:h-36`} 
                                            />
                                            
                                            {/* Top Content */}
                                            <div className="relative z-10 flex justify-between items-start">
                                                <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner ${dept.textClass}`}>
                                                    <dept.icon size={20} className="md:w-7 md:h-7" />
                                                </div>
                                                <div className="bg-white/20 p-1.5 md:p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                                    <ArrowUpRight size={16} className="text-white md:w-5 md:h-5" />
                                                </div>
                                            </div>

                                            {/* Bottom Content */}
                                            <div className="relative z-10 text-right">
                                                <h4 className={`text-sm md:text-2xl font-black mb-0.5 md:mb-1 ${dept.textClass} drop-shadow-sm`}>
                                                    {dept.nameAr || dept.name}
                                                </h4>
                                                <p className={`text-[10px] md:text-sm font-bold opacity-80 ${dept.textClass} hidden md:block`}>
                                                    {dept.description || dept.stats || "إدارة القسم"}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Announcements Feed */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-l from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-gray-800">
                                <h3 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <Bell size={18} className="text-indigo-500"/> آخر الإعلانات
                                </h3>
                                <button onClick={() => setCurrentView('calendar')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition">عرض الكل</button>
                            </div>
                            
                            {announcements.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                        <Bell size={20} className="text-gray-300"/>
                                    </div>
                                    <p className="text-gray-400 font-bold text-sm">لا توجد إعلانات حديثة</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {announcements.map((ann, idx) => (
                                        <div key={idx} className="flex gap-4 items-center px-6 py-4 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ ann.locationType === 'online' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' }`}>
                                                {ann.locationType === 'online' ? <Network size={18}/> : <Megaphone size={18}/>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-sm text-gray-800 dark:text-white truncate">{ann.topic}</h4>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{ann.date} — {ann.time}</p>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${ ann.locationType === 'online' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' }`}>
                                                {ann.locationType === 'online' ? 'أونلاين' : 'حضوري'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                )}

                {currentView === 'tasks' && (
                    <TaskBoard 
                        activeDeptId={activeDeptId}
                        tasks={tasks}
                        newTask={newTask}
                        setNewTask={setNewTask}
                        eduType={eduType}
                        setEduType={setEduType}
                        eduData={eduData}
                        setEduData={setEduData}
                        handleAddTask={handleAddTask}
                        toggleStatus={toggleTaskStatus}
                        deleteTask={deleteTask}
                        initiateForward={initiateForward}
                        setSelectedTask={setSelectedTask}
                        updateTaskCategory={updateTaskCategory}
                        updateTaskInternalCategory={updateTaskInternalCategory}
                        renameCategory={renameCategory}
                        user={user}
                        userProfile={userProfile}
                        handleAcceptTask={handleAcceptTask}
                        handleRejectTask={handleRejectTask}
                        onOpenAddTask={(defaults: any) => {
                            setNewTaskDefaults(defaults);
                            setIsAddingTaskGlobal(true);
                        }}
                        deptSettings={deptSettings}
                    />
                )}

                {currentView === 'calendar' && (
                    <CalendarSystem 
                        user={user} 
                        telegramConfig={telegramConfig} 
                        onSendTelegram={onSendTelegram} 
                    />
                )}

                
                {currentView === 'reports' && (
                    <DepartmentReports 
                        user={user} 
                        userProfile={userProfile}
                        departments={filteredDepartments} 
                        telegramConfig={telegramConfig} 
                        onSendTelegram={onSendTelegram}
                    />
                )}

                {currentView === 'org' && <OrgStructureSystem />}
                {currentView === 'identity' && (
                    <div className="h-full md:p-6">
                        <div className="h-full bg-white dark:bg-gray-800 rounded-2xl shadow-premium overflow-y-auto border border-gray-100 dark:border-gray-700">
                            <IdentitySystem user={user} userProfile={userProfile} />
                        </div>
                    </div>
                )}
                {currentView === 'chat' && (
                    <div className="h-full md:p-4">
                        <div className="h-full overflow-hidden bg-white dark:bg-gray-800 md:rounded-2xl md:shadow-premium md:border md:border-gray-100 md:dark:border-gray-700">
                             <ChatSystem 
                                user={user} 
                                userProfile={userProfile} 
                                onClose={() => setCurrentView(userProfile?.departmentId || 'overview')}
                                departments={DEPARTMENTS}
                                telegramConfig={telegramConfig}
                                onSendTelegram={onSendTelegram}
                                tasks={tasks}
                             />
                        </div>
                    </div>
                )}
                {currentView === 'admin' && <AdminTable user={user} mode="general" />}
                {currentView === 'join_requests' && <JoinRequests user={user} userProfile={userProfile} />}
                {currentView === 'user_management' && <UserManagement />}
                {currentView === 'blood_bank_users' && (
                    <ControlCenter user={user} userProfile={userProfile} initialTab="blood_bank" />
                )}
                

                {currentView === 'waman_ahyaaha' && (
                    <WamanAhyaahaSystem 
                        user={user} 
                        telegramConfig={telegramConfig} 
                        deptSettings={deptSettings}
                        onSendTelegram={onSendTelegram}
                        // Passing Task Props for Internal Task Board
                        tasks={tasks.filter(t => t.sourceDept === 'waman_ahyaaha')}
                        newTask={newTask}
                        setNewTask={setNewTask}
                        handleAddTask={handleAddTask}
                        toggleStatus={toggleTaskStatus}
                        deleteTask={deleteTask}
                        setSelectedTask={setSelectedTask}
                        onOpenAddTask={(defaults: any) => {
                            setNewTaskDefaults(defaults);
                            setIsAddingTaskGlobal(true);
                        }}
                    />
                )}

                {/* Inbox / Today / Upcoming / All Views */}
                {['inbox', 'today', 'upcoming', 'all'].includes(currentView) && (
                    <TaskBoard 
                        activeDeptId={currentView}
                        tasks={filteredTasks}
                        newTask={newTask}
                        setNewTask={setNewTask}
                        handleAddTask={handleAddTask}
                        toggleStatus={toggleTaskStatus}
                        deleteTask={deleteTask}
                        initiateForward={initiateForward}
                        onForwardToArt={handleForwardToArt}
                        setSelectedTask={setSelectedTask}
                        updateTaskCategory={updateTaskCategory}
                        updateTaskInternalCategory={updateTaskInternalCategory}
                        renameCategory={renameCategory}
                        user={user}
                        userProfile={userProfile}
                        handleAcceptTask={handleAcceptTask}
                        handleRejectTask={handleRejectTask}
                        isGlobalView={true}
                        onOpenAddTask={(defaults: any) => {
                            setNewTaskDefaults(defaults);
                            setIsAddingTaskGlobal(true);
                        }}
                        currentUserDept={userProfile?.departmentId}
                    />
                )}

                {/* Dynamic Departments Views */}
                {DEPARTMENTS.some(d => d.id === currentView && d.id !== 'waman_ahyaaha' && d.id !== 'educational') && (
                    <TaskBoard 
                        activeDeptId={currentView}
                        tasks={filteredTasks}
                        newTask={newTask}
                        setNewTask={setNewTask}
                        eduType={eduType}
                        setEduType={setEduType}
                        eduData={eduData}
                        setEduData={setEduData}
                        handleAddTask={handleAddTask}
                        toggleStatus={toggleTaskStatus}
                        deleteTask={deleteTask}
                        initiateForward={initiateForward}
                        onForwardToArt={handleForwardToArt}
                        setSelectedTask={setSelectedTask}
                        updateTaskCategory={updateTaskCategory}
                        updateTaskInternalCategory={updateTaskInternalCategory}
                        renameCategory={renameCategory}
                        user={user}
                        userProfile={userProfile}
                        handleAcceptTask={handleAcceptTask}
                        handleRejectTask={handleRejectTask}
                        onOpenAddTask={(defaults: any) => {
                            setNewTaskDefaults(defaults);
                            setIsAddingTaskGlobal(true);
                        }}
                        currentUserDept={userProfile?.departmentId}
                    />
                )}

                {currentView === 'educational' && (
                    <TaskBoard 
                        activeDeptId={currentView}
                        tasks={filteredTasks}
                        newTask={newTask}
                        setNewTask={setNewTask}
                        eduType={eduType}
                        setEduType={setEduType}
                        eduData={eduData}
                        setEduData={setEduData}
                        handleAddTask={handleAddTask}
                        toggleStatus={toggleTaskStatus}
                        deleteTask={deleteTask}
                        initiateForward={initiateForward}
                        onForwardToArt={handleForwardToArt}
                        setSelectedTask={setSelectedTask}
                        updateTaskCategory={updateTaskCategory}
                        updateTaskInternalCategory={updateTaskInternalCategory}
                        renameCategory={renameCategory}
                        user={user}
                        userProfile={userProfile}
                        handleAcceptTask={handleAcceptTask}
                        handleRejectTask={handleRejectTask}
                        onOpenAddTask={(defaults: any) => {
                            setNewTaskDefaults(defaults);
                            setIsAddingTaskGlobal(true);
                        }}
                        currentUserDept={userProfile?.departmentId}
                    />
                )}
            </div>
        </main>

        {/* --- Modals & Overlays --- */}
        

        {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

        <AddTaskModal 
            isOpen={isAddingTaskGlobal} 
            onClose={() => {
                setIsAddingTaskGlobal(false);
                setNewTaskDefaults(null);
            }} 
            onAdd={(data) => handleAddTask(undefined, data)}
            activeDeptId={DEPARTMENTS.some(d => d.id === currentView) ? currentView : (userProfile?.departmentId || 'general')}
            user={user}
            initialData={newTaskDefaults || newTask}
            existingCategories={Array.from(new Set(tasks.filter(t => {
                const target = DEPARTMENTS.some(d => d.id === currentView) ? currentView : (userProfile?.departmentId || 'general');
                return t.sourceDept === target;
            }).map(t => t.category).filter(Boolean))) as string[]}
            projects={projects}
        />

        
        <CustomizeDashboardModal show={showCustomize} onClose={() => setShowCustomize(false)} widgets={widgets} setWidgets={setWidgets} />
        
        <SettingsModal 
            show={showSettings} 
            onClose={() => setShowSettings(false)} 
            editProfileName={editProfileName} 
            setEditProfileName={setEditProfileName} 
            handleUpdateProfile={handleUpdateProfile} 
            userEmail={user.email} 
            onOpenUserManagement={() => setCurrentView('user_management')} 
            userProfile={userProfile}
            setUserProfile={setUserProfile}
        />

        <HRProfileModal 
            show={showHRModal}
            onClose={() => {
                setShowHRModal(false);
                setCurrentView('overview');
            }}
            hrTempName={hrTempName}
            setHrTempName={setHrTempName}
            handleCreateHRProfile={handleCreateHRProfile}
            telegramConfig={telegramConfig}
        />

        <ForwardTaskModal 
            modalState={forwardModal} 
            setModalState={setForwardModal} 
            forwardNote={forwardNote} 
            setForwardNote={setForwardNote} 
            forwardMemberName={forwardMemberName}
            setForwardMemberName={setForwardMemberName}
            confirmForwardTask={confirmForwardTask}
            activeDeptId={activeDeptId}
        />


        <CreateEventModal 
            show={showEventModal} 
            onClose={() => setShowEventModal(false)} 
            newEvent={newEvent} 
            setNewEvent={setNewEvent} 
            handleCreateEvent={handleCreateEvent} 
        />

        {showTelegramConfig && (
            <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-900 w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                    <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700 shrink-0">
                        <h2 className="font-black text-xl text-gray-800 dark:text-white flex items-center gap-2">
                            🤖 إعدادات البوت والإشعارات
                        </h2>
                        <button onClick={() => setShowTelegramConfig(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition text-gray-500 dark:text-gray-400">
                            <X size={22} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <TelegramMotherPanel />
                    </div>
                </div>
            </div>
        )}

            <ProfileSetupModal 
                show={showNameModal} 
                profileSetup={profileSetup}
                setProfileSetup={setProfileSetup}
                saveUserProfile={saveUserProfile}
            />

        {selectedTask && (
            <TaskPulseDrawer 
                task={selectedTask} 
                user={user} 
                userProfile={userProfile} 
                onClose={() => setSelectedTask(null)}
                handleAcceptTask={handleAcceptTask}
                handleRejectTask={handleRejectTask}
                onSendTelegram={onSendTelegram}
                telegramConfig={telegramConfig}
                deptSettings={deptSettings}
            />
        )}

        <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

        <MobileBottomNav />
    </div>
  );
}
