import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  FileAudio,
  Link as LinkIcon,
  MapPin,
  Megaphone,
  Plus,
  Radio,
  Repeat,
  Save,
  Send,
  Trash2,
  Upload,
  Video,
  X
} from "lucide-react";
import { db, storage } from "../services/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import toast from "react-hot-toast";
import { resolveMeetingAnnouncementRoute, sendTelegramToChatIds } from "../utils/telegramRouting";

interface Meeting {
  id: string;
  topic?: string;
  title?: string;
  date?: string;
  time?: string;
  type?: "online" | "offline";
  locationType?: "online" | "offline";
  link?: string;
  details?: string;
  isRecurring?: boolean;
  recurrenceDay?: string;
  notificationSettings?: {
    reminders?: number[];
    enabled?: boolean;
  };
  createdAt?: any;
}

interface MeetingRecording {
  id: string;
  title: string;
  date: string;
  meetingId?: string;
  meetingTopic?: string;
  audioUrl?: string;
  audioFileName?: string;
  notes?: string;
  createdAt?: any;
}

const emptyMeeting = {
  title: "",
  date: "",
  time: "",
  type: "online",
  link: "",
  details: "",
  isRecurring: false,
  recurrenceDay: "Thursday",
  sendImmediateNotification: true,
  notificationSettings: {
    reminders: [60, 1440],
    enabled: true,
    includeTime: true,
    includeLocation: true,
    includeDetails: true
  }
};

const emptyRecording = {
  title: "",
  date: "",
  meetingId: "",
  audioUrl: "",
  notes: ""
};

