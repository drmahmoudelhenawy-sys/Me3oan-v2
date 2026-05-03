
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
      const now = Date.now();
      setTypingUsers(snap.docs.filter(d => d.data().userId !== user.uid && now - d.data().timestamp < 3000).map(d => d.data().userName));
    });
    return () => { unsub(); typUnsub(); };
  }, [activeChannel, user.uid]);

  const handleTyping = async () => {
    if (!activeChannel) return;
    await setDoc(doc(db, "typing_status", `${activeChannel}_${user.uid}`), {
      channelId: activeChannel, userId: user.uid,
      userName: userProfile?.displayName || "مستخدم", timestamp: Date.now()
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleSaveTelegramId = async () => {
    if (!myTelegramId.trim()) return;
    const snap = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
    if (!snap.empty) await updateDoc(snap.docs[0].ref, { telegramId: myTelegramId.trim() });
    else await addDoc(collection(db, "users"), { uid: user.uid, email: user.email, displayName: userProfile?.displayName || "User", telegramId: myTelegramId.trim() });
    setShowTelegramPrompt(false);
  };

  const handleChannelSelect = (target: any, type: 'user' | 'channel' | 'general') => {
    if (type === 'user') { setActiveChannel(getChannelId(user.uid, target.uid)); setActiveChannelName(target.displayName || target.email); setActiveChannelIcon(null); }
    else if (type === 'general') { setActiveChannel('general_chat'); setActiveChannelName('القناة العامة'); setActiveChannelIcon({ icon: Hash, colorClass: 'bg-indigo-500' }); }
    else { setActiveChannel(target.id); setActiveChannelName(target.nameAr || target.name); setActiveChannelIcon({ icon: target.icon, colorClass: target.bgClass }); }
    setViewState('chat');
    setIsSelecting(false);
    setSelectedMsgs(new Set());
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeChannel) return;
    const text = newMessage.trim();
    setNewMessage(""); setReplyTo(null);
    if (textareaRef.current) textareaRef.current.style.height = '50px';
    try {
      if (editingMsg) { await updateDoc(doc(db, "chats", editingMsg.id), { text, isEdited: true }); setEditingMsg(null); return; }
      let receiverId = null;
      if (activeChannel.startsWith('dm-')) {
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
      if (receiverId && onSendTelegram) {
        const recUser = usersList.find(u => u.uid === receiverId);
        if (recUser?.telegramId) onSendTelegram(recUser.telegramId, `💬 <b>رسالة من ${userProfile?.displayName}</b>\n\n"${text}"\n\n🔗 <a href="${window.location.origin}">افتح للرد</a>`);
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
    await addDoc(collection(db, "tasks"), { title: "مهمة من المحادثة", details: `من: ${msg.senderName}\n\n${msg.text}`, priority: 'normal', sourceDept: 'general', status: 'pending', created_by: user.email, created_at: new Date().toISOString() });
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
    <div className="flex h-full min-h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#17212B] text-white animate-fade-in-up md:min-h-0" dir="rtl">

      {/* ===== HEADER ===== */}
      <div className="bg-[#232E3C] border-b border-white/5 flex items-center justify-between px-4 py-3 shrink-0">
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
                  <p className="text-[10px] text-gray-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> {messages.length} رسالة
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={handleClearChat} className="p-1.5 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-red-400" title="مسح المحادثة"><Trash2 size={16}/></button>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition text-gray-400"><X size={18}/></button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                <MessageCircle size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm">المركز التعاوني</h3>
                <p className="text-[10px] text-gray-400">فريق معوان</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition text-gray-400"><X size={18}/></button>
            </div>
          </div>
        )}
      </div>

      {/* ===== PINNED MESSAGE BANNER ===== */}
      {viewState === 'chat' && pinnedMessage && (
        <div className="bg-[#2B5278]/60 border-b border-white/5 px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-[#2B5278]/80 transition shrink-0" onClick={() => {}}>
          <Pin size={12} className="text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-blue-400 font-bold uppercase">رسالة مثبتة</p>
            <p className="text-xs text-gray-300 truncate">{pinnedMessage.text}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); handlePin(pinnedMessage); }} className="text-gray-500 hover:text-white transition shrink-0"><X size={12}/></button>
        </div>
      )}

      {/* ===== TELEGRAM ID PROMPT ===== */}
      {viewState === 'list' && showTelegramPrompt && (
        <div className="bg-[#2B5278]/50 border-b border-white/5 p-3 mx-3 mt-3 rounded-xl shrink-0">
          <div className="flex items-start gap-2 mb-2">
            <Bell size={14} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-200 leading-tight">لضمان وصول الإشعارات، أدخل معرف (ID) تيليجرام الخاص بك.</p>
          </div>
          <div className="flex gap-2">
            <input className="flex-1 p-2 rounded-lg bg-white/10 border border-white/10 text-xs outline-none placeholder-gray-500 focus:border-blue-500 transition" placeholder="Chat ID" value={myTelegramId} onChange={e => setMyTelegramId(e.target.value)} />
            <button onClick={handleSaveTelegramId} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-400 flex items-center gap-1 transition"><Save size={11}/> حفظ</button>
          </div>
        </div>
      )}

      {/* ===== CONTENT ===== */}
      <div className="flex-1 overflow-hidden relative">

        {/* ====== LIST VIEW ====== */}
        {viewState === 'list' && (
          <div className="h-full flex flex-col">
            {/* Search */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input className="w-full pr-8 pl-3 py-2.5 bg-[#232E3C] rounded-xl text-sm outline-none placeholder-gray-500 focus:ring-1 focus:ring-blue-500/50 transition" placeholder="بحث عن قناة أو شخص..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex px-3 pb-2 gap-2 shrink-0">
              {[{id:'channels', label:'القنوات'}, {id:'dms', label:'الرسائل'}].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-[#232E3C] text-gray-400 hover:text-white'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1 pb-4">
              
              {activeTab === 'channels' && (
                <>
                  {filteredChannels.map((ch: any) => {
                    const unread = unreadChannels[ch.id || 'general_chat'] || 0;
                    return (
                      <button key={ch.id} onClick={() => ch.isGeneral ? handleChannelSelect(null,'general') : handleChannelSelect(ch,'channel')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition text-right group">
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
                      <button key={u.uid} onClick={() => handleChannelSelect(u,'user')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-right ${unread ? 'bg-blue-600/10' : 'hover:bg-white/5'}`}>
                        <div className="relative shrink-0">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${unread ? 'bg-blue-500 text-white' : 'bg-[#2B3A4E] text-blue-300'}`}>
                            {(u.displayName || 'U')[0].toUpperCase()}
                          </div>
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#17212B] rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <h4 className={`text-sm truncate ${unread ? 'font-black text-white' : 'font-semibold text-gray-200'}`}>{u.displayName || 'مستخدم'}</h4>
                            {unread > 0 && <span className="bg-blue-500 text-white text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">{unread}</span>}
                          </div>
                          <p className="text-[11px] text-gray-500 truncate">{unread ? '● رسالة جديدة' : (u.role || 'عضو')}</p>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* ====== CHAT VIEW ====== */}
        {viewState === 'chat' && (
          <div className="h-full flex flex-col">
            {/* Messages Area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`, backgroundColor: '#0E1621' }}
            >
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                    <MessageCircle size={28} className="text-gray-500" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">ابدأ المحادثة الآن!</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.senderId === user.uid;
                  const prevMsg = messages[idx - 1];
                  const showDate = idx === 0 || new Date(msg.timestamp).toDateString() !== new Date(prevMsg?.timestamp).toDateString();
                  const sameSender = prevMsg && prevMsg.senderId === msg.senderId && !showDate;
                  const colorClass = SENDER_COLORS[msg.senderName?.length % SENDER_COLORS.length];
                  const isStarred = starredMsgs.has(msg.id);
                  const isSelected = selectedMsgs.has(msg.id);

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="text-[10px] bg-[#182533]/80 text-gray-400 px-3 py-1 rounded-full font-medium backdrop-blur-sm">
                            {formatDate(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative ${sameSender ? 'mt-0.5' : 'mt-3'} ${isSelected ? 'bg-blue-500/10 rounded-xl -mx-2 px-2' : ''}`}
                        onClick={() => isSelecting && setSelectedMsgs(prev => { const n = new Set(prev); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n; })}
                      >
                        {/* Avatar */}
                        {!isMe && !sameSender && (
                          <div className="w-8 h-8 rounded-full bg-[#2B3A4E] flex items-center justify-center text-[11px] font-bold mr-1 mt-auto shrink-0 text-blue-300">
                            {msg.senderName?.[0]}
                          </div>
                        )}
                        {!isMe && sameSender && <div className="w-8 mr-1 shrink-0" />}

                        {/* Bubble */}
                        <div className={`max-w-[78%] relative ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          {/* Sender name (channels only) */}
                          {!isMe && !sameSender && !activeChannel?.startsWith('dm-') && (
                            <span className={`text-[10px] font-bold mb-0.5 ${colorClass} mx-1`}>{msg.senderName}</span>
                          )}

                          <div className={`relative p-2.5 px-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            isMe
                              ? 'bg-[#2B5278] text-white rounded-br-sm'
                              : 'bg-[#182533] text-gray-100 rounded-bl-sm'
                          }`}>

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
                                  <button key={emoji} onClick={() => handleReaction(msg.id, emoji, msg.reactions)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition ${users.includes(user.uid) ? 'bg-blue-500/30 border border-blue-400/50' : 'bg-white/10 hover:bg-white/20'}`}>
                                    {emoji} {users.length > 1 && <span className="font-bold text-[9px]">{users.length}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Quick Reaction on hover */}
                          <div className={`absolute top-1/2 -translate-y-1/2 ${isMe ? 'left-full ml-1' : 'right-full mr-1'} opacity-0 group-hover:opacity-100 transition-all flex items-center gap-0.5 z-20`}>
                            {/* Quick Emoji */}
                            <button onClick={() => handleReaction(msg.id, '👍', msg.reactions)} className="w-6 h-6 bg-[#232E3C] rounded-full flex items-center justify-center text-xs hover:scale-125 transition shadow">👍</button>
                            {/* More actions */}
                            <button onClick={() => setShowActionsMenu(showActionsMenu === msg.id ? null : msg.id)} className="w-6 h-6 bg-[#232E3C] rounded-full flex items-center justify-center text-gray-400 hover:text-white transition shadow">
                              <MoreVertical size={12} />
                            </button>
                          </div>

                          {/* Actions Menu */}
                          {showActionsMenu === msg.id && (
                            <div className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} bg-[#232E3C] shadow-2xl rounded-2xl p-1 z-50 min-w-[160px] border border-white/5 animate-fade-in-up`}>
                              {/* Emoji Row */}
                              <div className="flex gap-1 p-2 justify-center bg-[#17212B] rounded-xl mb-1">
                                {EMOJIS.slice(0,5).map(e => (
                                  <button key={e} onClick={() => handleReaction(msg.id, e, msg.reactions)} className="hover:scale-125 transition text-base">{e}</button>
                                ))}
                                <button onClick={() => { setShowEmojiPicker(msg.id); setShowActionsMenu(null); }} className="text-gray-400 hover:text-white transition">+</button>
                              </div>

                              {[
                                { icon: <Reply size={13} className="text-blue-400"/>, label: 'رد', action: () => { setReplyTo(msg); setShowActionsMenu(null); } },
                                { icon: <Copy size={13} className="text-green-400"/>, label: 'نسخ', action: () => handleCopy(msg.text) },
                                { icon: <Pin size={13} className="text-yellow-400"/>, label: pinnedMessage?.id === msg.id ? 'إلغاء التثبيت' : 'تثبيت', action: () => handlePin(msg) },
                                { icon: <Star size={13} className={isStarred ? "text-yellow-400" : "text-gray-400"}/>, label: isStarred ? 'إلغاء النجمة' : 'وضع نجمة', action: () => handleStar(msg.id) },
                                { icon: <Briefcase size={13} className="text-orange-400"/>, label: 'تحويل لمهمة', action: () => handleConvertToTask(msg) },
                              ].map((item, i) => (
                                <button key={i} onClick={item.action} className="flex items-center gap-2.5 w-full p-2 px-3 rounded-lg hover:bg-white/5 text-xs font-medium text-gray-200 text-right transition">
                                  {item.icon}{item.label}
                                </button>
                              ))}

                              {isMe && <>
                                <div className="h-px bg-white/5 my-1" />
                                <button onClick={() => { setEditingMsg(msg); setNewMessage(msg.text); setShowActionsMenu(null); }} className="flex items-center gap-2.5 w-full p-2 px-3 rounded-lg hover:bg-white/5 text-xs font-medium text-blue-400 text-right transition">
                                  <Edit size={13}/> تعديل
                                </button>
                                <button onClick={() => handleDelete(msg.id)} className="flex items-center gap-2.5 w-full p-2 px-3 rounded-lg hover:bg-red-500/10 text-xs font-medium text-red-400 text-right transition">
                                  <Trash2 size={13}/> حذف
                                </button>
                              </>}
                            </div>
                          )}

                          {/* Full Emoji Picker */}
                          {showEmojiPicker === msg.id && (
                            <div className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} z-50 bg-[#232E3C] shadow-2xl rounded-2xl p-3 border border-white/5 grid grid-cols-7 gap-1`}>
                              {EMOJIS.map(e => (
                                <button key={e} onClick={() => handleReaction(msg.id, e, msg.reactions)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg text-lg transition">{e}</button>
                              ))}
                              <button onClick={() => setShowEmojiPicker(null)} className="col-span-7 text-xs text-red-400 font-bold mt-1">إغلاق</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom button */}
            {showScrollBottom && (
              <button onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })} className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-[#2B5278] text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-30 border border-white/10 hover:bg-[#2B5278]/80 transition flex items-center gap-1">
                <span>↓</span> رسائل جديدة
              </button>
            )}

            {/* Input Area */}
            <div className="bg-[#17212B] border-t border-white/5 p-3 shrink-0">
              {replyTo && (
                <div className="flex justify-between items-center bg-[#2B5278]/40 p-2 px-3 rounded-xl mb-2 border-r-2 border-blue-500">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-blue-400 font-bold">الرد على {replyTo.senderName}</p>
                    <p className="text-xs text-gray-400 truncate">{replyTo.text}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-white ml-2"><X size={14}/></button>
                </div>
              )}
              {editingMsg && (
                <div className="flex justify-between items-center bg-orange-500/10 p-2 px-3 rounded-xl mb-2 border-r-2 border-orange-400">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-orange-400 font-bold">تعديل الرسالة</p>
                    <p className="text-xs text-gray-400 truncate">{editingMsg.text}</p>
                  </div>
                  <button onClick={() => { setEditingMsg(null); setNewMessage(""); }} className="text-gray-500 hover:text-white ml-2"><X size={14}/></button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  className="flex-1 p-3 bg-[#232E3C] rounded-2xl border border-white/5 focus:border-blue-500/40 outline-none text-sm text-white placeholder-gray-600 resize-none max-h-32 transition-all"
                  placeholder={activeChannel?.startsWith('dm-') ? `رسالة إلى ${activeChannelName}...` : `اكتب في ${activeChannelName}...`}
                  value={newMessage}
                  style={{ minHeight: '50px' }}
                  onChange={e => { setNewMessage(e.target.value); handleTyping(); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'; }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                />
                <button type="submit" disabled={!newMessage.trim()} className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all disabled:opacity-30 shrink-0 bg-blue-500 hover:bg-blue-400 shadow-lg shadow-blue-500/20">
                  {editingMsg ? <Check size={18} /> : <Send size={18} className="-rotate-45 mb-0.5 mr-0.5" />}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
