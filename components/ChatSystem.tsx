
import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../services/firebase";
import { User } from "firebase/auth";
import { 
  collection, query, where, onSnapshot, addDoc, deleteDoc, updateDoc, doc, 
  writeBatch, getDocs, getDoc, setDoc, orderBy, limit
} from "firebase/firestore";
import { 
  Send, X, Trash2, Edit, Check, CheckCheck, Smile, Search, 
  ChevronLeft, CornerUpLeft, ArrowRight, LayoutGrid, Users, Hash, Bell, Save, MessageCircle,
  Briefcase, MoreVertical, Clock, AtSign, Pin, Forward, Copy, Star, 
  Volume2, Image, Paperclip, Mic, StopCircle, Phone, Video, Info,
  CheckCircle2, Circle, Reply, BookMarked
} from "lucide-react";
import { DEPARTMENTS } from "../utils/constants";

interface ChatSystemProps {
  user: User;
  userProfile: { displayName: string, telegramId?: string, role?: string, departmentId?: string } | null;
  onClose?: () => void;
  telegramConfig?: any;
  onSendTelegram?: (target: string, text: string) => Promise<void> | void;
  departments?: any[];
  tasks?: any[];
}

const EMOJIS = ["👍","❤️","😂","😮","😢","👏","🔥","🎉","🤔","👀","💯","✅","🙏","🤝","💪","🌟","⚡","🎯","🚀","💡"];
const SENDER_COLORS = ["text-pink-500","text-orange-500","text-green-500","text-blue-500","text-purple-500","text-teal-500","text-red-500","text-yellow-500"];

const getChannelId = (u1: string, u2: string) => u1 < u2 ? `dm-${u1}-${u2}` : `dm-${u2}-${u1}`;
const formatTime = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
};
const formatDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  return d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
};