export default function AnnouncementsManager({ user, userProfile, telegramConfig, onSendTelegram }: any) {
  const [activeTab, setActiveTab] = useState<"announcements" | "history">("announcements");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [recordings, setRecordings] = useState<MeetingRecording[]>([]);
  const [isAddingMeeting, setIsAddingMeeting] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [meetingForm, setMeetingForm] = useState<any>(emptyMeeting);
  const [recordingForm, setRecordingForm] = useState<any>(emptyRecording);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const meetingsQuery = query(collection(db, "management_meetings"), orderBy("createdAt", "desc"));
    const recordingsQuery = query(collection(db, "meeting_recordings"), orderBy("createdAt", "desc"));

    const unsubMeetings = onSnapshot(meetingsQuery, (snap) => {
      setMeetings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting)));
      setLoading(false);
    });

    const unsubRecordings = onSnapshot(recordingsQuery, (snap) => {
      setRecordings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingRecording)));
    });

    return () => {
      unsubMeetings();
      unsubRecordings();
    };
  }, []);

  const meetingOptions = useMemo(() => {
    return meetings.map((meeting) => ({
      id: meeting.id,
      label: meeting.topic || meeting.title || "اجتماع بدون عنوان"
    }));
  }, [meetings]);

  const resetMeetingForm = () => {
    setMeetingForm(emptyMeeting);
    setEditingMeetingId(null);
    setIsAddingMeeting(false);
  };

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingForm.title || !meetingForm.time) {
      toast.error("اكتب عنوان الاجتماع والوقت");
      return;
    }

    const data = {
      ...meetingForm,
      topic: meetingForm.title,
      locationType: meetingForm.type,
      createdAt: editingMeetingId ? meetingForm.createdAt || serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      if (editingMeetingId) {
        await updateDoc(doc(db, "management_meetings", editingMeetingId), data);
        if (onSendTelegram) {
          const route = resolveMeetingAnnouncementRoute(telegramConfig);
          const msg = `✏️ <b>تم تعديل إعلان اجتماع</b>\n\n📢 <b>${meetingForm.title}</b>\n📅 <b>الموعد:</b> ${meetingForm.date || "-"} - ${meetingForm.time || "-"}\n👤 <b>تم التعديل بواسطة:</b> ${userProfile?.displayName || user?.email || "-"}`;
          sendTelegramToChatIds(onSendTelegram, route.chatIds, msg, route.botToken);
        }
        toast.success("تم تحديث الاجتماع");
      } else {
        const docRef = await addDoc(collection(db, "management_meetings"), {
          ...data,
          created_by: user?.email || "",
          created_by_name: userProfile?.displayName || "",
          sentReminders: [],
          attendees: [],
          apologies: []
        });
        if (meetingForm.sendImmediateNotification && meetingForm.notificationSettings?.enabled && onSendTelegram) {
          const route = resolveMeetingAnnouncementRoute(telegramConfig);
          let msg = `📣 <b>إعلان اجتماع</b>\n\n📢 <b>${meetingForm.title}</b>\n`;
          msg += meetingForm.isRecurring ? `🔄 <b>يتكرر كل:</b> ${meetingForm.recurrenceDay}\n🕒 <b>الساعة:</b> ${meetingForm.time}\n` : `📅 ${meetingForm.date || "-"} - 🕒 ${meetingForm.time || "-"}\n`;
          msg += meetingForm.type === "online" ? `🔗 <b>الرابط:</b> ${meetingForm.link || "-"}\n` : `📍 <b>المكان:</b> ${meetingForm.details || "-"}\n`;
          msg += `👤 <b>بواسطة:</b> ${userProfile?.displayName || user?.email || "-"}\n✅ لتأكيد الحضور: ${window.location.origin}?confirmEvent=${docRef.id}`;
          const sent = sendTelegramToChatIds(onSendTelegram, route.chatIds, msg, route.botToken);
          if (!sent) toast.error("تم إنشاء الإعلان، لكن لا يوجد مستلمين مضبوطين لإشعار الاجتماع");
        }
        toast.success("تم إنشاء إعلان الاجتماع");
      }
      resetMeetingForm();
    } catch (error) {
      console.error(error);
      toast.error("تعذر حفظ الاجتماع");
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm("حذف إعلان الاجتماع؟")) return;
    await deleteDoc(doc(db, "management_meetings", id));
    toast.success("تم حذف الإعلان");
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setMeetingForm({
      ...emptyMeeting,
      ...meeting,
      title: meeting.topic || meeting.title || "",
      type: meeting.locationType || meeting.type || "online"
    });
    setEditingMeetingId(meeting.id);
    setIsAddingMeeting(true);
    setActiveTab("announcements");
  };

  const handleSaveRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingForm.title && !recordingForm.meetingId) {
      toast.error("اختار اجتماع أو اكتب عنوان التسجيل");
      return;
    }
    if (!recordingForm.audioUrl && !audioFile) {
      toast.error("ضيف رابط التسجيل أو ارفع ملف صوت");
      return;
    }

    setUploading(true);
    try {
      let audioUrl = recordingForm.audioUrl;
      let audioFileName = "";
      if (audioFile) {
        const safeName = audioFile.name.replace(/[^\w.\-]+/g, "_");
        const fileRef = ref(storage, `meeting-recordings/${Date.now()}-${safeName}`);
        await uploadBytes(fileRef, audioFile);
        audioUrl = await getDownloadURL(fileRef);
        audioFileName = audioFile.name;
      }

      const linkedMeeting = meetings.find((meeting) => meeting.id === recordingForm.meetingId);
      await addDoc(collection(db, "meeting_recordings"), {
        ...recordingForm,
        title: recordingForm.title || linkedMeeting?.topic || linkedMeeting?.title || "تسجيل اجتماع",
        meetingTopic: linkedMeeting?.topic || linkedMeeting?.title || "",
        audioUrl,
        audioFileName,
        createdAt: serverTimestamp()
      });

      setRecordingForm(emptyRecording);
      setAudioFile(null);
      toast.success("تم حفظ تسجيل الاجتماع");
    } catch (error) {
      console.error(error);
      toast.error("تعذر رفع أو حفظ التسجيل");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteRecording = async (id: string) => {
    if (!confirm("حذف تسجيل الاجتماع؟")) return;
    await deleteDoc(doc(db, "meeting_recordings", id));
    toast.success("تم حذف التسجيل");
  };

  const addReminder = () => {
    const value = prompt("عدد الدقائق قبل الاجتماع:");
    const minutes = Number(value);
    if (!minutes || minutes <= 0) return;
    const reminders = meetingForm.notificationSettings?.reminders || [];
    setMeetingForm({
      ...meetingForm,
      notificationSettings: {
        ...meetingForm.notificationSettings,
        reminders: Array.from(new Set([...reminders, minutes])).sort((a: any, b: any) => b - a)
      }
    });
  };

  const formatReminder = (minutes: number) => {
    if (minutes % 1440 === 0) return `${minutes / 1440} يوم`;
    if (minutes % 60 === 0) return `${minutes / 60} ساعة`;
    return `${minutes} دقيقة`;
  };

  return (
    <div className="mobile-module announcements-module space-y-5 rounded-[28px] bg-white p-4 shadow-sm dark:bg-gray-800 md:p-6" dir="rtl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-gray-900 dark:text-white">
            <Megaphone className="text-indigo-600" />
            الإعلانات والاجتماعات
          </h2>
          <p className="mt-1 text-xs font-bold text-gray-400">إنشاء إعلانات الاجتماعات، متابعة التاريخ، وحفظ التسجيلات الصوتية.</p>
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-2xl bg-gray-100 p-1 dark:bg-gray-900">
          <button
            onClick={() => setActiveTab("announcements")}
            className={`flex min-w-fit items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${activeTab === "announcements" ? "bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500"}`}
          >
            <Bell size={15} /> الإعلانات
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex min-w-fit items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${activeTab === "history" ? "bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500"}`}
          >
            <Archive size={15} /> الهيستوري والتسجيلات
          </button>
        </div>
      </div>

      {activeTab === "announcements" && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setIsAddingMeeting(true);
              setEditingMeetingId(null);
              setMeetingForm(emptyMeeting);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 dark:shadow-none md:w-auto"
          >
            <Plus size={18} /> إنشاء إعلان اجتماع
          </button>

          {isAddingMeeting && (
            <form onSubmit={handleSaveMeeting} className="space-y-4 rounded-[26px] border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/30 dark:bg-indigo-900/10">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black text-gray-400">عنوان الاجتماع</span>
                  <input
                    value={meetingForm.title}
                    onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                    className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white"
                    placeholder="مثال: الاجتماع الشهري الحضوري"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black text-gray-400">الوقت</span>
                  <input
                    type="time"
                    value={meetingForm.time}
                    onChange={(e) => setMeetingForm({ ...meetingForm, time: e.target.value })}
                    className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black text-gray-400">{meetingForm.isRecurring ? "يوم التكرار" : "التاريخ"}</span>
                  {meetingForm.isRecurring ? (
                    <select
                      value={meetingForm.recurrenceDay}
                      onChange={(e) => setMeetingForm({ ...meetingForm, recurrenceDay: e.target.value })}
                      className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="Saturday">السبت</option>
                      <option value="Sunday">الأحد</option>
                      <option value="Monday">الاثنين</option>
                      <option value="Tuesday">الثلاثاء</option>
                      <option value="Wednesday">الأربعاء</option>
                      <option value="Thursday">الخميس</option>
                      <option value="Friday">الجمعة</option>
                    </select>
                  ) : (
                    <input
                      type="date"
                      value={meetingForm.date}
                      onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                      className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white"
                    />
                  )}
                </label>

                <div>
                  <span className="mb-1 block text-[10px] font-black text-gray-400">نوع الاجتماع</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMeetingForm({ ...meetingForm, type: "online" })}
                      className={`rounded-2xl px-4 py-3 text-xs font-black ${meetingForm.type === "online" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 dark:bg-gray-900"}`}
                    >
                      <Video size={14} className="ml-1 inline" /> أونلاين
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeetingForm({ ...meetingForm, type: "offline" })}
                      className={`rounded-2xl px-4 py-3 text-xs font-black ${meetingForm.type === "offline" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 dark:bg-gray-900"}`}
                    >
                      <MapPin size={14} className="ml-1 inline" /> حضوري
                    </button>
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-[10px] font-black text-gray-400">{meetingForm.type === "online" ? "رابط الاجتماع" : "المكان / التفاصيل"}</span>
                <input
                  value={meetingForm.type === "online" ? meetingForm.link : meetingForm.details}
                  onChange={(e) => meetingForm.type === "online" ? setMeetingForm({ ...meetingForm, link: e.target.value }) : setMeetingForm({ ...meetingForm, details: e.target.value })}
                  className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-white"
                  placeholder={meetingForm.type === "online" ? "Zoom / Meet link" : "العنوان أو ملاحظات المكان"}
                />
              </label>

              <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 dark:bg-gray-900 md:flex-row md:items-center md:justify-between">
                <label className="flex cursor-pointer items-center gap-3 text-sm font-black text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={meetingForm.isRecurring}
                    onChange={(e) => setMeetingForm({ ...meetingForm, isRecurring: e.target.checked })}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  اجتماع متكرر
                </label>
                <label className="flex cursor-pointer items-center gap-3 text-sm font-black text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={meetingForm.notificationSettings?.enabled ?? true}
                    onChange={(e) => setMeetingForm({ ...meetingForm, notificationSettings: { ...meetingForm.notificationSettings, enabled: e.target.checked } })}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  تفعيل التذكيرات
                </label>
              </div>

              <div className="rounded-2xl bg-white p-3 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-600">التذكيرات قبل الاجتماع</span>
                  <button type="button" onClick={addReminder} className="text-xs font-black text-indigo-600">إضافة +</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(meetingForm.notificationSettings?.reminders || []).map((reminder: number) => (
                    <button
                      key={reminder}
                      type="button"
                      onClick={() => setMeetingForm({
                        ...meetingForm,
                        notificationSettings: {
                          ...meetingForm.notificationSettings,
                          reminders: meetingForm.notificationSettings.reminders.filter((r: number) => r !== reminder)
                        }
                      })}
                      className="rounded-xl bg-indigo-50 px-3 py-2 text-[11px] font-black text-indigo-600 dark:bg-indigo-900/30"
                    >
                      قبل {formatReminder(reminder)} <X size={11} className="inline" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="flex-1 rounded-2xl bg-indigo-600 py-3 text-sm font-black text-white">
                  <Save size={16} className="ml-1 inline" /> حفظ الإعلان
                </button>
                <button type="button" onClick={resetMeetingForm} className="rounded-2xl bg-gray-200 px-5 py-3 text-sm font-black text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                  إلغاء
                </button>
              </div>
            </form>
          )}

          <div className="grid gap-3">
            {loading ? (
              <div className="py-10 text-center text-sm font-bold text-gray-400">جار التحميل...</div>
            ) : meetings.length === 0 ? (
              <EmptyState text="لا توجد إعلانات اجتماعات حتى الآن" />
            ) : (
              meetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onEdit={() => handleEditMeeting(meeting)}
                  onDelete={() => handleDeleteMeeting(meeting.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <form onSubmit={handleSaveRecording} className="space-y-4 rounded-[26px] border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
            <div className="flex items-center gap-2">
              <FileAudio className="text-blue-600" />
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">إضافة تسجيل اجتماع</h3>
                <p className="text-xs font-bold text-gray-400">ينفع تختار اجتماع سابق أو تضيف تسجيل مستقل من غير إعلان.</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black text-gray-400">ربط باجتماع سابق (اختياري)</span>
                <select
                  value={recordingForm.meetingId}
                  onChange={(e) => setRecordingForm({ ...recordingForm, meetingId: e.target.value })}
                  className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">تسجيل مستقل</option>
                  {meetingOptions.map((meeting) => (
                    <option key={meeting.id} value={meeting.id}>{meeting.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black text-gray-400">عنوان التسجيل</span>
                <input
                  value={recordingForm.title}
                  onChange={(e) => setRecordingForm({ ...recordingForm, title: e.target.value })}
                  className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                  placeholder="مثال: تسجيل اجتماع مايو"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black text-gray-400">تاريخ التسجيل</span>
                <input
                  type="date"
                  value={recordingForm.date}
                  onChange={(e) => setRecordingForm({ ...recordingForm, date: e.target.value })}
                  className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black text-gray-400">رابط الصوت Drive / أي رابط</span>
                <input
                  value={recordingForm.audioUrl}
                  onChange={(e) => setRecordingForm({ ...recordingForm, audioUrl: e.target.value })}
                  className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                  placeholder="https://drive.google.com/..."
                />
              </label>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-600 dark:border-blue-900 dark:bg-gray-900">
              <span className="flex items-center gap-2"><Upload size={17} /> رفع ملف صوت من الجهاز</span>
              <span className="max-w-[45%] truncate text-xs text-gray-400">{audioFile?.name || "اختياري"}</span>
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-black text-gray-400">ملاحظات التسجيل</span>
              <textarea
                value={recordingForm.notes}
                onChange={(e) => setRecordingForm({ ...recordingForm, notes: e.target.value })}
                className="h-24 w-full resize-none rounded-2xl border-0 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                placeholder="ملخص سريع أو قرارات الاجتماع..."
              />
            </label>

            <button disabled={uploading} className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">
              {uploading ? "جار الرفع..." : "حفظ التسجيل"}
            </button>
          </form>

          <div className="grid gap-3">
            {recordings.length === 0 ? (
              <EmptyState text="لا توجد تسجيلات محفوظة حتى الآن" />
            ) : (
              recordings.map((recording) => (
                <RecordingCard key={recording.id} recording={recording} onDelete={() => handleDeleteRecording(recording.id)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting, onEdit, onDelete }: { meeting: Meeting; onEdit: () => void; onDelete: () => void }) {
  const title = meeting.topic || meeting.title || "اجتماع بدون عنوان";
  const type = meeting.locationType || meeting.type || "online";

  return (
    <div className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meeting.isRecurring ? "bg-purple-100 text-purple-600" : "bg-indigo-100 text-indigo-600"}`}>
            {meeting.isRecurring ? <Repeat size={22} /> : <Calendar size={22} />}
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-black text-gray-900 dark:text-white">{title}</h4>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-gray-500">
              <span className="flex items-center gap-1"><Clock size={12} /> {meeting.time || "-"}</span>
              <span className="flex items-center gap-1">{meeting.isRecurring ? <Repeat size={12} /> : <Calendar size={12} />} {meeting.isRecurring ? `كل ${meeting.recurrenceDay}` : meeting.date || "-"}</span>
              <span className="flex items-center gap-1">{type === "online" ? <Video size={12} /> : <MapPin size={12} />} {type === "online" ? "أونلاين" : "حضوري"}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800"><Edit2 size={15} /></button>
          <button onClick={onDelete} className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-900/20"><Trash2 size={15} /></button>
        </div>
      </div>
      {(meeting.link || meeting.details) && (
        <div className="mt-3 rounded-2xl bg-gray-50 p-3 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-300">
          {meeting.link ? <a href={meeting.link} target="_blank" rel="noreferrer" className="text-blue-600 underline">{meeting.link}</a> : meeting.details}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(meeting.notificationSettings?.reminders || []).map((reminder) => (
          <span key={reminder} className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-600 dark:bg-indigo-900/30">
            تذكير {reminder >= 60 ? `${reminder / 60}س` : `${reminder}د`}
          </span>
        ))}
        <span className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-400 dark:bg-gray-800">
          {meeting.notificationSettings?.enabled === false ? "التذكيرات مغلقة" : "التذكيرات مفعلة"}
        </span>
      </div>
    </div>
  );
}

function RecordingCard({ recording, onDelete }: { recording: MeetingRecording; onDelete: () => void }) {
  return (
    <div className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30">
            <FileAudio size={22} />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-black text-gray-900 dark:text-white">{recording.title}</h4>
            <p className="mt-1 text-[11px] font-bold text-gray-400">{recording.meetingTopic || "تسجيل مستقل"} {recording.date ? `• ${recording.date}` : ""}</p>
          </div>
        </div>
        <button onClick={onDelete} className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-900/20"><Trash2 size={15} /></button>
      </div>

      {recording.audioUrl && (
        <div className="mt-3 space-y-2">
          <audio controls src={recording.audioUrl} className="w-full" />
          <a href={recording.audioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-600 dark:bg-blue-900/20">
            <LinkIcon size={14} /> فتح التسجيل
          </a>
        </div>
      )}

      {recording.notes && (
        <p className="mt-3 rounded-2xl bg-gray-50 p-3 text-xs font-bold leading-relaxed text-gray-500 dark:bg-gray-800 dark:text-gray-300">
          {recording.notes}
        </p>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border-2 border-dashed border-gray-200 bg-gray-50 py-12 text-center dark:border-gray-700 dark:bg-gray-900/40">
      <CheckCircle2 className="mx-auto mb-2 text-gray-300" size={34} />
      <p className="text-sm font-black text-gray-400">{text}</p>
    </div>
  );
}
