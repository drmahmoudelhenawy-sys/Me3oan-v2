import React, { useState, useEffect, useRef, useMemo } from "react";
import { db } from "../services/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, writeBatch, setDoc, deleteDoc, getDocs, where } from "firebase/firestore";
import { Send, Paperclip, Search, Pin, Reply, User, FileText, Image as ImageIcon, X, CornerDownRight, Check, CheckCheck, Loader2, Smile, ArrowDown } from "lucide-react";
import { uploadToCloudinary } from "../services/cloudinary";
import toast from "react-hot-toast";

interface TaskChatProps {
  taskId: string;
  collName: "tasks" | "requests";
  user: any;
  userProfile: any;
}

const EMOJIS = ["❤️", "👍", "🔥", "👏", "😮", "🎉"];

export default function TaskChat({ taskId, collName, user, userProfile }: TaskChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);
  
  const [uploadingFiles, setUploadingFiles] = useState<Array<{ name: string; progress: number }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const myName = userProfile?.displayName || user?.email || "عضو";
  const myUid = user?.uid;

  // 1. Subscribe to real-time chat messages
  useEffect(() => {
    if (!taskId || !collName) return;
    const q = query(
      collection(db, collName, taskId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(docs);
      scrollToBottom();
      
      // Mark unseen messages as read
      const batch = writeBatch(db);
      let updated = false;
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.senderId !== myUid && (!data.seenBy || !data.seenBy.includes(myUid))) {
          const seenList = data.seenBy || [];
          batch.update(docSnap.ref, {
            seenBy: [...seenList, myUid]
          });
          updated = true;
        }
      });
      if (updated) batch.commit();
    });

    return () => unsubscribe();
  }, [taskId, collName, myUid]);

  // 2. Subscribe to typing presence indicators
  useEffect(() => {
    if (!taskId || !collName) return;
    const q = query(
      collection(db, "presence", taskId, "users"),
      where("typing", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs
        .map(doc => doc.data())
        .filter(data => data.userId !== myUid)
        // Only typing in the last 10 seconds (in case typing indicator got stuck)
        .filter(data => {
          const ts = data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : Date.now();
          return Date.now() - ts < 10000;
        })
        .map(data => data.userName);
      setTypingUsers(users);
    });

    return () => unsubscribe();
  }, [taskId, myUid]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    // Write presence state to database
    const presenceRef = doc(db, "presence", taskId, "users", myUid);
    setDoc(presenceRef, {
      userId: myUid,
      userName: myName,
      typing: true,
      online: true,
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setDoc(presenceRef, { typing: false }, { merge: true });
    }, 4500);
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const msgText = inputText;
    setInputText("");
    setReplyingTo(null);

    // Cancel typing indicator
    const presenceRef = doc(db, "presence", taskId, "users", myUid);
    setDoc(presenceRef, { typing: false }, { merge: true });

    await addDoc(collection(db, collName, taskId, "messages"), {
      type: 'text',
      message: msgText,
      senderId: myUid,
      senderName: myName,
      senderAvatar: userProfile?.photoURL || "",
      seenBy: [myUid],
      replyTo: replyingTo ? {
        messageId: replyingTo.id,
        senderName: replyingTo.senderName,
        text: replyingTo.message
      } : null,
      createdAt: serverTimestamp()
    });
  };

  // Upload attachment file directly in chat
  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesList = Array.from(e.target.files);
    
    for (const file of filesList) {
      const ext = file.name.split('.').pop()?.toLowerCase() || "";
      if (["exe", "bat", "dll", "js"].includes(ext)) {
        toast.error(`الملف "${file.name}" غير مسموح بروعه لأسباب أمنية.`);
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`الملف "${file.name}" يتجاوز الحد الأقصى للحجم (100MB).`);
        continue;
      }

      setUploadingFiles(prev => [...prev, { name: file.name, progress: 0 }]);

      try {
        const metadata = await uploadToCloudinary(file, (progress) => {
          setUploadingFiles(prev => prev.map(f => f.name === file.name ? { ...f, progress } : f));
        });

        // 1. Write file to subcollection "files"
        const filesSnap = await getDocs(collection(db, collName, taskId, "files"));
        const nextVersion = filesSnap.size + 1;

        const fileDocRef = await addDoc(collection(db, collName, taskId, "files"), {
          publicId: metadata.public_id,
          secureUrl: metadata.secure_url,
          originalFilename: file.name,
          submissionVersion: nextVersion,
          format: metadata.format,
          resourceType: metadata.resource_type,
          bytes: metadata.bytes,
          uploadedBy: myName,
          createdAt: serverTimestamp()
        });

        // 2. Add message to subcollection "messages" referencing the file ID
        await addDoc(collection(db, collName, taskId, "messages"), {
          type: metadata.resource_type === 'image' ? 'image' : 'file',
          message: `📎 أرسل ملفاً: ${file.name}`,
          senderId: myUid,
          senderName: myName,
          senderAvatar: userProfile?.photoURL || "",
          attachmentIds: [fileDocRef.id],
          seenBy: [myUid],
          createdAt: serverTimestamp()
        });

        toast.success(`تم الرفع بنجاح: ${file.name}`);
      } catch (err) {
        toast.error(`فشل الرفع: ${file.name}`);
      } finally {
        setUploadingFiles(prev => prev.filter(f => f.name !== file.name));
      }
    }
  };

  // Toggle Pinned Message
  const togglePin = async (msg: any) => {
    const msgRef = doc(db, collName, taskId, "messages", msg.id);
    await updateDoc(msgRef, {
      pinned: !msg.pinned
    });
    toast.success(msg.pinned ? "تم إلغاء التثبيت" : "تم تثبيت الرسالة");
  };

  // Add / Toggle Reaction directly on message
  const handleToggleReaction = async (msg: any, emoji: string) => {
    const msgRef = doc(db, collName, taskId, "messages", msg.id);
    const currentReactions = msg.reactions || {};
    const usersList = currentReactions[emoji] || [];
    
    let updatedUsers: string[];
    if (usersList.includes(myUid)) {
      updatedUsers = usersList.filter((uid: string) => uid !== myUid);
    } else {
      updatedUsers = [...usersList, myUid];
    }

    const nextReactions = { ...currentReactions };
    if (updatedUsers.length > 0) {
      nextReactions[emoji] = updatedUsers;
    } else {
      delete nextReactions[emoji];
    }

    await updateDoc(msgRef, {
      reactions: nextReactions
    });
  };

  // Comprehensive Search (Messages, Files, People)
  const filteredMessages = useMemo(() => {
    if (!searchText.trim()) return messages;
    const queryStr = searchText.toLowerCase();
    return messages.filter(m => 
      m.message?.toLowerCase().includes(queryStr) ||
      m.senderName?.toLowerCase().includes(queryStr)
    );
  }, [messages, searchText]);

  const pinnedMessage = useMemo(() => {
    return messages.find(m => m.pinned);
  }, [messages]);

  return (
    <div className="flex flex-col h-[65vh] bg-slate-50 dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-150 dark:border-slate-800 text-right" dir="rtl">
      
      {/* Top Search & Pin Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-2 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setShowSearch(!showSearch)} 
            className={`p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850 transition ${showSearch ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'}`}
          >
            <Search size={15} />
          </button>

          {pinnedMessage && (
            <div className="flex-1 max-w-[80%] mx-3 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-1.5 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30">
              <div className="flex items-center gap-1.5 min-w-0">
                <Pin size={11} className="text-indigo-600 shrink-0 transform rotate-45" />
                <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 shrink-0">مثبتة:</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-350 truncate">{pinnedMessage.message}</span>
              </div>
              <button onClick={() => togglePin(pinnedMessage)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {showSearch && (
          <input
            type="text"
            className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-150 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
            placeholder="البحث الشامل (الرسائل، الملفات، الأشخاص)..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {filteredMessages.map((msg) => {
          const isMe = msg.senderId === myUid;
          const isMentioned = msg.message?.includes(`@${myName}`);
          const isSeen = msg.seenBy && msg.seenBy.filter((uid: string) => uid !== myUid).length > 0;

          // Render system activity badges differently (WhatsApp style)
          if (['system', 'approval', 'revision', 'delivery'].includes(msg.type)) {
            let symbol = "⚙️";
            let bgClass = "bg-slate-100 text-slate-500 dark:bg-slate-850 dark:text-slate-400";
            if (msg.type === 'approval') {
              symbol = "✅";
              bgClass = "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30";
            } else if (msg.type === 'revision') {
              symbol = "🔄";
              bgClass = "bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30 animate-pulse";
            } else if (msg.type === 'delivery') {
              symbol = "📎";
              bgClass = "bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30";
            }

            return (
              <div key={msg.id} className="flex justify-center my-2 text-center">
                <div className={`px-4 py-2 rounded-2xl text-[10px] font-black flex items-center gap-1.5 max-w-[85%] leading-relaxed ${bgClass}`}>
                  <span className="shrink-0">{symbol}</span>
                  <span>{msg.message}</span>
                </div>
              </div>
            );
          }

          // User chat bubble
          return (
            <div key={msg.id} className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center shrink-0 border border-indigo-100/50 dark:border-indigo-900/30 overflow-hidden shadow-sm">
                {msg.senderAvatar ? (
                  <img src={msg.senderAvatar} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase">
                    {msg.senderName.substring(0, 2)}
                  </span>
                )}
              </div>

              <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                
                {/* Meta details */}
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-350">{msg.senderName}</span>
                  <span className="text-[9px] text-slate-400">
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'}) : 'الآن'}
                  </span>
                </div>

                {/* Reply preview */}
                {msg.replyTo && (
                  <div className="bg-slate-100/70 border-r-2 border-indigo-500/80 px-2.5 py-1 text-[9px] rounded-t-xl text-slate-500 font-bold max-w-full truncate dark:bg-slate-800/40">
                    <span className="font-black text-indigo-600 block">{msg.replyTo.senderName}:</span>
                    {msg.replyTo.text}
                  </div>
                )}

                {/* Chat bubble body */}
                <div className={`group relative p-3 rounded-2xl shadow-sm border ${
                  isMe
                    ? 'bg-indigo-600 border-indigo-700 text-white rounded-tl-none dark:bg-indigo-700 dark:border-indigo-850'
                    : isMentioned
                      ? 'bg-amber-50 border-amber-200 text-amber-900 rounded-tr-none dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300'
                      : 'bg-white border-slate-100 text-slate-700 rounded-tr-none dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200'
                }`}>
                  
                  {/* Hover toolbar (emojis, reply, pin) */}
                  <div className={`absolute top-0 z-10 hidden group-hover:flex items-center gap-1.5 bg-white/95 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 p-1.5 rounded-xl shadow-lg -translate-y-1/2 ${isMe ? 'left-2' : 'right-2'}`}>
                    <div className="flex gap-0.5 border-l border-slate-100 dark:border-slate-700 pl-1.5">
                      {EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(msg, emoji)}
                          className="hover:scale-125 transition text-xs"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setReplyingTo(msg)} className="text-slate-400 hover:text-indigo-600 p-0.5" title="رد">
                      <Reply size={12} />
                    </button>
                    <button onClick={() => togglePin(msg)} className="text-slate-400 hover:text-indigo-600 p-0.5" title={msg.pinned ? "إلغاء التثبيت" : "تثبيت"}>
                      <Pin size={12} className="transform rotate-45" />
                    </button>
                  </div>

                  {/* Message message or attachments */}
                  {msg.type === 'image' || msg.type === 'file' ? (
                    <div className="space-y-1.5">
                      <p className="text-xs leading-relaxed font-black whitespace-pre-wrap">{msg.message}</p>
                      {msg.attachmentUrl && (
                        <a
                          href={msg.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-[9px] font-black underline block ${isMe ? 'text-indigo-150 hover:text-white' : 'text-indigo-600 hover:text-indigo-750'}`}
                        >
                          فتح الملف / تحميل المرفق
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">{msg.message}</p>
                  )}

                  {/* Reactions map */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 justify-start">
                      {Object.keys(msg.reactions).map(emoji => {
                        const reactors = msg.reactions[emoji] || [];
                        const didIReact = reactors.includes(myUid);
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(msg, emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border transition ${
                              didIReact
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400'
                                : 'bg-slate-50 border-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{reactors.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Read marks */}
                  {isMe && (
                    <div className="flex justify-end mt-1 text-[9px] text-white/70">
                      {isSeen ? <CheckCheck size={12} className="text-green-300" /> : <Check size={12} />}
                    </div>
                  )}

                </div>

              </div>
            </div>
          );
        })}

        {/* Uploading progress overlay */}
        {uploadingFiles.map((up, idx) => (
          <div key={idx} className="flex items-center gap-2 p-2 bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 max-w-[50%] mr-auto shadow-sm">
            <Loader2 size={12} className="animate-spin text-indigo-600" />
            <span className="truncate max-w-[120px]">{up.name}</span>
            <span className="text-[10px] text-indigo-650 font-black">{up.progress}%</span>
          </div>
        ))}

        <div ref={chatEndRef} />
      </div>

      {/* Typing indicator indicator banner */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-[9px] font-bold text-slate-400 bg-white/50 dark:bg-slate-900/50 shrink-0">
          <span>{typingUsers.join("، ")} يكتب...</span>
        </div>
      )}

      {/* Input panel footer */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
        
        {/* Reply preview indicator bar */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-850 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <CornerDownRight size={12} className="text-indigo-600 shrink-0" />
              <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 shrink-0">ردًا على {replyingTo.senderName}:</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{replyingTo.message}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-slate-600 transition">
              <X size={12} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-2">
          
          <label className="p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 border border-slate-150 dark:border-slate-850">
            <Paperclip size={18} />
            <input type="file" onChange={handleDirectUpload} multiple className="hidden" />
          </label>

          <input
            className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-150 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="اكتب رسالة أو استفساراً..."
            value={inputText}
            onChange={handleInputChange}
          />
          
          <button type="submit" className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:scale-105 active:scale-95 transition shrink-0">
            <Send size={18} />
          </button>
        </form>

      </div>

    </div>
  );
}