export default function ChatSystem({ user, userProfile, onClose, departments = [], tasks = [], telegramConfig, onSendTelegram }: ChatSystemProps) {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [activeChannelName, setActiveChannelName] = useState("");
  const [activeChannelIcon, setActiveChannelIcon] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadChannels, setUnreadChannels] = useState<Record<string, number>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, any>>({});
  const [myTelegramId, setMyTelegramId] = useState("");
  const [showTelegramPrompt, setShowTelegramPrompt] = useState(false);
  const [viewState, setViewState] = useState<'list' | 'chat'>('list');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<any>(null);
  const [starredMsgs, setStarredMsgs] = useState<Set<string>>(new Set());
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');
  const [selectedMsgs, setSelectedMsgs] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load Telegram ID
  useEffect(() => {
    if (userProfile?.telegramId) { setMyTelegramId(userProfile.telegramId); return; }
    getDoc(doc(db, "users", user.uid)).then(snap => {
      if (snap.exists() && snap.data().telegramId) { setMyTelegramId(snap.data().telegramId); }
      else { setShowTelegramPrompt(true); }
    });
  }, [userProfile, user.uid]);

  const handleSaveTelegramId = async () => {
    try {
      await updateDoc(doc(db, "users", user.uid), { telegramId: myTelegramId });
      setShowTelegramPrompt(false);
      alert("تم حفظ معرف تيليجرام بنجاح!");
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء حفظ المعرف.");
    }
  };

  // Load Users
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "users")), snap => {
      setUsersList(snap.docs.map(d => ({ uid: d.data().uid || d.id, ...d.data() })).filter((u: any) => u.uid !== user.uid));
    });
    return () => unsub();
  }, [user.uid]);

  // Unread counts per channel
  useEffect(() => {
    const q = query(collection(db, "chats"), where("receiverId", "==", user.uid), where("isRead", "==", false));
    const unsub = onSnapshot(q, snap => {
      const counts: Record<string, number> = {};
      snap.docs.forEach(d => { const { channelId } = d.data(); if (channelId) counts[channelId] = (counts[channelId] || 0) + 1; });
      setUnreadChannels(counts);
    });
    return () => unsub();
  }, [user.uid]);

  // Load messages on channel change
  useEffect(() => {
    if (!activeChannel) { setMessages([]); return; }
    setLoading(true);
    const q = query(collection(db, "chats"), where("channelId", "==", activeChannel));
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(a.timestamp||0).getTime() - new Date(b.timestamp||0).getTime());
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
      // Mark read
      const unread = snap.docs.filter(d => !d.data().isRead && d.data().senderId !== user.uid);
      if (unread.length > 0) {
        const batch = writeBatch(db);
        unread.forEach(d => batch.update(d.ref, { isRead: true }));
        batch.commit().catch(console.error);
      }
      // Find pinned
      const pinned = msgs.find((m: any) => m.isPinned);
      setPinnedMessage(pinned || null);
    });
    // Typing
    const typQ = query(collection(db, "typing_status"), where("channelId", "==", activeChannel));
    const typUnsub = onSnapshot(typQ, snap => {
      const usersTyping = snap.docs.map(d => d.data().userName).filter(name => name !== userProfile?.displayName);
      setTypingUsers(usersTyping);
    });
    return () => {
      unsub();
      typUnsub();
      if (activeChannel) {
        deleteDoc(doc(db, "typing_status", `${activeChannel}-${user.uid}`)).catch(() => {});
      }
    };
  }, [activeChannel, user.uid, userProfile?.displayName]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !editingMsg) return;
    const text = newMessage.trim();
    setNewMessage(""); setReplyTo(null);
    if (textareaRef.current) textareaRef.current.style.height = '50px';
    try {
      if (editingMsg) { await updateDoc(doc(db, "chats", editingMsg.id), { text, isEdited: true }); setEditingMsg(null); return; }
      let receiverId = null;
      if (activeChannel?.startsWith('dm-')) {
        const parts = activeChannel.replace('dm-', '').split('-');
        receiverId = parts.find(id => !id.includes('@') && id !== user.uid) || parts.find(id => id !== user.uid);
      }
      const mentions: string[] = [];
      const mentionRegex = /@(\w+)/g; let m;
      while ((m = mentionRegex.exec(text)) !== null) mentions.push(m[1]);
      await addDoc(collection(db, "chats"), {
        text, senderId: user.uid,
        senderName: userProfile?.displayName || "مستخدم",
        timestamp: new Date().toISOString(), channelId: activeChannel,
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, sender: replyTo.senderName } : null,
        reactions: {}, type: 'text', receiverId, mentions, isRead: false
      });
      if (activeChannel) {
        await deleteDoc(doc(db, "typing_status", `${activeChannel}-${user.uid}`)).catch(() => {});
      }
      if (receiverId && onSendTelegram) {
        const recUser = usersList.find(u => u.uid === receiverId);
        if (recUser?.telegramId) onSendTelegram(recUser.telegramId, `💬 <b>رسالة من ${userProfile?.displayName}</b>

"${text}"

🔗 <a href="${window.location.origin}">افتح للرد</a>`);
      }
    } catch (err) { console.error(err); setNewMessage(text); }
  };

  const handleReaction = async (msgId: string, emoji: string, reactions: any) => {
    const r = reactions || {};
    const uList = r[emoji] || [];
    let newR = uList.includes(user.uid) ? { ...r, [emoji]: uList.filter((id: string) => id !== user.uid) } : { ...r, [emoji]: [...uList, user.uid] };
    if (newR[emoji]?.length === 0) delete newR[emoji];
    await updateDoc(doc(db, "chats", msgId), { reactions: newR });
    setShowEmojiPicker(null);
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm("حذف الرسالة نهائياً؟")) return;
    await deleteDoc(doc(db, "chats", msgId));
    setShowActionsMenu(null);
  };

  const handlePin = async (msg: any) => {
    if (pinnedMessage?.id === msg.id) {
      await updateDoc(doc(db, "chats", msg.id), { isPinned: false });
    } else {
      if (pinnedMessage) await updateDoc(doc(db, "chats", pinnedMessage.id), { isPinned: false });
      await updateDoc(doc(db, "chats", msg.id), { isPinned: true });
    }
    setShowActionsMenu(null);
  };

  const handleStar = (msgId: string) => {
    setStarredMsgs(prev => { const n = new Set(prev); n.has(msgId) ? n.delete(msgId) : n.add(msgId); return n; });
    setShowActionsMenu(null);
  };

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); setShowActionsMenu(null); };

  const handleConvertToTask = async (msg: any) => {
    if (!confirm("تحويل هذه الرسالة إلى مهمة؟")) return;
    await addDoc(collection(db, "tasks"), { title: "مهمة من المحادثة", details: `من: ${msg.senderName}

${msg.text}`, priority: 'normal', sourceDept: 'general', status: 'pending', created_by: user.email, created_at: new Date().toISOString() });
    setShowActionsMenu(null);
    alert("✅ تم إنشاء المهمة");
  };

  const handleClearChat = async () => {
    if (!activeChannel || !confirm("حذف جميع رسائل هذه المحادثة؟")) return;
    const snap = await getDocs(query(collection(db, "chats"), where("channelId", "==", activeChannel)));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  const handleChannelSelect = (item: any, type: 'general' | 'channel' | 'user') => {
    if (type === 'general') {
      setActiveChannel('general_chat');
      setActiveChannelName('القناة العامة');
      setActiveChannelIcon({ icon: Hash, colorClass: 'bg-indigo-600' });
    } else if (type === 'channel') {
      setActiveChannel(item.id);
      setActiveChannelName(item.nameAr || item.name);
      setActiveChannelIcon({ icon: item.icon || Hash, colorClass: item.bgClass || 'bg-indigo-600' });
    } else if (type === 'user') {
      const chId = getChannelId(user.uid, item.uid);
      setActiveChannel(chId);
      setActiveChannelName(item.displayName || 'مستخدم');
      setActiveChannelIcon(null);
    }
    setViewState('chat');
  };

  const handleTyping = async () => {
    if (!activeChannel || !userProfile?.displayName) return;
    const docId = `${activeChannel}-${user.uid}`;
    try {
      await setDoc(doc(db, "typing_status", docId), {
        channelId: activeChannel,
        userId: user.uid,
        userName: userProfile.displayName,
        timestamp: new Date().toISOString()
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(async () => {
        try {
          await deleteDoc(doc(db, "typing_status", docId));
        } catch (e) {}
      }, 3000);
    } catch (e) {}
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 200);
  };

  const filteredUsers = usersList.filter(u =>
    (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allChannels = [
    { id: 'general_chat', nameAr: 'القناة العامة', description: 'لجميع الأعضاء', icon: Hash, bgClass: 'bg-gradient-to-br from-indigo-500 to-indigo-700', isGeneral: true },
    ...(departments || [])
  ];
  const filteredChannels = allChannels.filter(c => (c.nameAr || '').includes(searchQuery) || (c.description || '').includes(searchQuery));

  const ParsedText = ({ text }: { text: string }) => {
    if (!text) return null;
    const parts = text.split(/(\s+)/);
    return <span>{parts.map((p, i) => {
      if (p.startsWith('@')) return <span key={i} className="text-blue-400 font-bold bg-blue-500/10 px-1 rounded">{p}</span>;
      if (p.startsWith('#')) return <span key={i} className="text-indigo-400 font-bold cursor-pointer hover:underline">🔗{p}</span>;
      if (p.startsWith('http')) return <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 break-all">{p}</a>;
      return p;
    })}</span>;
  };

  // ======================= RENDER =======================
  return (
    <div className="mobile-module chat-module flex h-full min-h-[calc(100vh-64px)] flex-col overflow-hidden bg-white dark:bg-gray-50 dark:bg-[#17212B] text-gray-800 dark:text-white animate-fade-in-up md:min-h-0" dir="rtl">

      {/* ===== HEADER ===== */}
      <div className="chat-appbar bg-gray-50 dark:bg-white dark:bg-[#232E3C] border-b border-gray-200 dark:border-gray-200 dark:border-white/5 flex items-center justify-between px-4 py-3 shrink-0">
        {viewState === 'chat' ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button onClick={() => { setViewState('list'); setActiveChannel(null); }} className="p-1.5 hover:bg-white/10 rounded-full transition shrink-0">
              <ArrowRight size={19} className="rotate-180" />
            </button>
            <div className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer" onClick={() => setShowInfo(!showInfo)}>
              {activeChannelIcon ? (
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${typeof activeChannelIcon.colorClass === 'string' ? activeChannelIcon.colorClass.split(' ')[0] : 'bg-indigo-500'}`}>
                  <activeChannelIcon.icon size={18} />
                </div>
              ) : (
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                  {activeChannelName[0]}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate">{activeChannelName}</h4>
                {typingUsers.length > 0 ? (
                  <p className="text-[10px] text-green-400 font-medium animate-pulse flex items-center gap-1">
                    <span className="flex gap-0.5">{[0,1,2].map(i => <span key={i} className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</span>
                    {typingUsers.join(', ')} يكتب...
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-500 dark:text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> {messages.length} رسالة
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={handleClearChat} className="p-1.5 hover:bg-white/10 rounded-full transition text-gray-500 dark:text-gray-400 hover:text-red-400" title="مسح المحادثة"><Trash2 size={16}/></button>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition text-gray-500 dark:text-gray-400"><X size={18}/></button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                <MessageCircle size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm">مركز المحادثات</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 dark:text-gray-400">فريق معوان</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onClose} className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition text-gray-500 dark:text-gray-500 dark:text-gray-400"><X size={18}/></button>
            </div>
          </div>
        )}
      </div>

      {/* ===== PINNED MESSAGE BANNER ===== */}
      {viewState === 'chat' && pinnedMessage && (
        <div className="chat-pinned bg-blue-600 dark:bg-[#2B5278]/60 border-b border-gray-200 dark:border-white/5 px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-blue-600 dark:bg-[#2B5278]/80 transition shrink-0" onClick={() => {}}>
          <Pin size={12} className="text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-blue-400 font-bold uppercase">رسالة مثبتة</p>
            <p className="text-xs text-gray-300 truncate">{pinnedMessage.text}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); handlePin(pinnedMessage); }} className="text-gray-400 hover:text-gray-800 dark:text-gray-500 dark:hover:text-white transition shrink-0"><X size={12}/></button>
        </div>
      )}

      {/* ===== TELEGRAM ID PROMPT ===== */}
      {viewState === 'list' && showTelegramPrompt && (
        <div className="chat-notice bg-blue-600/10 dark:bg-[#2B5278]/30 border border-blue-500/20 p-3 mx-3 mt-3 rounded-xl shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-500 dark:text-blue-400">تفعيل إشعارات تيليجرام</span>
            <button onClick={() => setShowTelegramPrompt(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X size={14}/></button>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="أدخل معرف تيليجرام الخاص بك..." 
              value={myTelegramId} 
              onChange={e => setMyTelegramId(e.target.value)} 
              className="flex-1 text-xs p-2 rounded-lg bg-white dark:bg-[#232E3C] border border-gray-200 dark:border-white/5 outline-none focus:border-blue-500"
            />
            <button onClick={handleSaveTelegramId} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg font-bold flex items-center gap-1">
              <Save size={12} /> حفظ
            </button>
          </div>
        </div>
      )}

      {/* ===== CONTENT ===== */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1 pb-4">
        {viewState === 'list' ? (
          <>
            {activeTab === 'channels' && (
              <>
                {filteredChannels.map((ch: any) => {
                  const unread = unreadChannels[ch.id || 'general_chat'] || 0;
                  return (
                    <button key={ch.id} onClick={() => ch.isGeneral ? handleChannelSelect(null,'general') : handleChannelSelect(ch,'channel')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:bg-white/5 transition text-right group">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white ${ch.bgClass ? ch.bgClass.split(' ')[0] : 'bg-indigo-600'}`}>
                        {ch.icon ? <ch.icon size={20} /> : <Hash size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className={`text-sm font-bold truncate ${unread ? 'text-white' : 'text-gray-200'}`}>{ch.nameAr || ch.name}</h4>
                          {unread > 0 && <span className="bg-blue-500 text-white text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shrink-0">{unread}</span>}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{ch.description}</p>
                      </div>
                    </button>
                  );
                })}
                {filteredChannels.length === 0 && <p className="text-center text-gray-600 text-xs py-8">لا توجد قنوات مطابقة</p>}
              </>
            )}

            {activeTab === 'dms' && (
              <>
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-gray-600 text-xs py-8">لا يوجد أعضاء</p>
                ) : filteredUsers.map(u => {
                  const chId = getChannelId(user.uid, u.uid);
                  const unread = unreadChannels[chId] || 0;
                  return (
                    <button key={u.uid} onClick={() => handleChannelSelect(u,'user')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-right ${unread ? 'bg-blue-600/10' : 'hover:bg-gray-100 dark:bg-white/5'}`}>
                      <div className="relative shrink-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${unread ? 'bg-blue-500 text-white' : 'bg-[#2B3A4E] text-blue-300'}`}>
                          {(u.displayName || 'U')[0].toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <h4 className="text-sm font-bold truncate">{u.displayName}</h4>
                          {unread > 0 && <span className="bg-blue-500 text-white text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shrink-0">{unread}</span>}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{u.email}</p>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </>
        ) : (
          messages.map((msg: any) => {
            const isMe = msg.senderId === user.uid;
            const isStarred = msg.starredBy?.includes(user.uid);
            return (
              <React.Fragment key={msg.id}>
                {msg.showDate && <div className="text-center text-[10px] text-gray-400 my-4">{msg.dateLabel}</div>}
                <div className={`group flex gap-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-auto">{msg.senderName[0]}</div>}
                  <div className={`relative max-w-[80%] p-3 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-bl-none' : 'bg-gray-100 dark:bg-[#2B3A4E] text-gray-800 dark:text-gray-200 rounded-br-none'}`}>
                    {/* Reply Preview */}
                    {msg.replyTo && (
                      <div className={`text-xs mb-1.5 p-2 rounded-lg border-r-2 ${isMe ? 'border-white/40 bg-white/10' : 'border-blue-500 bg-blue-500/10'}`}>
                        <p className="font-bold text-blue-300 text-[10px] mb-0.5">{msg.replyTo.sender}</p>
                        <p className="opacity-70 truncate line-clamp-1">{msg.replyTo.text}</p>
                      </div>
                    )}

                    <div className="break-words whitespace-pre-wrap">
                      <ParsedText text={msg.text} />
                      {isStarred && <Star size={10} className="inline text-yellow-400 mr-1" />}
                    </div>

                    {/* Timestamp & status */}
                    <div className={`flex items-center gap-1 mt-1 opacity-60 text-[9px] ${isMe ? 'justify-end text-blue-200' : 'justify-end text-gray-500'}`}>
                      {msg.isEdited && <span>معدّل ·</span>}
                      <span>{formatTime(msg.timestamp)}</span>
                      {isMe && (
                        msg.isRead
                          ? <CheckCheck size={12} className="text-blue-300" />
                          : <Check size={12} />
                      )}
                    </div>

                    {/* Reactions */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(msg.reactions).map(([emoji, users]: any) => (
                          <button key={emoji} onClick={() => handleReaction(msg.id, emoji, msg.reactions)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition ${users.includes(user.uid) ? 'bg-blue-500/30 border border-blue-400/50' : 'bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-700 dark:text-white'}`}>
                            {emoji} {users.length > 1 && <span className="font-bold text-[9px]">{users.length}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Reaction on hover */}
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isMe ? 'left-full ml-1' : 'right-full mr-1'} opacity-0 group-hover:opacity-100 transition-all flex items-center gap-0.5 z-20`}>
                    <button onClick={() => handleReaction(msg.id, '👍', msg.reactions)} className="w-6 h-6 bg-white dark:bg-[#232E3C] rounded-full flex items-center justify-center text-xs hover:scale-125 transition shadow">👍</button>
                    <button onClick={() => setShowActionsMenu(showActionsMenu === msg.id ? null : msg.id)} className="w-6 h-6 bg-white dark:bg-[#232E3C] rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-white transition shadow">
                      <MoreVertical size={12} />
                    </button>
                  </div>

                  {/* Actions Menu */}
                  {showActionsMenu === msg.id && (
                    <div className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} bg-white dark:bg-[#232E3C] shadow-2xl rounded-2xl p-1 z-50 min-w-[160px] border border-gray-200 dark:border-white/5 animate-fade-in-up`}>
                      <div className="flex gap-1 p-2 justify-center bg-gray-50 dark:bg-[#17212B] rounded-xl mb-1">
                        {EMOJIS.slice(0,5).map(e => (
                          <button key={e} onClick={() => handleReaction(msg.id, e, msg.reactions)} className="hover:scale-125 transition text-base">{e}</button>
                        ))}
                        <button onClick={() => { setShowEmojiPicker(msg.id); setShowActionsMenu(null); }} className="text-gray-500 dark:text-gray-400 hover:text-white transition">+</button>
                      </div>

                      {[
                        { icon: <Reply size={13} className="text-blue-400"/>, label: 'رد', action: () => { setReplyTo(msg); setShowActionsMenu(null); } },
                        { icon: <Copy size={13} className="text-green-400"/>, label: 'نسخ', action: () => handleCopy(msg.text) },
                        { icon: <Pin size={13} className="text-yellow-400"/>, label: pinnedMessage?.id === msg.id ? 'إلغاء التثبيت' : 'تثبيت', action: () => handlePin(msg) },
                        { icon: <Star size={13} className={isStarred ? "text-yellow-400" : "text-gray-500 dark:text-gray-400"}/>, label: isStarred ? 'إلغاء النجمة' : 'وضع نجمة', action: () => handleStar(msg.id) },
                        { icon: <Briefcase size={13} className="text-orange-400"/>, label: 'تحويل لمهمة', action: () => handleConvertToTask(msg) },
                      ].map((item, i) => (
                        <button key={i} onClick={item.action} className="flex items-center gap-2.5 w-full p-2 px-3 rounded-lg hover:bg-gray-100 dark:bg-white/5 text-xs font-medium text-gray-200 text-right transition">
                          {item.icon}{item.label}
                        </button>
                      ))}

                      {isMe && <>
                        <div className="h-px bg-gray-200 dark:bg-white/5 my-1" />
                        <button onClick={() => { setEditingMsg(msg); setNewMessage(msg.text); setShowActionsMenu(null); }} className="flex items-center gap-2.5 w-full p-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-medium text-blue-500 dark:text-blue-400 text-right transition">
                          <Edit size={13}/> تعديل
                        </button>
                        <button onClick={() => handleDelete(msg.id)} className="flex items-center gap-2.5 w-full p-2 px-3 rounded-lg hover:bg-red-500/10 text-xs font-medium text-red-500 dark:text-red-400 text-right transition">
                          <Trash2 size={13}/> حذف
                        </button>
                      </>}
                    </div>
                  )}

                  {/* Full Emoji Picker */}
                  {showEmojiPicker === msg.id && (
                    <div className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} z-50 bg-white dark:bg-[#232E3C] shadow-2xl rounded-2xl p-3 border border-gray-200 dark:border-white/5 grid grid-cols-7 gap-1`}>
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => handleReaction(msg.id, e, msg.reactions)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-lg transition text-gray-800 dark:text-white">{e}</button>
                      ))}
                      <button onClick={() => setShowEmojiPicker(null)} className="col-span-7 text-xs text-red-500 dark:text-red-400 font-bold mt-1">إغلاق</button>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {viewState === 'chat' && showScrollBottom && (
        <button onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })} className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-blue-600 dark:bg-[#2B5278] text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-30 border border-white/10 hover:bg-blue-700 dark:hover:bg-[#2B5278]/80 transition flex items-center gap-1">
          <span>↓</span> رسائل جديدة
        </button>
      )}

      {/* Input Area */}
      {viewState === 'chat' && (
        <div className="chat-composer bg-white dark:bg-[#17212B] border-t border-gray-200 dark:border-white/5 p-3 shrink-0">
          {replyTo && (
            <div className="flex justify-between items-center bg-blue-50 dark:bg-[#2B5278]/40 p-2 px-3 rounded-xl mb-2 border-r-2 border-blue-500">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">الرد على {replyTo.senderName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{replyTo.text}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-800 dark:text-gray-500 dark:hover:text-white ml-2"><X size={14}/></button>
            </div>
          )}
          {editingMsg && (
            <div className="flex justify-between items-center bg-orange-50 p-2 px-3 rounded-xl mb-2 border-r-2 border-orange-400">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">تعديل الرسالة</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{editingMsg.text}</p>
              </div>
              <button onClick={() => { setEditingMsg(null); setNewMessage(""); }} className="text-gray-400 hover:text-gray-800 dark:text-gray-500 dark:hover:text-white ml-2"><X size={14}/></button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              className="chat-textarea flex-1 p-3 bg-gray-50 dark:bg-[#232E3C] rounded-2xl border border-gray-200 dark:border-white/5 focus:border-blue-500/40 outline-none text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none max-h-32 transition-all"
              placeholder={activeChannel?.startsWith('dm-') ? `رسالة إلى ${activeChannelName}...` : `اكتب في ${activeChannelName}...`}
              value={newMessage}
              style={{ minHeight: '50px' }}
              onChange={e => { setNewMessage(e.target.value); handleTyping(); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'; }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            />
            <button type="submit" disabled={!newMessage.trim()} className="chat-send-button w-11 h-11 rounded-2xl flex items-center justify-center transition-all disabled:opacity-30 shrink-0 bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 shadow-lg shadow-blue-500/20">
              {editingMsg ? <Check size={18} /> : <Send size={18} className="-rotate-45 mb-0.5 mr-0.5" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
