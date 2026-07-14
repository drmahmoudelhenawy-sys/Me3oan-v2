
import React, { useState, useEffect, useRef } from "react";
import { User, signOut } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { recruitmentDb } from "../services/recruitmentFirebase";
import { 
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, 
  where, getDoc, getDocs, setDoc, orderBy, limit, writeBatch, arrayUnion, serverTimestamp, increment
} from "firebase/firestore";
import { 
  LayoutDashboard, Calendar, FileText, Settings, LogOut, 
  MessageCircle, Menu, X, Bell, Network, Palette, Activity, 
  Briefcase, UserPlus, Users, ClipboardList, Megaphone, CheckCircle2, AlertCircle, Clock, ArrowLeft, Table as TableIcon, Home, ArrowUpRight, Radio, Edit, Trash2,
  ChevronDown, PanelLeft, Plus, Search, Inbox, LayoutGrid, Hash, BarChart2, ShieldCheck, Sun, Moon, Droplet, Trophy, RefreshCw, ListFilter, Send
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
import AnnouncementsManager from "./AnnouncementsManager";
import PointsManagement from "./PointsManagement";
import HRPanel from "./HRPanel";

import { 
    WelcomeModal, UserManagementModal, CustomizeDashboardModal, 
    SettingsModal, ForwardTaskModal, 
    CreateEventModal, TelegramConfigModal, ProfileSetupModal, HRProfileModal 
} from "./DashboardModals";
import { DEPARTMENTS, SUPER_ADMIN_EMAIL, CHARITY_ROLES, USER_ROLES, PRIORITIES } from "../utils/constants";
import { TRANSLATIONS } from "../utils/translations";
import {
  resolveDepartmentLeadership,
  resolveMeetingAnnouncementRoute,
  resolveMeetingRoute,
  resolveVolunteerRoute,
  sendTelegramToChatIds,
  type TelegramNotifyMode
} from "../utils/telegramRouting";
import { formatVolunteerSubmissionForTelegram, getSubmissionCreatedMs, normalizeVolunteerSubmission } from "../utils/volunteerSubmissions";
import { awardTaskCompletionPointsOnce, TASK_COMPLETION_POINTS } from "../utils/taskPoints";
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
  const [requests, setRequests] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [deptSettings, setDeptSettings] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  
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
      // Waman Ahyaaha access is strictly controlled by the canAccessWamanAhyaaha permission checkbox
      const isOwnDept = dept.id === userProfile?.departmentId && dept.id !== 'waman_ahyaaha';
      const isGeneral = dept.id === 'general';
      const isManagementGranted = dept.id === 'management' && userProfile?.canAccessSeniorManagement;
      const isWamanAhyaahaGranted = dept.id === 'waman_ahyaaha' && userProfile?.canAccessWamanAhyaaha;
      
      return isOwnDept || isGeneral || isManagementGranted || isWamanAhyaahaGranted;
  });
  
  useEffect(() => {
      const password = localStorage.getItem('special_login_password');
      if (password) {
          setSpecialLoginPassword(password);
      }
  }, [userProfile]);

  useEffect(() => {
      if (!user?.uid) return;
      const unsubscribe = onSnapshot(collection(db, "notifications"), (snapshot) => {
          snapshot.docChanges().forEach((change) => {
              if (change.type !== "added") return;
              const notification = change.doc.data();
              if (notification.type !== "points_adjustment" && notification.type !== "task_points") return;

              const targetId = notification.userId || notification.targetUserId;
              if (targetId !== user.uid || seenPointNotificationIds.current.has(change.doc.id)) return;

              seenPointNotificationIds.current.add(change.doc.id);
              const createdAtMs = notification.createdAt?.toMillis?.() || Date.now();
              if (Date.now() - createdAtMs > 60000) return;

              const points = Number(notification.points || 0);
              const message = notification.body || `${points > 0 ? "+" : ""}${points} نقطة`;
              if (points >= 0) toast.success(message);
              else toast.error(message);
          });
      }, (error) => console.warn("Points notification listener error:", error));

      return () => unsubscribe();
  }, [user.uid]);

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
  const seenPointNotificationIds = useRef<Set<string>>(new Set());

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
          const allowedViews = ['charity', 'overview'];
          if (userProfile?.role === 'charity_president' || userProfile?.role === 'charity_deputy') {
              allowedViews.push('reports');
          }
          if (!allowedViews.includes(currentView)) {
              setCurrentView('charity');
          }
      }
  }, [isCharityRestricted, currentView, userProfile?.role]);

  useEffect(() => {
      // Load User Profile
      const unsubUser = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
          // ── Super Admin / Bypass: auto-create/update profile if missing or incomplete ──
          const isBypassEmail = user.email?.toLowerCase() === "admin_bypass_v2@me3oan.com";
          if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() || isBypassEmail) {
              if (
                  !docSnap.exists() || 
                  !docSnap.data()?.displayName || 
                  !docSnap.data()?.departmentId || 
                  !docSnap.data()?.canManageUsers
              ) {
                  const existingAdminData = docSnap.exists() ? docSnap.data() : {};
                  const adminProfile = {
                      displayName: isBypassEmail ? 'مدير النظام (Bypass)' : 'د. محمود الهناوي',
                      email: user.email,
                      departmentId: 'management',
                      role: existingAdminData?.role || 'manager',
                      canAccessSeniorManagement: true,
                      canManageUsers: true,
                      canViewAdminTable: true,
                      canManageOrg: true,
                      canEditIdentity: true,
                      canManageVolunteers: true,
                      canManageTelegram: true,
                      canPostAnnouncements: true,
                      canViewReports: true,
                      canManagePoints: true,
                      canAccessWamanAhyaaha: true,
                      uid: user.uid,
                      createdAt: existingAdminData?.createdAt || new Date().toISOString(),
                  };
                  await setDoc(doc(db, "users", user.uid), adminProfile, { merge: true });
                  setUserProfile(adminProfile);
                  setEditProfileName(adminProfile.displayName);
                  setShowNameModal(false);
                  return;
              }
          }

          if (docSnap.exists()) {
              const data = docSnap.data();
              setUserProfile(data);
              
              if (data.forceLogout) {
                  updateDoc(doc(db, "users", user.uid), { forceLogout: false });
                  signOut(auth);
              }

              setEditProfileName(data.displayName || "");
              if (!data.displayName) {
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
              setShowNameModal(true);
          }
      });

      const qTasks = query(collection(db, "tasks"));
      const unsubTasks = onSnapshot(qTasks, (snapshot) => {
          const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTasks(tasksData);
          setLoading(false);
      });

      // Load Requests
      const qRequests = query(collection(db, "requests"));
      const unsubRequests = onSnapshot(qRequests, (snapshot) => {
          const requestsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setRequests(requestsData);
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

      // ── Subscribe to Notifications ──
      const notificationsQuery = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(10));
      const unsubNotifications = onSnapshot(notificationsQuery, (snapshot) => {
          setNotificationsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
        unsubRequests(); 
        unsubAnnouncements(); 
        unsubProjects();
        unsubNotifications();
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
          toast.success("New request",
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
                      const msg = formatVolunteerSubmissionForTelegram(data, deptObj?.nameAr || targetDeptId);

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

        const msg = formatVolunteerSubmissionForTelegram(data, deptObj?.nameAr || targetDeptId);
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
      if (!profileSetup.name.trim()) {
          toast.error("الرجاء إكمال جميع البيانات");
          return;
      }
      try {
          await setDoc(doc(db, "users", user.uid), {
              uid: user.uid,
              email: user.email || "",
              displayName: profileSetup.name,
              departmentId: "unassigned",
              role: "member",
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
  const handleAddTask = async (e?: React.FormEvent, taskData?: any) => {
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
              targetDept = activeDeptId !== 'overview' && activeDeptId !== 'all' ? activeDeptId : (userProfile?.departmentId || 'general');
          } else {
              targetDept = activeDeptId !== 'overview' && activeDeptId !== 'all' ? activeDeptId : 'general';
          }
      }

      const myDeptId = userProfile?.departmentId || 'general';
      const createdByName = userProfile?.displayName || user.email;
      const isExternalRequest = targetDept !== myDeptId;

      if (isExternalRequest) {
          // Write to "requests" collection
          const reqRef = await addDoc(collection(db, "requests"), {
              title: finalTitle,
              details: finalDetails,
              sourceDept: myDeptId,
              targetDept: targetDept,
              requestType: dataToUse.requestType || 'custom',
              deadline: dataToUse.deadline || '',
              priority: dataToUse.priority || 'p4',
              attachments: dataToUse.attachments || '',
              status: 'pending_acceptance',
              createdAt: new Date().toISOString(),
              createdBy: user.email,
              createdByName: createdByName,
              selectedLogos: dataToUse.selectedLogos || []
          });

          if (dataToUse.isAlsoForSelf) {
              await addDoc(collection(db, "tasks"), {
                  title: finalTitle,
                  details: finalDetails,
                  targetDept: myDeptId,
                  sourceDept: myDeptId,
                  assignedTo: user.uid,
                  assignedToName: createdByName,
                  progress: 0,
                  status: 'in_progress',
                  dueDate: dataToUse.deadline || '',
                  createdAt: new Date().toISOString(),
                  createdBy: user.email,
                  createdByName: createdByName,
                  isAlsoForSelf: true,
                  linkedRequestId: reqRef.id,
                  requestTargetDept: targetDept
              });
          }

          // Add notification
          try {
              await addDoc(collection(db, "notifications"), {
                  type: "task_forwarded",
                  targetDept: targetDept,
                  fromDept: myDeptId,
                  fromDeptName: DEPARTMENTS.find(d => d.id === myDeptId)?.nameAr || myDeptId,
                  taskTitle: finalTitle,
                  isRead: false,
                  createdAt: new Date().toISOString(),
                  createdBy: createdByName,
              });
          } catch(e) { console.error(e); }

      } else {
          // Write directly to "tasks" collection (Internal Task)
          await addDoc(collection(db, "tasks"), {
              title: finalTitle,
              details: finalDetails,
              targetDept: myDeptId,
              linkedRequestId: null,
              assignedTo: dataToUse.isAlsoForSelf ? user.uid : null,
              assignedToName: dataToUse.isAlsoForSelf ? createdByName : (dataToUse.performerName || ''),
              progress: 0,
              status: 'in_progress',
              dueDate: dataToUse.deadline || '',
              createdAt: new Date().toISOString(),
              createdBy: user.email,
              createdByName: createdByName
          });
      }

      setNewTask({ title: "", details: "", deadline: "", executionDate: "", priority: "p4", targetDept: "", assignedToName: "", category: "", performerName: "" });
      setNewTaskDefaults(null);
  };

  const toggleTaskStatus = async (task: any) => {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const updates: any = { status: newStatus };
      const taskRef = doc(db, "tasks", task.id);
      const batch = writeBatch(db);

      if (newStatus === 'completed') {
          updates.completedAt = Date.now();
          if (!task.pointsAwardedTo) {
              updates.pointsAwardedTo = user.uid;
              updates.pointsAwardedToName = userProfile?.displayName || user.email || "مستخدم";
              updates.pointsAwarded = TASK_COMPLETION_POINTS;
              updates.pointsAwardedAt = Date.now();

              batch.update(doc(db, "users", user.uid), {
                  pointsTotal: increment(TASK_COMPLETION_POINTS),
                  pointsFromTasks: increment(TASK_COMPLETION_POINTS),
                  pointsUpdatedAt: serverTimestamp()
              });
              batch.set(doc(collection(db, "points_logs")), {
                  userId: user.uid,
                  userName: userProfile?.displayName || user.email || "مستخدم",
                  taskId: task.id,
                  taskTitle: task.title || "مهمة بدون عنوان",
                  points: TASK_COMPLETION_POINTS,
                  type: "task_completed",
                  reason: "إتمام مهمة",
                  createdAt: serverTimestamp()
              });
              batch.set(doc(collection(db, "notifications")), {
                  type: "task_points",
                  userId: user.uid,
                  targetUserId: user.uid,
                  taskId: task.id,
                  title: "نقاط جديدة من إتمام مهمة",
                  body: `+${TASK_COMPLETION_POINTS} نقطة لإتمام مهمة: ${task.title || "مهمة بدون عنوان"}`,
                  points: TASK_COMPLETION_POINTS,
                  isRead: false,
                  createdAt: serverTimestamp()
              });
          }
      } else if (task.pointsAwardedTo) {
          const awardedPoints = Number(task.pointsAwarded || TASK_COMPLETION_POINTS);
          updates.pointsAwardedTo = null;
          updates.pointsAwardedToName = null;
          updates.pointsAwarded = 0;
          updates.pointsAwardedAt = null;
          updates.pointsRevokedAt = Date.now();

          batch.update(doc(db, "users", task.pointsAwardedTo), {
              pointsTotal: increment(-awardedPoints),
              pointsFromTasks: increment(-awardedPoints),
              pointsUpdatedAt: serverTimestamp()
          });
          batch.set(doc(collection(db, "points_logs")), {
              userId: task.pointsAwardedTo,
              userName: task.pointsAwardedToName || "مستخدم",
              taskId: task.id,
              taskTitle: task.title || "مهمة بدون عنوان",
              points: -awardedPoints,
              type: "task_reopened",
              reason: "إعادة فتح مهمة مكتملة",
              createdAt: serverTimestamp()
          });
          batch.set(doc(collection(db, "notifications")), {
              type: "task_points",
              userId: task.pointsAwardedTo,
              targetUserId: task.pointsAwardedTo,
              taskId: task.id,
              title: "تم سحب نقاط مهمة",
              body: `-${awardedPoints} نقطة بسبب إعادة فتح مهمة: ${task.title || "مهمة بدون عنوان"}`,
              points: -awardedPoints,
              isRead: false,
              createdAt: serverTimestamp()
          });
      }
            batch.update(taskRef, updates);
      await batch.commit();

      // Status Sync for Forwarded Tasks
      if (task.originalTaskId) {
          try {
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

          // Update in settings
          if (userProfile?.departmentId) {
              const currentCats = deptSettings?.categories || [];
              const updatedCats = currentCats.map((c: string) => c === oldCategory ? newCategory : c);
              if (!updatedCats.includes(newCategory) && currentCats.includes(oldCategory)) {
                  updatedCats.push(newCategory);
              }
              await setDoc(doc(db, "department_settings", userProfile.departmentId), {
                  categories: updatedCats
              }, { merge: true });
          }
          toast.success("تم تغيير اسم القسم بنجاح");
      } catch (e) {
          console.error("Error renaming category:", e);
          toast.error("حدث خطأ أثناء تغيير الاسم");
      }
  };

  const addCategory = async (categoryName: string) => {
      if (!categoryName || !userProfile?.departmentId) return;
      try {
          const currentCats = deptSettings?.categories || [];
          if (currentCats.includes(categoryName)) {
              toast.error("هذا القسم موجود بالفعل");
              return;
          }
          await setDoc(doc(db, "department_settings", userProfile.departmentId), {
              categories: [...currentCats, categoryName]
          }, { merge: true });
          toast.success("تم إضافة القسم بنجاح");
      } catch (e) {
          console.error("Error adding category:", e);
          toast.error("حدث خطأ أثناء إضافة القسم");
      }
  };

  const deleteCategory = async (categoryName: string) => {
      if (!categoryName) return;
      try {
          const q = query(collection(db, "tasks"), where("category", "==", categoryName));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => {
              batch.update(doc.ref, { category: "" });
          });
          await batch.commit();

          // Also remove from settings list
          if (userProfile?.departmentId) {
              const currentCats = deptSettings?.categories || [];
              const updatedCats = currentCats.filter((c: string) => c !== categoryName);
              await setDoc(doc(db, "department_settings", userProfile.departmentId), {
                  categories: updatedCats
              }, { merge: true });
          }
          toast.success("تم حذف القسم بنجاح وإلغاء تصنيف مهامه");
      } catch (e) {
          console.error("Error deleting category:", e);
          toast.error("حدث خطأ أثناء حذف القسم");
      }
  };

  const deleteTask = async (id: string) => {
      if (confirm("هل أنت متأكد من الحذف؟")) {
          try {
              const reqRef = doc(db, "requests", id);
              const reqSnap = await getDoc(reqRef);
              
              if (reqSnap.exists()) {
                  // It is a request ID: delete request and all linked tasks
                  await deleteDoc(reqRef);
                  const q = query(collection(db, "tasks"), where("linkedRequestId", "==", id));
                  const snap = await getDocs(q);
                  const batch = writeBatch(db);
                  snap.docs.forEach(doc => batch.delete(doc.ref));
                  await batch.commit();
                  toast.success("تم الحذف بنجاح");
              } else {
                  // Try finding task ID
                  const taskRef = doc(db, "tasks", id);
                  const taskSnap = await getDoc(taskRef);
                  if (taskSnap.exists()) {
                      const taskData = taskSnap.data();
                      if (taskData?.linkedRequestId) {
                          // Linked: delete root request and all tasks
                          await deleteDoc(doc(db, "requests", taskData.linkedRequestId));
                          const q = query(collection(db, "tasks"), where("linkedRequestId", "==", taskData.linkedRequestId));
                          const snap = await getDocs(q);
                          const batch = writeBatch(db);
                          snap.docs.forEach(doc => batch.delete(doc.ref));
                          await batch.commit();
                      } else {
                          // Simple task: delete only
                          await deleteDoc(taskRef);
                      }
                      toast.success("تم الحذف بنجاح");
                  } else {
                      toast.error("لم يتم العثور على العنصر المطلوب حذفه");
                  }
              }
          } catch(e) {
              console.error("Error deleting task/request:", e);
              toast.error("حدث خطأ أثناء الحذف");
          }
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

      // Create the request document in requests collection instead of tasks
      const newReqRef = await addDoc(collection(db, "requests"), {
          title: forwardModal.task.title,
          details: details,
          sourceDept: activeDeptId,           // ← the dept that SENT it
          targetDept: finalTargetDeptId,     // ← the dept that RECEIVES it
          requestType: 'forwarded',
          priority: urgency === 'very_urgent' ? 'p1' : urgency === 'urgent' ? 'p2' : (forwardModal.task.priority || 'p4'),
          deadline: forwardModal.task.deadline || '',
          status: 'pending_acceptance',
          createdAt: forwardedAt,
          createdBy: user.email,
          createdByName: userProfile?.displayName || user.email,
          selectedLogos: selectedLogos || [],
          originalTaskId: forwardModal.task.id || null
      });

      // Update the original task status to 'forwarded' so it hides from active board
      const origTaskRef = doc(db, "tasks", forwardModal.task.id);
      await updateDoc(origTaskRef, {
          status: 'forwarded',
          updatedAt: serverTimestamp()
      });

      // Create in-app notification for the target dept linking to request
      try {
          await addDoc(collection(db, "notifications"), {
              type: 'task_forwarded',
              targetDept: finalTargetDeptId,
              fromDept: activeDeptId,
              fromDeptName: sourceDeptName,
              taskId: newReqRef.id,
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
          const isFromHrAdmin = activeDeptId === 'hr';
          const headerLabel = isFromHrAdmin ? '<b>تكليفات الموارد البشرية</b>' : '<b>مهمة محوَّلة جديدة</b>';
          const msg = `${urgencyEmoji}\n${headerLabel}\n\n📤 <b>من القسم:</b> ${sourceDeptName}\n👤 <b>المحوِّل:</b> ${userProfile?.displayName || user.email}\n📥 <b>إلى القسم:</b> ${targetDeptName}\n📌 <b>عنوان المهمة:</b> ${forwardModal.task.title}${detailsPreview ? `\n📝 <b>نص المهمة:</b> ${detailsPreview}` : ''}\n🚦 <b>الأولوية / الحالة:</b> ${urgency === 'very_urgent' ? 'عاجلة جداً' : urgency === 'urgent' ? 'عاجلة' : 'عادية'}\n📅 <b>تاريخ ووقت التحويل:</b> ${forwardedAtText}${forwardNote ? `\n💬 <b>ملاحظة التحويل:</b> ${forwardNote}` : ''}${forwardMemberName ? `\n👤 <b>تعيين إلى:</b> ${forwardMemberName}` : ''}${(selectedLogos ?? []).length > 0 ? `\n🖼 <b>اللوجوهات:</b> ${selectedLogos!.join(', ')}` : ''}`;

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

      // ── Log to messages subcollection ──
      try {
          await addDoc(collection(db, "requests", newReqRef.id, "messages"), {
              type: 'system',
              message: `⚙️ تم تحويل المهمة من قسم ${sourceDeptName} إلى قسم ${targetDeptName}`,
              senderId: user.uid,
              senderName: userProfile?.displayName || user.email,
              senderAvatar: userProfile?.photoURL || "",
              seenBy: [user.uid],
              createdAt: serverTimestamp()
          });
      } catch(e) { console.error('Pulse log error:', e); }
  };

  const syncLinkedTasksStatus = async (requestId: string, requestStatus: string, note?: string) => {
    try {
      const normalizedStatus = requestStatus === 'revision_requested'
        ? 'revision'
        : requestStatus === 'waiting_review'
          ? 'executed'
          : requestStatus;
      const q = query(collection(db, "tasks"), where("linkedRequestId", "==", requestId));
      const snap = await getDocs(q);
      if (snap.empty) return;

      const batch = writeBatch(db);
      snap.docs.forEach(taskDoc => {
        const tdata = taskDoc.data();
        let taskNewStatus = tdata.status;
        let updates: any = {};

        if (normalizedStatus === 'completed') {
          taskNewStatus = 'completed';
          updates.progress = 100;
          updates.revisionRequested = false;
          updates.revisionNote = "";
        } else if (normalizedStatus === 'executed') {
          taskNewStatus = 'executed';
          updates.progress = 90;
          updates.revisionRequested = false;
        } else if (normalizedStatus === 'revision') {
          taskNewStatus = 'revision';
          updates.progress = 90;
          updates.revisionRequested = true;
          updates.revisionNote = note || "";
        } else if (normalizedStatus === 'accepted') {
          taskNewStatus = 'accepted';
          updates.progress = Math.max(Number(tdata.progress || 0), 10);
        } else if (normalizedStatus === 'rejected') {
          taskNewStatus = 'rejected';
        }

        updates.status = taskNewStatus;
        updates.updatedAt = serverTimestamp();
        batch.update(taskDoc.ref, updates);
      });
      await batch.commit();
    } catch(e) {
      console.error("Error syncing linked tasks status:", e);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string, note?: string) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      const updates: any = { 
        status: newStatus,
        updatedAt: serverTimestamp()
      };
      
      if (newStatus === 'completed') {
        updates.progress = 100;
        updates.revisionRequested = false;
      } else if (newStatus === 'executed') {
        updates.revisionRequested = false;
      }

      await updateDoc(taskRef, updates);

      // Create event message in task unified messages subcollection
      let msgType = 'system';
      let messageAr = '';
      const creatorName = userProfile?.displayName || user.email;
      if (newStatus === 'completed') {
        msgType = 'approval';
        messageAr = `✅ تم اعتماد وإتمام المهمة: ${note || ''}`;
      } else if (newStatus === 'revision') {
        msgType = 'revision';
        messageAr = `🔄 مطلوب إعادة تعديل على التصميم: ${note || ''}`;
      } else if (newStatus === 'executed') {
        msgType = 'delivery';
        messageAr = `📎 تم تسليم نسخة جديدة للمراجعة.`;
      } else if (newStatus === 'accepted') {
        messageAr = `✔ تم قبول الطلب وبدء التنفيذ.`;
      }

      if (messageAr) {
        try {
          await addDoc(collection(db, "tasks", taskId, "messages"), {
            type: msgType,
            message: messageAr,
            senderId: user.uid,
            senderName: creatorName,
            senderAvatar: userProfile?.photoURL || "",
            seenBy: [user.uid],
            createdAt: serverTimestamp()
          });
        } catch(e) {
          console.error("Failed to add message doc:", e);
        }
      }

      // If this task is linked to a request, sync status
      const taskSnap = await getDoc(taskRef);
      const taskData = taskSnap.data();
      if (taskData?.linkedRequestId) {
          const reqRef = doc(db, "requests", taskData.linkedRequestId);
          let reqStatus = newStatus;
          if (newStatus === 'accepted') reqStatus = 'accepted';
          if (newStatus === 'executed') reqStatus = 'executed';
          if (newStatus === 'revision') reqStatus = 'revision';
          if (newStatus === 'completed') reqStatus = 'completed';

          await updateDoc(reqRef, {
              status: reqStatus,
              updatedAt: serverTimestamp()
          });
          
          if (messageAr) {
            try {
              await addDoc(collection(db, "requests", taskData.linkedRequestId, "messages"), {
                type: msgType,
                message: messageAr,
                senderId: user.uid,
                senderName: creatorName,
                senderAvatar: userProfile?.photoURL || "",
                seenBy: [user.uid],
                createdAt: serverTimestamp()
              });
            } catch(e) {}
          }
          await syncLinkedTasksStatus(taskData.linkedRequestId, reqStatus, note);
      }

    } catch (error) {
      console.error("Error updating status:", error);
      alert("حدث خطأ أثناء تحديث حالة الطلب.");
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: string, note?: string) => {
    try {
      const normalizedStatus = newStatus === 'revision_requested'
        ? 'revision'
        : newStatus === 'waiting_review'
          ? 'executed'
          : newStatus;
      const reqRef = doc(db, "requests", requestId);
      const updates: any = {
        status: normalizedStatus,
        updatedAt: serverTimestamp()
      };
      
      if (normalizedStatus === 'completed') {
        updates.completedAt = serverTimestamp();
        updates.revisionNote = "";
      } else if (normalizedStatus === 'revision' && note) {
        updates.revisionNote = note;
        updates.revisionAt = serverTimestamp();
      }

      await updateDoc(reqRef, updates);

      // Create event message in request messages subcollection
      let msgType = 'system';
      let messageAr = '';
      const creatorName = userProfile?.displayName || user.email;
      if (normalizedStatus === 'completed') {
        msgType = 'approval';
        messageAr = `✅ تم اعتماد وإتمام الطلب: ${note || ''}`;
      } else if (normalizedStatus === 'revision') {
        msgType = 'revision';
        messageAr = `🔄 مطلوب تعديل على التصميم: ${note || ''}`;
      } else if (normalizedStatus === 'accepted') {
        messageAr = `✔ تم قبول الطلب وبدء العمل.`;
      }

      if (messageAr) {
        try {
          await addDoc(collection(db, "requests", requestId, "messages"), {
            type: msgType,
            message: messageAr,
            senderId: user.uid,
            senderName: creatorName,
            senderAvatar: userProfile?.photoURL || "",
            seenBy: [user.uid],
            createdAt: serverTimestamp()
          });
        } catch(e) {}
      }

      await syncLinkedTasksStatus(requestId, normalizedStatus, note);

      if (normalizedStatus === 'completed') {
        await awardTaskCompletionPointsOnce({
          requestId,
          fallbackUserId: user.uid,
          fallbackUserName: userProfile?.displayName || user.email,
        });
      }

    } catch(e) {
      console.error(e);
      alert("حدث خطأ أثناء تحديث حالة الطلب.");
    }
  };

  const handleAcceptTask = async (request: any) => {
      try {
          if (!request?.id) {
              toast.error("تعذر قبول الطلب: معرف الطلب غير موجود");
              return;
          }

          const actorName = userProfile?.displayName || user?.email || 'مستخدم';

          // 1. Update request status
          await updateDoc(doc(db, "requests", request.id), {
              status: 'accepted',
              acceptedAt: serverTimestamp(),
              acceptedBy: actorName,
          });

          // Sync tracking tasks
          await syncLinkedTasksStatus(request.id, 'accepted');

          // 2. Spawn one linked internal executing task
          const existingLinkedTasks = await getDocs(query(
              collection(db, "tasks"),
              where("linkedRequestId", "==", request.id),
              where("targetDept", "==", request.targetDept || "general")
          ));

          if (existingLinkedTasks.empty) {
              await addDoc(collection(db, "tasks"), {
                  title: request.title || "",
                  details: request.details || "",
                  targetDept: request.targetDept || "general",
                  sourceDept: request.sourceDept || 'general',
                  originalSourceDept: request.sourceDept || 'general',
                  linkedRequestId: request.id || null,
                  assignedTo: null,
                  assignedToName: '',
                  progress: 0,
                  status: 'in_progress',
                  dueDate: request.deadline || '',
                  createdAt: new Date().toISOString(),
                  createdBy: request.createdBy || '',
                  createdByName: request.createdByName || ''
              });
          }

          // Pulse log for request
          try {
              await addDoc(collection(db, "requests", request.id, "pulse"), {
                  type: 'activity',
                  text: `تم قبول الطلب في قسم ${DEPARTMENTS.find(d => d.id === request.targetDept)?.nameAr || request.targetDept}`,
                  user: actorName,
                  timestamp: serverTimestamp()
              });
          } catch(e) { console.error(e); }

          toast.success("تم قبول الطلب وبدء العمل عليه كمهام داخلية");
      } catch (e) {
          console.error(e);
          toast.error("حدث خطأ أثناء قبول الطلب");
      }
  };

  const handleRejectTask = async (request: any, reason: string) => {
      try {
          if (!request?.id) {
              toast.error("تعذر رفض الطلب: معرف الطلب غير موجود");
              return;
          }

          const actorName = userProfile?.displayName || user?.email || 'مستخدم';

          // Update request status
          await updateDoc(doc(db, "requests", request.id), {
              status: 'rejected',
              rejectionReason: reason,
              rejectedAt: serverTimestamp(),
              rejectedBy: actorName
          });

          // Sync tracking tasks
          await syncLinkedTasksStatus(request.id, 'rejected');

          // Pulse log for request
          try {
              await addDoc(collection(db, "requests", request.id, "pulse"), {
                  type: 'activity',
                  text: `تم رفض الطلب. السبب: ${reason}`,
                  user: actorName,
                  timestamp: serverTimestamp()
              });
          } catch(e) { console.error(e); }

          toast.success("تم رفض الطلب وإبلاغ القسم المرسل");
      } catch (e) {
          console.error(e);
          toast.error("حدث خطأ أثناء رفض الطلب");
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
          { id: 'overview', icon: Home, label: 'الرئيسية', grad: 'from-slate-700 to-slate-950', show: true },
          ...(!isCharityRestricted ? [{ id: 'identity', icon: Palette, label: 'الهوية', grad: 'from-pink-500 to-rose-600', show: true }] : []),
          ...((isSuperAdmin || userProfile?.canViewReports || userProfile?.role === 'manager' || userProfile?.role === 'deputy') ? [{ id: 'reports', icon: BarChart2, label: 'التقارير', grad: 'from-violet-500 to-indigo-600', show: true }] : []),
          ...((isSuperAdmin || userProfile?.canViewAdminTable) && !isCharityRestricted ? [{ id: 'calendar', icon: Calendar, label: 'الأجندة', grad: 'from-blue-500 to-cyan-600', show: true }] : []),
          ...(!isCharityRestricted && (isSuperAdmin || userProfile?.canViewAdminTable) ? [{ id: 'admin', icon: Briefcase, label: 'الإدارة', grad: 'from-amber-500 to-orange-600', show: true }] : []),
      ].filter(x => x.show);

      return (
          <div className="android-bottom-nav fixed bottom-0 left-0 w-full z-50 md:hidden">
              <div className="relative flex items-center justify-around gap-1">

                  {/* Left side items (before FAB) */}
                  {navItems.slice(0, Math.floor(navItems.length / 2)).map(item => {
                      const isActive = currentView === item.id;
                      return (
                          <button key={item.id} onClick={() => setCurrentView(item.id as any)}
                              className={`android-nav-item android-touch flex flex-col items-center justify-center gap-0.5 px-2 transition-all relative ${isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-400 dark:text-slate-500'}`}
                          >
                              {isActive && <div className={`absolute inset-x-1 top-1 bottom-1 bg-gradient-to-b ${item.grad} opacity-10 rounded-[18px]`}/>}
                              <div className={`relative z-10 h-6 flex items-center justify-center transition-all ${ isActive ? 'scale-110' : ''}`}>
                                  <item.icon size={21} className={isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-400 dark:text-slate-500'} />
                              </div>
                              <span className={`relative z-10 text-[10px] font-black leading-none transition-all ${ isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>{item.label}</span>
                          </button>
                      );
                  })}

                  {/* ── Center FAB ── */}
                  <div className="flex flex-col items-center gap-0.5 -mt-8 relative z-10">
                      <button
                          onClick={() => setIsAddingTaskGlobal(true)}
                          className="android-fab flex items-center justify-center bg-indigo-600 text-white transition border-[5px] border-white dark:border-slate-900"
                      >
                          <Plus size={26} strokeWidth={2.5}/>
                      </button>
                      <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 leading-none">إضافة</span>
                  </div>

                  {/* Right side items (after FAB) */}
                  {navItems.slice(Math.floor(navItems.length / 2)).map(item => {
                      const isActive = currentView === item.id;
                      return (
                          <button key={item.id} onClick={() => setCurrentView(item.id as any)}
                              className={`android-nav-item android-touch flex flex-col items-center justify-center gap-0.5 px-2 transition-all relative ${isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-400 dark:text-slate-500'}`}
                          >
                              {isActive && <div className={`absolute inset-x-1 top-1 bottom-1 bg-gradient-to-b ${item.grad} opacity-10 rounded-[18px]`}/>}
                              <div className={`relative z-10 h-6 flex items-center justify-center transition-all ${ isActive ? 'scale-110' : ''}`}>
                                  <item.icon size={21} className={isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-400 dark:text-slate-500'}/>
                              </div>
                              <span className={`relative z-10 text-[10px] font-black leading-none transition-all ${ isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>{item.label}</span>
                          </button>
                      );
                  })}
              </div>
          </div>
      );
  };

  // --- Render ---

  const isUnassigned = !isSuperAdmin && (!userProfile?.departmentId || !userProfile?.role || userProfile?.departmentId === 'unassigned');

  if (isUnassigned) {
      return (
          <div className="min-h-screen bg-[#020617] flex flex-col font-sans text-right selection:bg-indigo-500/30" dir="rtl">
              <Toaster position="bottom-center" />
              {/* Top Header */}
              <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex justify-between items-center z-40">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center overflow-hidden p-1.5 border border-white/10">
                          <img 
                              src="https://od.lk/s/ODZfNzM1MTAwOTVf/%D9%84%D9%88%D8%AC%D9%88%20%D9%85%D8%B9%D9%88%D8%A7%D9%86.png" 
                              alt="Logo" 
                              className="w-full h-full object-contain brightness-0 invert"
                          />
                      </div>
                      <h1 className="text-xl font-black text-white">معوان <span className="text-indigo-400">تاسك</span></h1>
                  </div>
                  <div className="flex items-center gap-3">
                      <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 text-slate-300 text-xs font-bold hover:bg-white/10 transition">
                          إعدادات الاسم
                      </button>
                      <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition">
                          <LogOut size={14} /> تسجيل الخروج
                      </button>
                  </div>
              </header>

              {/* Waiting content */}
              <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
                  <div className="absolute inset-0 z-0">
                     <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />
                     <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
                  </div>

                  <div className="w-full max-w-lg bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 text-center relative z-10 shadow-2xl space-y-6">
                      <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
                          <Clock size={36} />
                      </div>
                      
                      <div className="space-y-3">
                          <h2 className="text-2xl font-black text-white">أهلاً بك في عائلة معوان، {userProfile?.displayName || 'عضو الفريق'}</h2>
                          <p className="text-slate-400 text-sm font-medium leading-relaxed">
                              تم تسجيل حسابك بنجاح في النظام وهو قيد الانتظار حالياً.
                          </p>
                      </div>

                      <div className="bg-indigo-950/40 border border-indigo-500/20 p-5 rounded-2xl text-indigo-200 text-xs leading-relaxed font-bold text-right">
                          💡 <b>ما الخطوة التالية؟</b>
                          <p className="mt-2 text-slate-300 font-medium leading-6">
                              يرجى الانتظار حتى يقوم المدير العام أو مسؤول الموارد البشرية بتعيين <b>القسم واللقب (الصفة)</b> الخاص بك. بمجرد تعيينهما، ستظهر لك لوحة التحكم ومهامك تلقائياً دون الحاجة لإعادة تسجيل الدخول.
                          </p>
                      </div>
                  </div>
              </div>

              {showNameModal && (
                  <ProfileSetupModal 
                      show={showNameModal} 
                      profileSetup={profileSetup} 
                      setProfileSetup={setProfileSetup} 
                      saveUserProfile={saveUserProfile} 
                      onLogout={handleLogout}
                  />
              )}

              <SettingsModal 
                  show={showSettings} 
                  onClose={() => setShowSettings(false)} 
                  editProfileName={editProfileName} 
                  setEditProfileName={setEditProfileName} 
                  handleUpdateProfile={handleUpdateProfile} 
                  userEmail={user.email} 
                  onOpenUserManagement={() => {}} 
                  userProfile={userProfile}
                  setUserProfile={setUserProfile}
              />
          </div>
      );
  }

  return (
    <div className="app-screen flex bg-white dark:bg-gray-900 font-sans text-right" dir="rtl">
        <Toaster position="bottom-center" />
        {/* Sidebar (Desktop & Mobile) */}
        {/* Overlay for Mobile */}
        {isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
                onClick={() => setIsSidebarOpen(false)}
            />
        )}

        <aside className={`${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} fixed inset-y-0 right-0 z-50 flex w-[88vw] max-w-[360px] flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-gray-900 md:static md:h-full md:w-72 md:max-w-none md:translate-x-0 md:shadow-none border-l border-gray-100 dark:border-gray-800 shrink-0 md:rounded-none rounded-l-[28px] overflow-hidden`}>
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

                        <nav className="flex-1 overflow-y-auto px-2 space-y-1.5 custom-scrollbar">
                <div className="space-y-0.5">
                    <button 
                        onClick={() => { setCurrentView('overview'); setIsSidebarOpen(false); }} 
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${currentView === 'overview' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-black shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                    >
                        <div className="flex items-center gap-3">
                            <Home size={18} className={currentView === 'overview' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                            <span className="text-sm">الرئيسية</span>
                        </div>
                    </button>

                    <button 
                        onClick={() => { setCurrentView('my_tasks'); setIsSidebarOpen(false); }} 
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${currentView === 'my_tasks' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-black shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                    >
                        <div className="flex items-center gap-3">
                            <ListFilter size={18} className={currentView === 'my_tasks' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                            <span className="text-sm">مهامي</span>
                        </div>
                    </button>

                    {(() => {
                        const incomingCount = requests.filter(r => 
                            r.targetDept === userProfile?.departmentId && 
                            r.status === 'pending_acceptance' && 
                            r.sourceDept !== 'hr'
                        ).length;
                        return (
                            <button 
                                onClick={() => { setCurrentView('incoming_requests'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${currentView === 'incoming_requests' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-black shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Inbox size={18} className={currentView === 'incoming_requests' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                                    <span className="text-sm">الطلبات الواردة</span>
                                </div>
                                {incomingCount > 0 && (
                                    <span className="bg-indigo-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200 dark:shadow-none">
                                        {incomingCount}
                                    </span>
                                )}
                            </button>
                        );
                    })()}

                    {/* HR & Admin Dedicated Assignments Tab */}
                    {userProfile?.departmentId !== 'hr' && userProfile?.departmentId !== 'general' && (() => {
                        const pendingHrAdminCount = requests.filter(r => 
                            r.targetDept === userProfile?.departmentId && 
                            r.status === 'pending_acceptance' && 
                            r.sourceDept === 'hr'
                        ).length;
                        return (
                            <button 
                                onClick={() => { setCurrentView('hr_admin_assignments'); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${currentView === 'hr_admin_assignments' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-black shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Briefcase size={18} className={currentView === 'hr_admin_assignments' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                                    <span className="text-sm">تكليفات الموارد البشرية</span>
                                </div>
                                {pendingHrAdminCount > 0 && (
                                    <span className="bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200 dark:shadow-none">
                                        {pendingHrAdminCount}
                                    </span>
                                )}
                            </button>
                        );
                    })()}

                    <button 
                        onClick={() => { setCurrentView('outgoing_requests'); setIsSidebarOpen(false); }} 
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${currentView === 'outgoing_requests' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-black shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                    >
                        <div className="flex items-center gap-3">
                            <Send size={18} className={currentView === 'outgoing_requests' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                            <span className="text-sm">الطلبات الصادرة</span>
                        </div>
                    </button>

                    <button 
                        onClick={() => { setCurrentView('completed_tasks'); setIsSidebarOpen(false); }} 
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${currentView === 'completed_tasks' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-black shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                    >
                        <div className="flex items-center gap-3">
                            <CheckCircle2 size={18} className={currentView === 'completed_tasks' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                            <span className="text-sm">المهام المنتهية</span>
                        </div>
                    </button>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
                    <button 
                        onClick={() => { setCurrentView('calendar'); setIsSidebarOpen(false); }} 
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${currentView === 'calendar' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-black' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                    >
                        <Calendar size={18} className="text-indigo-500" /> <span className="text-sm">التقويم</span>
                    </button>

                    {(isSuperAdmin || userProfile?.canManageUsers) && (
                        <button 
                            onClick={() => { setCurrentView('user_management'); setIsSidebarOpen(false); }} 
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${currentView === 'user_management' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-black' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                        >
                            <Users size={18} className="text-purple-600" /> <span className="text-sm">فريقي</span>
                        </button>
                    )}

                    {(isSuperAdmin || userProfile?.canViewReports) && (
                        <button 
                            onClick={() => { setCurrentView('reports'); setIsSidebarOpen(false); }} 
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${currentView === 'reports' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-black' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                        >
                            <BarChart2 size={18} className="text-emerald-600" /> <span className="text-sm">التقارير</span>
                        </button>
                    )}

                    <button 
                        onClick={() => { setCurrentView('chat'); setIsSidebarOpen(false); }} 
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${currentView === 'chat' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-black' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                    >
                        <MessageCircle size={18} className="text-sky-600" /> <span className="text-sm">الإشعارات</span>
                    </button>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
                    {(isSuperAdmin || userProfile?.departmentId === 'hr' || userProfile?.canViewHR) && (
                        <button 
                            onClick={() => { setCurrentView('hr'); setIsSidebarOpen(false); }} 
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${currentView === 'hr' ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 font-black shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                        >
                            <ShieldCheck size={18} className="text-rose-600 animate-pulse" /> <span className="text-sm">الموارد البشرية (HR)</span>
                        </button>
                    )}

                    {(isSuperAdmin || userProfile?.canEditIdentity) && (
                        <button 
                            onClick={() => { setCurrentView('identity'); setIsSidebarOpen(false); }} 
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${currentView === 'identity' ? 'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400 font-black shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                        >
                            <Palette size={18} className="text-pink-600 animate-pulse" /> <span className="text-sm">الهوية البصرية</span>
                        </button>
                    )}

                    {(isSuperAdmin || userProfile?.canViewAdminTable || userProfile?.canManageOrg || userProfile?.canManageVolunteers || userProfile?.canManageTelegram || userProfile?.canAccessWamanAhyaaha) && (
                        <button 
                            onClick={() => { setCurrentView('control_center'); setIsSidebarOpen(false); }} 
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${currentView === 'control_center' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 font-black shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800'}`}
                        >
                            <Network size={18} className="text-purple-600 animate-pulse" /> <span className="text-sm">لوحة التحكم المركزية</span>
                        </button>
                    )}
                </div>
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
            <header className="app-top-bar bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-transparent md:border-gray-100 md:dark:border-gray-800/60 px-4 md:px-8 py-0 flex justify-between items-center sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsSidebarOpen(true)} className="android-touch md:hidden w-10 h-10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-2xl transition">
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
                        <h2 className="text-base md:text-base font-black text-gray-900 dark:text-gray-100 tracking-tight truncate max-w-[150px] md:max-w-none">
                            {DEPARTMENTS.find(d => d.id === currentView)?.nameAr || 
                             (currentView === 'overview' ? 'نظرة عامة' :
                              currentView === 'calendar' ? t.calendar : 
                              currentView === 'admin' ? t.generalAdmin :
                              currentView === 'reports' ? t.reports :
                              currentView === 'join_requests' ? t.volunteerReq :
                              currentView === 'identity' ? t.identity :
                              currentView === 'org' ? 'الهيكلة الإدارية' : 
                              currentView === 'user_management' ? 'إدارة المستخدمين' :
                              currentView === 'announcements' ? 'الإعلانات والاجتماعات' :
                              currentView === 'points' ? 'نظام النقاط' : 'لوحة التحكم')}
                        </h2>
                    </div>
                </div>
                
                <div className="flex items-center gap-1.5 md:gap-2">
                    {/* Dark Mode */}
                    <button onClick={() => setDarkMode(!darkMode)} className="android-touch w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl md:rounded-lg transition" title={darkMode ? 'وضع نهاري' : 'وضع ليلي'}>
                        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                    
                    {/* Admin Table */}
                    {userProfile?.canViewAdminTable && (
                        <button onClick={() => setCurrentView('admin')} className="android-touch hidden sm:flex w-10 h-10 md:w-8 md:h-8 items-center justify-center text-gray-600 dark:text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-2xl md:rounded-lg transition" title="جداول البيانات">
                            <TableIcon size={17} />
                        </button>
                    )}
                    
                    {/* Announcements */}
                    {(isSuperAdmin || userProfile?.canPostAnnouncements) && (
                        <button onClick={() => setShowEventModal(true)} className="android-touch w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-2xl md:rounded-lg transition" title="نشر إعلان">
                            <Bell size={17}/>
                        </button>
                    )}
                    
                    {/* Chat */}
                    {accessLevel !== 'charity_restricted' && (isSuperAdmin || userProfile?.role === 'manager' || userProfile?.role === 'deputy') && (
                        <button onClick={() => setCurrentView('chat')} className={`android-touch relative w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-2xl md:rounded-lg transition ${currentView === 'chat' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}>
                            <MessageCircle size={17}/>
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                        </button>
                    )}

                    {/* Divider */}
                    <span className="hidden md:block w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

                    <button
                        onClick={() => {
                            if (isSuperAdmin || userProfile?.canManagePoints) setCurrentView('points');
                        }}
                        className={`hidden items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 transition dark:bg-amber-900/20 dark:text-amber-300 md:flex ${(isSuperAdmin || userProfile?.canManagePoints) ? 'hover:bg-amber-100' : 'cursor-default'}`}
                        title="رصيد نقاطك"
                    >
                        <Trophy size={14} />
                        {Number(userProfile?.pointsTotal || 0)} نقطة
                    </button>
                    
                    {/* Profile */}
                    <button onClick={() => setShowSettings(true)} className="android-touch flex items-center gap-2.5 py-1.5 px-1 md:px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition">
                        <div className="text-right hidden md:block">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight">{userProfile?.displayName || user.email?.split('@')[0]}</p>
                            <p className="text-[10px] text-gray-400 leading-tight">{[...USER_ROLES, ...CHARITY_ROLES].find(r => r.id === userProfile?.role)?.name || 'عضو'}</p>
                        </div>
                        <div className="w-10 h-10 md:w-8 md:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl md:rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">
                            {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                    </button>
                </div>
            </header>

            {/* View Content */}
            <div className="app-scroll-surface flex-1 overflow-y-auto custom-scrollbar">
                {currentView !== 'overview' && announcements.length > 0 && accessLevel !== 'charity_restricted' && (
                    <div className="p-4 pb-0 md:px-8">
                        <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl bg-gradient-to-l from-indigo-600 via-indigo-700 to-purple-700 shadow-lg shadow-indigo-500/20">
                            <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                    <div className="mb-2 flex items-center gap-2">
                                        <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black text-indigo-100">إعلان اجتماع</span>
                                        <Bell size={15} className="text-indigo-100" />
                                    </div>
                                    <p className="truncate text-base font-black text-white md:text-lg">{announcements[0].topic}</p>
                                    <p className="mt-1 text-xs font-bold text-indigo-100">{announcements[0].date || "-"} — {announcements[0].time || "-"}</p>
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    {(announcements[0].attendees?.includes(user.uid) || announcements[0].apologies?.includes(user.uid)) ? (
                                        <div className="flex min-w-[170px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white">
                                            {announcements[0].attendees?.includes(user.uid) ? <><CheckCircle2 size={15} className="text-green-300"/> تم تأكيد الحضور</> : <><X size={15} className="text-red-300"/> تم الاعتذار</>}
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleConfirmAttendance(announcements[0].id)}
                                                className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-50"
                                            >
                                                <CheckCircle2 size={15} /> حضور
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const reason = prompt("سبب الاعتذار:");
                                                    if (!reason) return;
                                                    const event = announcements[0];
                                                    await updateDoc(doc(db, "management_meetings", event.id), {
                                                        apologies: [...(event.apologies || []), user.uid]
                                                    });
                                                    alert("تم تسجيل الاعتذار");
                                                }}
                                                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-xs font-black text-white transition hover:bg-white/25"
                                            >
                                                <X size={15} /> اعتذار
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {currentView === 'overview' && (
                    <div className="app-content-pad space-y-6 md:space-y-8 max-w-7xl mx-auto px-4 md:px-8 py-6" dir="rtl">
                        {/* Welcome message */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white">
                                    مرحباً {userProfile?.displayName || 'عضو الفريق'} 👋
                                </h1>
                                <p className="text-xs text-slate-400 font-bold mt-1">هنا نظرة سريعة على أداء فريقك ومهامك اليوم</p>
                            </div>
                            
                            {/* User details pill */}
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 px-4 py-2 rounded-2xl shadow-sm">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                                    {DEPARTMENTS.find(d => d.id === userProfile?.departmentId)?.nameAr || 'غير مححدد'}
                                </span>
                                <span className="text-slate-300">|</span>
                                <span className="text-xs font-bold text-slate-400">
                                    {[...USER_ROLES, ...CHARITY_ROLES].find(r => r.id === userProfile?.role)?.name || 'عضو'}
                                </span>
                            </div>
                        </div>

                        {/* Stats Row */}
                        {(() => {
                            const myDept = userProfile?.departmentId || '';
                            const statsIncoming = requests.filter(r => r.targetDept === myDept && r.status === 'pending_acceptance').length;
                            const statsOverdue = tasks.filter(t => t.targetDept === myDept && t.status !== 'done' && t.dueDate && t.dueDate < new Date().toLocaleDateString('en-CA')).length;
                            const statsInProgress = tasks.filter(t => t.targetDept === myDept && ['in_progress', 'review'].includes(t.status)).length;
                            const statsCompleted = tasks.filter(t => t.targetDept === myDept && t.status === 'done').length + 
                                                   requests.filter(r => (r.targetDept === myDept || r.sourceDept === myDept) && r.status === 'completed').length;

                            return (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                                    {/* 1. Incoming Requests */}
                                    <div onClick={() => setCurrentView('incoming_requests')} className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                            <Inbox size={22} />
                                        </div>
                                        <div className="min-w-0 text-right">
                                            <p className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{statsIncoming}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-0.5">طلبات واردة</p>
                                        </div>
                                    </div>

                                    {/* 2. Overdue */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                            <AlertCircle size={22} />
                                        </div>
                                        <div className="min-w-0 text-right">
                                            <p className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{statsOverdue}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-0.5">متأخرة</p>
                                        </div>
                                    </div>

                                    {/* 3. In Progress */}
                                    <div onClick={() => setCurrentView('my_tasks')} className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                            <Clock size={22} />
                                        </div>
                                        <div className="min-w-0 text-right">
                                            <p className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{statsInProgress}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-0.5">قيد التنفيذ</p>
                                        </div>
                                    </div>

                                    {/* 4. Completed */}
                                    <div onClick={() => setCurrentView('completed_tasks')} className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                            <Trophy size={22} />
                                        </div>
                                        <div className="min-w-0 text-right">
                                            <p className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{statsCompleted}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-0.5">مكتملة</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Two Columns Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            
                            {/* Left Side (lg:col-span-8) - Main Workspace */}
                            <div className="lg:col-span-8 space-y-8">
                                {/* 1. Incoming Requests Table */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                            <Inbox size={20} className="text-indigo-600" />
                                            الطلبات الواردة
                                        </h3>
                                        {requests.filter(r => r.targetDept === userProfile?.departmentId && r.status === 'pending_acceptance').length > 0 && (
                                            <button 
                                                onClick={() => setCurrentView('incoming_requests')}
                                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition"
                                            >
                                                عرض جميع الطلبات
                                            </button>
                                        )}
                                    </div>

                                    {(() => {
                                        const incomingRows = requests.filter(r => r.targetDept === userProfile?.departmentId && r.status === 'pending_acceptance').slice(0, 4);
                                        if (incomingRows.length === 0) {
                                            return (
                                                <div className="text-center py-10 text-slate-400 border border-dashed border-slate-100 dark:border-slate-850 rounded-2xl">
                                                    <Inbox size={32} className="mx-auto mb-2 opacity-30" />
                                                    <p className="text-sm font-bold">لا توجد طلبات واردة بانتظار القبول حالياً</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-right border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-50 dark:border-slate-800/80 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                            <th className="pb-3 pr-2">الطلب</th>
                                                            <th className="pb-3">من قسم</th>
                                                            <th className="pb-3">الأولوية</th>
                                                            <th className="pb-3 font-mono">الموعد النهائي</th>
                                                            <th className="pb-3 pl-2">الحالة</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80">
                                                        {incomingRows.map(row => {
                                                            const priority = PRIORITIES[row.priority] || PRIORITIES.normal || PRIORITIES.p4;
                                                            const sourceDept = DEPARTMENTS.find(d => d.id === row.sourceDept);
                                                            return (
                                                                <tr key={row.id} className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                                                    <td className="py-3.5 pr-2 font-black">
                                                                        <div className="min-w-0">
                                                                            <span className="block truncate max-w-[200px] text-slate-800 dark:text-white">{row.title}</span>
                                                                            <span className="text-[9px] text-slate-400 font-mono">#{row.id?.substring(0, 7) || 'REQ'}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3.5">
                                                                        <div className="flex items-center gap-1.5">
                                                                            {sourceDept && <sourceDept.icon size={13} className={sourceDept.primaryColor} />}
                                                                            <span>{sourceDept?.nameAr || 'غير محدد'}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3.5">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${priority.color} ${priority.bg}`}>
                                                                            {priority.labelAr || priority.label}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3.5 text-slate-500 font-mono">{row.deadline || '-'}</td>
                                                                    <td className="py-3.5 pl-2">
                                                                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">بانتظار القبول</span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* 2. Your Tasks Today */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                            <CheckCircle2 size={20} className="text-indigo-600" />
                                            مهامك اليوم قيد التنفيذ
                                        </h3>
                                        <button 
                                            onClick={() => setCurrentView('my_tasks')}
                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition"
                                        >
                                            كل مهام قسمي
                                        </button>
                                    </div>

                                    {(() => {
                                        const myTasksToday = tasks.filter(t => t.targetDept === userProfile?.departmentId && ['accepted', 'in_progress', 'executed', 'revision'].includes(t.status)).slice(0, 4);
                                        if (myTasksToday.length === 0) {
                                            return (
                                                <div className="text-center py-10 text-slate-400 border border-dashed border-slate-100 dark:border-slate-850 rounded-2xl">
                                                    <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
                                                    <p className="text-sm font-bold">لا توجد مهام قيد العمل اليوم</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {myTasksToday.map(t => {
                                                    const priority = PRIORITIES[t.priority] || PRIORITIES.normal || PRIORITIES.p4;
                                                    return (
                                                        <div key={t.id} onClick={() => setSelectedTask(t)} className="cursor-pointer border border-slate-100 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900 bg-slate-50/30 dark:bg-slate-900/50 p-4 rounded-2xl flex flex-col justify-between hover:shadow-sm transition">
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${priority.color} ${priority.bg}`}>
                                                                        {priority.labelAr || priority.label}
                                                                    </span>
                                                                    <span className="text-[10px] font-mono text-slate-400">{t.dueDate || '-'}</span>
                                                                </div>
                                                                <h4 className="text-sm font-black text-slate-800 dark:text-white line-clamp-1 mb-1">{t.title}</h4>
                                                                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{t.details || '-'}</p>
                                                            </div>
                                                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 text-[10px] text-slate-400 font-bold">
                                                                <span>المنفذ: {t.assignedToName || 'غير محدد'}</span>
                                                                <span className="text-indigo-600 dark:text-indigo-400">
                                                                  {t.status === 'executed' ? 'بانتظار المراجعة' : t.status === 'revision' ? 'مطلوب تعديل' : t.status === 'completed' ? 'مكتمل' : 'قيد التنفيذ'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Right Side (lg:col-span-4) - Secondary widgets */}
                            <div className="lg:col-span-4 space-y-8">
                                {/* 1. Notifications Widget */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                                    <h3 className="text-md font-black text-slate-800 dark:text-white mb-5 flex items-center gap-2">
                                        <Bell size={18} className="text-indigo-600" />
                                        الإشعارات والتحديثات
                                    </h3>
                                    
                                    {notificationsList.length === 0 ? (
                                        <p className="text-center py-6 text-xs text-slate-400">لا توجد إشعارات حديثة</p>
                                    ) : (
                                        <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1 text-right">
                                            {notificationsList
                                                .filter(notif => {
                                                    if (user?.email === SUPER_ADMIN_EMAIL) return true;
                                                    const myDept = userProfile?.departmentId || 'general';
                                                    return notif.targetDept === myDept || notif.fromDept === myDept || notif.targetDept === 'all' || !notif.targetDept;
                                                })
                                                .map(notif => {
                                                let iconBg = 'bg-blue-50 text-blue-600';
                                                let icon = <Inbox size={14} />;
                                                let text = '';
                                                
                                                if (notif.type === 'task_forwarded') {
                                                    iconBg = 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400';
                                                    text = `تم تحويل طلب جديد: "${notif.taskTitle}" من ${notif.fromDeptName || 'لجنة أخرى'}`;
                                                } else if (notif.type === 'task_completed') {
                                                    iconBg = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400';
                                                    icon = <CheckCircle2 size={14} />;
                                                    text = `تم اعتماد واكتمال طلبك: "${notif.taskTitle}"`;
                                                } else if (notif.type === 'task_rejected') {
                                                    iconBg = 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400';
                                                    icon = <X size={14} />;
                                                    text = `تم رفض طلبك: "${notif.taskTitle}"`;
                                                } else if (notif.type === 'task_revision') {
                                                    iconBg = 'bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400';
                                                    icon = <RefreshCw size={14} />;
                                                    text = `طلبك بحاجة لتعديل: "${notif.taskTitle}"`;
                                                } else if (notif.type === 'points_adjustment') {
                                                    iconBg = 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400';
                                                    icon = <Trophy size={14} />;
                                                    text = `تعديل نقاط: ${notif.body || 'تمت إضافة نقاط'}`;
                                                } else {
                                                    text = notif.taskTitle || 'تحديث على الطلب';
                                                }

                                                return (
                                                    <div key={notif.id} className="flex gap-3 items-start text-xs leading-relaxed">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                                                            {icon}
                                                        </div>
                                                        <div className="min-w-0 text-right">
                                                            <p className="font-bold text-slate-700 dark:text-slate-200">{text}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* 2. Task Distribution Chart */}
                                {(() => {
                                    const myDept = userProfile?.departmentId || '';
                                    const deptTasks = tasks.filter(t => t.targetDept === myDept);
                                    const deptRequests = requests.filter(r => r.targetDept === myDept || r.sourceDept === myDept);
                                    const total = deptTasks.length + deptRequests.length || 1;
                                    const completedPct = Math.round(((deptTasks.filter(t => t.status === 'done').length + deptRequests.filter(r => r.status === 'completed').length) / total) * 100);
                                    const inProgressPct = Math.round((deptTasks.filter(t => ['in_progress', 'review'].includes(t.status)).length / total) * 100);
                                    const pendingPct = Math.round((deptRequests.filter(r => r.status === 'pending_acceptance').length / total) * 100);
                                    const overduePct = Math.round((deptTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < new Date().toLocaleDateString('en-CA')).length / total) * 100);

                                    return (
                                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                                            <h3 className="text-md font-black text-slate-800 dark:text-white mb-5">توزيع المهام والإنتاجية</h3>
                                            
                                            {/* Stacked Progress Bar */}
                                            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex mb-6">
                                                <div className="bg-emerald-500 h-full" style={{ width: `${completedPct}%` }} title={`مكتمل: ${completedPct}%`}></div>
                                                <div className="bg-blue-500 h-full" style={{ width: `${inProgressPct}%` }} title={`قيد العمل: ${inProgressPct}%`}></div>
                                                <div className="bg-amber-500 h-full" style={{ width: `${pendingPct}%` }} title={`انتظار القبول: ${pendingPct}%`}></div>
                                                <div className="bg-rose-500 h-full" style={{ width: `${overduePct}%` }} title={`متأخرة: ${overduePct}%`}></div>
                                            </div>

                                            {/* Indicators */}
                                            <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-600 dark:text-slate-400 text-right">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                    <span>مكتملة ({completedPct}%)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                                                    <span>قيد العمل ({inProgressPct}%)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                                                    <span>وارد معلق ({pendingPct}%)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                                                    <span>متأخرة ({overduePct}%)</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* 3. Nearest Deadlines Widget */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                                    <h3 className="text-md font-black text-slate-800 dark:text-white mb-5 flex items-center gap-2">
                                        <Calendar size={18} className="text-indigo-600" />
                                        أقرب المواعيد النهائية
                                    </h3>
                                    {(() => {
                                        const myDept = userProfile?.departmentId || '';
                                        const urgentTasks = tasks
                                            .filter(t => t.targetDept === myDept && t.status !== 'done' && t.dueDate)
                                            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                                            .slice(0, 3);

                                        if (urgentTasks.length === 0) {
                                            return <p className="text-center py-6 text-xs text-slate-400">لا توجد مواعيد نهائية قريبة</p>;
                                        }

                                        return (
                                            <div className="space-y-4">
                                                {urgentTasks.map(t => {
                                                    const deadlineDate = new Date(t.dueDate);
                                                    const timeDiff = deadlineDate.getTime() - Date.now();
                                                    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                                    const badgeColor = daysDiff <= 2 ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400';
                                                    
                                                    return (
                                                        <div key={t.id} className="flex justify-between items-center border border-slate-100 dark:border-slate-800 p-3 rounded-2xl bg-slate-50/20 dark:bg-slate-900/30">
                                                            <div className="min-w-0 pr-2 text-right">
                                                                <h4 className="text-xs font-black text-slate-800 dark:text-white truncate max-w-[150px]">{t.title}</h4>
                                                                <span className="text-[9px] font-mono text-slate-400 block mt-0.5">{t.dueDate}</span>
                                                            </div>
                                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl shrink-0 ${badgeColor}`}>
                                                                {daysDiff <= 0 ? 'متأخرة' : `${daysDiff} يوم`}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
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
                {currentView === 'admin' && (
                    <AdminTable 
                        user={user} 
                        mode="general" 
                        telegramConfig={telegramConfig}
                        onSendTelegram={onSendTelegram}
                        userProfile={userProfile}
                    />
                )}
                {currentView === 'announcements' && (
                    <div className="p-3 md:p-6">
                        <AnnouncementsManager
                            user={user}
                            userProfile={userProfile}
                            telegramConfig={telegramConfig}
                            onSendTelegram={onSendTelegram}
                        />
                    </div>
                )}
                {currentView === 'hr' && (isSuperAdmin || userProfile?.departmentId === 'hr' || userProfile?.canViewHR) && (
                    <HRPanel
                        user={user}
                        userProfile={userProfile}
                        telegramConfig={telegramConfig}
                        onSendTelegram={onSendTelegram}
                        tasks={tasks}
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
                        updateTaskStatus={updateTaskStatus}
                        handleAcceptTask={handleAcceptTask}
                        handleRejectTask={handleRejectTask}
                        initiateForward={initiateForward}
                        onForwardToArt={handleForwardToArt}
                        updateTaskCategory={updateTaskCategory}
                        updateTaskInternalCategory={updateTaskInternalCategory}
                        renameCategory={renameCategory}
                    />
                )}
                {currentView === 'join_requests' && <JoinRequests user={user} userProfile={userProfile} />}
                {currentView === 'user_management' && <UserManagement />}
                {currentView === 'points' && (isSuperAdmin || userProfile?.canManagePoints) && <PointsManagement currentUserProfile={userProfile} />}
                {currentView === 'control_center' && (
                    <ControlCenter 
                        user={user} 
                        userProfile={userProfile} 
                        initialTab="org" 
                        wamanProps={{
                            telegramConfig,
                            deptSettings,
                            onSendTelegram,
                            tasks: tasks.filter(t => t.sourceDept === 'waman_ahyaaha'),
                            newTask,
                            setNewTask,
                            handleAddTask,
                            toggleStatus: toggleTaskStatus,
                            deleteTask,
                            setSelectedTask,
                            onOpenAddTask: (defaults: any) => {
                                setNewTaskDefaults(defaults);
                                setIsAddingTaskGlobal(true);
                            }
                        }}
                    />
                )}

                {/* Inbox / Today / Upcoming / All Views */}
                {['inbox', 'today', 'upcoming', 'all', 'my_tasks', 'incoming_requests', 'outgoing_requests', 'completed_tasks', 'hr_admin_assignments'].includes(currentView) && (
                    <TaskBoard updateTaskStatus={updateTaskStatus} 
                        activeDeptId={currentView}
                        tasks={filteredTasks}
                        requests={requests}
                        updateRequestStatus={updateRequestStatus}
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
                        deptSettings={deptSettings}
                        addCategory={addCategory}
                        telegramConfig={telegramConfig}
                        onSendTelegram={onSendTelegram}
                        deleteCategory={deleteCategory}
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
                {DEPARTMENTS.some(d => d.id === currentView && d.id !== 'waman_ahyaaha' && d.id !== 'educational' && d.id !== 'hr') && (
                    <TaskBoard updateTaskStatus={updateTaskStatus} 
                        activeDeptId={currentView}
                        tasks={filteredTasks}
                        requests={requests}
                        updateRequestStatus={updateRequestStatus}
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
                        deptSettings={deptSettings}
                        addCategory={addCategory}
                        telegramConfig={telegramConfig}
                        onSendTelegram={onSendTelegram}
                        deleteCategory={deleteCategory}
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
                    <TaskBoard updateTaskStatus={updateTaskStatus} 
                        activeDeptId={currentView}
                        tasks={filteredTasks}
                        requests={requests}
                        updateRequestStatus={updateRequestStatus}
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
                        deptSettings={deptSettings}
                        addCategory={addCategory}
                        telegramConfig={telegramConfig}
                        onSendTelegram={onSendTelegram}
                        deleteCategory={deleteCategory}
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
        />

        {showNameModal && (
            <ProfileSetupModal 
                show={showNameModal} 
                profileSetup={profileSetup} 
                setProfileSetup={setProfileSetup} 
                saveUserProfile={saveUserProfile} 
                onLogout={handleLogout}
            />
        )}

        <HRProfileModal 
            show={showHRModal}
            onClose={() => {
                setShowHRModal(false);
                setCurrentView('overview');
            }}
            hrTempName={hrTempName}
            setHrTempName={setHrTempName}
            handleCreateHRProfile={handleCreateHRProfile}
        />

        <TelegramConfigModal 
            isOpen={showTelegramConfig}
            onClose={() => setShowTelegramConfig(false)}
            config={telegramConfig}
            onSave={() => setShowTelegramConfig(false)}
        />

        <ForwardTaskModal 
            modalState={forwardModal} 
            setModalState={setForwardModal} 
            forwardNote={forwardNote}
            setForwardNote={setForwardNote}
            confirmForwardTask={confirmForwardTask}
            forwardMemberName={forwardMemberName}
            setForwardMemberName={setForwardMemberName}
            activeDeptId={DEPARTMENTS.some(d => d.id === currentView) ? currentView : (userProfile?.departmentId || 'general')} 
        />
        
        {selectedTask && (
            <TaskPulseDrawer 
                task={selectedTask}
                user={user}
                userProfile={userProfile}
                onClose={() => setSelectedTask(null)}
                telegramConfig={telegramConfig}
                onSendTelegram={onSendTelegram}
                handleAcceptTask={handleAcceptTask}
                handleRejectTask={handleRejectTask}
                deptSettings={deptSettings}
                requests={requests}
            />
        )}

        <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
