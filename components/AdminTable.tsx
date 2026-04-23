import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../services/firebase";
import { DEPARTMENTS } from "../utils/constants";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, setDoc, getDoc, or } from "firebase/firestore";
import { User } from "firebase/auth";
import { 
    Plus, Trash2, Settings, Search, X, 
    Type, List, Calendar, CheckSquare, Hash, 
    MoreHorizontal, ChevronDown, GripVertical, Download, Share2, ArrowLeft,
    ArrowUpDown, ArrowUp, ArrowDown, Filter, SlidersHorizontal, LayoutGrid, CheckCircle2, Clock, AlertCircle, Maximize2, Minimize2
} from "lucide-react";
import { utils, writeFile } from "xlsx";

interface AdminTableProps {
  user: User;
  mode: "general" | "personal";
  departmentId?: string;
}

type ColumnType = 'text' | 'select' | 'date' | 'checkbox' | 'number';

interface SelectOption {
    id: string;
    label: string;
    color: string;
}

interface ColumnDef {
    id: string;
    label: string;
    type: ColumnType;
    width?: number;
    options?: SelectOption[];
}

const DEFAULT_COLUMNS: ColumnDef[] = [
    { id: 'title', label: 'المهمة', type: 'text', width: 280 },
    { 
        id: 'status', label: 'الحالة', type: 'select', width: 140,
        options: [
            { id: 'opt1', label: 'قيد التنفيذ', color: '#f59e0b' },
            { id: 'opt2', label: 'مكتمل',      color: '#10b981' },
            { id: 'opt3', label: 'ملغي',        color: '#ef4444' },
            { id: 'opt4', label: 'معلق',        color: '#8b5cf6' },
        ]
    },
    { id: 'priority', label: 'الأولوية', type: 'select', width: 130,
        options: [
            { id: 'p1', label: 'عالي',   color: '#fca5a5' },
            { id: 'p2', label: 'متوسط',  color: '#93c5fd' },
            { id: 'p3', label: 'عادي',   color: '#d1fae5' },
        ]
    },
    { id: 'branch', label: 'الفرع', type: 'text', width: 150 },
    { id: 'dueDate', label: 'التاريخ', type: 'date', width: 150 },
    { id: 'done', label: 'تمت', type: 'checkbox', width: 80 },
    { id: 'notes', label: 'ملاحظات', type: 'text', width: 200 },
];

// ─── Type Icon ───────────────────────────────────────────────────────────────
const TypeIcon = ({ type }: { type: ColumnType }) => {
    switch (type) {
        case 'text':     return <Type size={13} className="text-gray-400"/>;
        case 'select':   return <List size={13} className="text-purple-400"/>;
        case 'date':     return <Calendar size={13} className="text-blue-400"/>;
        case 'checkbox': return <CheckSquare size={13} className="text-green-400"/>;
        case 'number':   return <Hash size={13} className="text-orange-400"/>;
        default:         return <Type size={13}/>;
    }
};

// ─── Select Badge ─────────────────────────────────────────────────────────────
const SelectBadge = ({ value, options, onChange }: { value: string, options?: SelectOption[], onChange: (v: string) => void }) => {
    const opt = options?.find(o => o.label === value);
    const bg  = opt?.color ?? '#e5e7eb';
    // Determine if color is dark (use white text) or light (use dark text)
    const isLight = (hex: string) => {
        const c = hex.replace('#','');
        const r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
        return (r*299 + g*587 + b*114) / 1000 > 160;
    };
    const textColor = opt ? (isLight(bg) ? '#1f2937' : '#fff') : '#9ca3af';

    return (
        <div className="relative w-full h-full flex items-center px-2">
            <select
                className="w-full text-[12px] font-bold rounded-lg px-2.5 py-1 appearance-none cursor-pointer outline-none border-0 transition-all"
                style={{ backgroundColor: bg, color: textColor }}
                value={value || ""}
                onChange={e => onChange(e.target.value)}
            >
                <option value="" style={{background:'#fff', color:'#9ca3af'}}>- اختر -</option>
                {options?.map(o => (
                    <option key={o.id} value={o.label} style={{background:'#fff', color:'#1f2937'}}>{o.label}</option>
                ))}
            </select>
            <ChevronDown size={10} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{color: textColor}}/>
        </div>
    );
};

// ─── Cell ─────────────────────────────────────────────────────────────────────
const Cell = ({ row, col, onUpdate }: { row: any; col: ColumnDef; onUpdate: (v: any) => void }) => {
    const val = row[col.id];

    if (col.type === 'select') {
        return <SelectBadge value={val} options={col.options} onChange={onUpdate} />;
    }

    if (col.type === 'checkbox') {
        return (
            <div className="flex items-center justify-center h-full w-full cursor-pointer" onClick={() => onUpdate(!val)}>
                {val
                    ? <div className="flex items-center justify-center w-6 h-6 bg-emerald-500 rounded-md shadow-sm shadow-emerald-200">
                          <CheckCircle2 size={14} className="text-white" strokeWidth={2.5}/>
                      </div>
                    : <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-md hover:border-indigo-400 transition-colors"/>
                }
            </div>
        );
    }

    if (col.type === 'date') {
        return (
            <input
                type="date"
                className="w-full h-full bg-transparent outline-none text-xs px-3 text-gray-600 dark:text-gray-300 font-mono tracking-tight"
                value={val || ""}
                onChange={e => onUpdate(e.target.value)}
            />
        );
    }

    if (col.type === 'number') {
        return (
            <input
                type="number"
                className="w-full h-full bg-transparent outline-none text-sm px-3 text-gray-700 dark:text-white"
                value={val || ""}
                onChange={e => onUpdate(e.target.value)}
                placeholder="0"
            />
        );
    }

    // Text
    return (
        <input
            className="w-full h-full bg-transparent outline-none text-sm px-3 text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-gray-600"
            value={val || ""}
            onChange={e => onUpdate(e.target.value)}
            placeholder={col.id === 'title' ? "اكتب المهمة..." : "فارغ"}
        />
    );
};

// ─── Column Settings Modal ─────────────────────────────────────────────────────
const TYPE_META: Record<ColumnType, { label: string; icon: string; color: string; grad: string }> = {
    text:     { label: 'نص',     icon: 'Aa', color: 'text-slate-600',  grad: 'from-slate-500  to-gray-600'   },
    select:   { label: 'قائمة', icon: '☰',  color: 'text-purple-600', grad: 'from-purple-500 to-violet-600' },
    date:     { label: 'تاريخ', icon: '📅', color: 'text-blue-600',   grad: 'from-blue-500   to-indigo-600' },
    checkbox: { label: 'علامة', icon: '✔',  color: 'text-emerald-600',grad: 'from-emerald-500 to-green-600' },
    number:   { label: 'رقم',   icon: '#',  color: 'text-orange-600', grad: 'from-orange-500 to-amber-600'  },
};

const ColumnSettings = ({ col, onClose, onSave, onDelete }: {
    col: ColumnDef; onClose: () => void; onSave: (c: ColumnDef) => void; onDelete: () => void;
}) => {
    const [editedCol, setEditedCol] = useState(col);
    const [newOpt, setNewOpt] = useState({ label: "", color: "#6366f1" });
    const meta = TYPE_META[editedCol.type] ?? TYPE_META.text;

    const addOpt = () => {
        if (!newOpt.label) return;
        setEditedCol({ ...editedCol, options: [...(editedCol.options || []), { id: Date.now().toString(), ...newOpt }] });
        setNewOpt({ label: "", color: "#6366f1" });
    };

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-[340px] rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] animate-fade-in-up" onClick={e => e.stopPropagation()}>

                {/* ── Gradient Header ── */}
                <div className={`relative bg-gradient-to-br ${meta.grad} p-5 pb-12 overflow-hidden`}>
                    <div className="absolute -top-8 -left-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none"/>
                    <button
                        onClick={onClose}
                        className="absolute top-3.5 left-3.5 w-7 h-7 bg-white/20 hover:bg-white/35 flex items-center justify-center rounded-full transition text-white text-xs"
                    >
                        <X size={14}/>
                    </button>
                    <div className="text-center">
                        <div className="w-14 h-14 bg-white/20 border-2 border-white/40 rounded-2xl flex items-center justify-center mx-auto mb-2.5 text-white text-2xl font-black shadow-xl backdrop-blur-sm">
                            {meta.icon}
                        </div>
                        <p className="text-white font-black text-base leading-tight">{editedCol.label || 'عمود جديد'}</p>
                        <p className="text-white/70 text-xs mt-0.5 font-medium">{meta.label}</p>
                    </div>
                </div>

                {/* ── Body Card ── */}
                <div className="-mt-7 mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 border border-gray-100 dark:border-gray-700 space-y-3.5">

                    {/* Column Name */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">اسم العمود</label>
                        <input
                            className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                            value={editedCol.label}
                            onChange={e => setEditedCol({...editedCol, label: e.target.value})}
                            placeholder="اسم العمود..."
                        />
                    </div>

                    {/* Column Type */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">النوع</label>
                        <div className="grid grid-cols-5 gap-1.5">
                            {(Object.entries(TYPE_META) as [ColumnType, typeof TYPE_META.text][]).map(([type, m]) => (
                                <button
                                    key={type}
                                    onClick={() => setEditedCol({...editedCol, type})}
                                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[9px] font-bold transition border ${
                                        editedCol.type === type
                                            ? `bg-gradient-to-br ${m.grad} text-white border-transparent shadow-md scale-105`
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-indigo-400 hover:text-indigo-600'
                                    }`}
                                    title={m.label}
                                >
                                    <span className="text-base leading-none">{m.icon}</span>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Select Options */}
                    {editedCol.type === 'select' && (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">الخيارات</span>
                                <span className="text-[10px] text-gray-400 font-mono">{editedCol.options?.length || 0} خيار</span>
                            </div>
                            <div className="space-y-1 p-2 max-h-36 overflow-y-auto custom-scrollbar">
                                {editedCol.options?.map((opt, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white dark:bg-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700 group">
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-5 h-5 rounded-md overflow-hidden shrink-0 shadow-sm border border-gray-200 dark:border-gray-600">
                                                <div className="absolute inset-0" style={{backgroundColor: opt.color}}/>
                                                <input
                                                    type="color"
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    value={opt.color}
                                                    onChange={e => {
                                                        const o = [...(editedCol.options||[])];
                                                        o[i] = {...o[i], color: e.target.value};
                                                        setEditedCol({...editedCol, options: o});
                                                    }}
                                                />
                                            </div>
                                            <span
                                                className="text-xs font-bold px-2 py-0.5 rounded-md"
                                                style={{backgroundColor: opt.color + '22', color: opt.color}}
                                            >
                                                {opt.label}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => setEditedCol({...editedCol, options: (editedCol.options||[]).filter((_,j) => j !== i)})}
                                            className="text-gray-300 hover:text-red-500 p-0.5 rounded transition opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={12}/>
                                        </button>
                                    </div>
                                ))}
                                {(!editedCol.options || editedCol.options.length === 0) && (
                                    <p className="text-center text-[10px] text-gray-400 py-2">لا توجد خيارات بعد</p>
                                )}
                            </div>
                            {/* Add new option */}
                            <div className="p-2 pt-1 border-t border-gray-200 dark:border-gray-700 flex gap-1.5">
                                <input
                                    className="flex-1 p-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="أضف خياراً جديداً..."
                                    value={newOpt.label}
                                    onChange={e => setNewOpt({...newOpt, label: e.target.value})}
                                    onKeyDown={e => e.key === 'Enter' && addOpt()}
                                />
                                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0 shadow-sm">
                                    <div className="absolute inset-0" style={{backgroundColor: newOpt.color}}/>
                                    <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={newOpt.color} onChange={e => setNewOpt({...newOpt, color: e.target.value})}/>
                                </div>
                                <button
                                    onClick={addOpt}
                                    className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center transition shadow-sm shrink-0"
                                >
                                    <Plus size={14}/>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer Buttons */}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={() => onSave(editedCol)}
                            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition shadow-md shadow-indigo-500/30"
                        >
                            حفظ
                        </button>
                        <button
                            onClick={onDelete}
                            className="w-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition border border-gray-200 dark:border-gray-700"
                        >
                            <Trash2 size={16}/>
                        </button>
                    </div>
                </div>
                <div className="h-4"/>
            </div>
        </div>
    );
};

// ─── Sort Indicator ───────────────────────────────────────────────────────────
type SortDir = 'asc' | 'desc' | null;
const SortIcon = ({ dir }: { dir: SortDir }) => {
    if (dir === 'asc')  return <ArrowUp size={12} className="text-indigo-500"/>;
    if (dir === 'desc') return <ArrowDown size={12} className="text-indigo-500"/>;
    return <ArrowUpDown size={11} className="text-gray-300 group-hover:text-gray-400 transition"/>;
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminTable({ user, mode }: AdminTableProps) {
    const [columns, setColumns]       = useState<ColumnDef[]>(DEFAULT_COLUMNS);
    const [rows, setRows]             = useState<any[]>([]);
    const [loading, setLoading]       = useState(true);
    const [editingCol, setEditingCol] = useState<ColumnDef | null>(null);
    const [forwardingRowId, setForwardingRowId] = useState<string | null>(null);
    const [search, setSearch]         = useState("");
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showFilters, setShowFilters]   = useState(false);

    // Sorting
    const [sortCol,  setSortCol]  = useState<string | null>(null);
    const [sortDir,  setSortDir]  = useState<SortDir>(null);

    // Quick Filters
    const [filterBranch,   setFilterBranch]   = useState("");
    const [filterPriority, setFilterPriority] = useState("");
    const [filterStatus,   setFilterStatus]   = useState("");
    const [filterDone,     setFilterDone]      = useState<"all"|"done"|"pending">("all");

    // Mobile row editor
    const [mobileEditRow, setMobileEditRow] = useState<any | null>(null);
    const [mobileEditValues, setMobileEditValues] = useState<Record<string, any>>({});

    // Drag state
    const [dragId,   setDragId]   = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);

    const boardId      = mode === 'general' ? 'general_admin_board' : `personal_board_${user.uid}`;
    const settingsDocId = mode === 'general' ? 'general_admin_config' : `personal_config_${user.uid}`;

    // ── Load Config ──
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDoc(doc(db, "app_settings", settingsDocId));
                if (snap.exists() && snap.data().columns) setColumns(snap.data().columns);
            } catch(e) { console.error(e); }
        })();
    }, [settingsDocId]);

    // ── Load Rows ──
    useEffect(() => {
        setLoading(true);
        const q = query(
            collection(db, "tasks"),
            or(
                where("sourceDept", "==", boardId),
                where("forwardedToDept", "==", boardId)
            )
        );
        const unsub = onSnapshot(q, snap => {
            setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, [boardId]);

    // ── Save Config ──
    const saveColumnsConfig = async (newCols: ColumnDef[]) => {
        setColumns(newCols);
        try { await setDoc(doc(db, "app_settings", settingsDocId), { columns: newCols }, { merge: true }); }
        catch(e) { console.error(e); }
    };

    // ── Column Actions ──
    const addColumn = () => saveColumnsConfig([...columns, { id: `col_${Date.now()}`, label: "عمود جديد", type: "text", width: 150 }]);
    const updateColumn = (c: ColumnDef) => { saveColumnsConfig(columns.map(x => x.id === c.id ? c : x)); setEditingCol(null); };
    const deleteColumn = (id: string) => { if(!confirm("حذف العمود؟")) return; saveColumnsConfig(columns.filter(c => c.id !== id)); setEditingCol(null); };

    // ── Row Actions ──
    const addRow    = async () => { try { await addDoc(collection(db, "tasks"), { sourceDept: boardId, created_at: new Date().toISOString(), created_by: user.email, title: "" }); } catch(e) { alert("خطأ"); } };
    const updateRow = async (id: string, field: string, val: any) => { try { await updateDoc(doc(db, "tasks", id), { [field]: val }); } catch(e) { console.error(e); } };
    const deleteRow = async (id: string) => { if(!confirm("حذف الصف؟")) return; await deleteDoc(doc(db, "tasks", id)); };
    const onForward = async (id: string, dept: string) => { await updateDoc(doc(db, "tasks", id), { forwardedToDept: dept }); setForwardingRowId(null); };

    // Mobile edit helpers
    const openMobileEdit = (row: any) => {
        const vals: Record<string, any> = {};
        columns.forEach(c => vals[c.id] = row[c.id] ?? '');
        setMobileEditValues(vals);
        setMobileEditRow(row);
    };
    const saveMobileEdit = async () => {
        if (!mobileEditRow) return;
        const updates: Record<string, any> = {};
        columns.forEach(c => { updates[c.id] = mobileEditValues[c.id] ?? ''; });
        await updateDoc(doc(db, "tasks", mobileEditRow.id), updates);
        setMobileEditRow(null);
    };

    // ── Drag & Drop ──
    const handleDragStart = (id: string) => setDragId(id);
    const handleDragEnd   = async () => {
        if (!dragId || !dragOver || dragId === dragOver) { setDragId(null); setDragOver(null); return; }
        const fromIdx = processedRows.findIndex(r => r.id === dragId);
        const toIdx   = processedRows.findIndex(r => r.id === dragOver);
        if (fromIdx === -1 || toIdx === -1) { setDragId(null); setDragOver(null); return; }
        // Assign new order values
        const reordered = [...processedRows];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        // Update order field in firebase for affected rows
        await Promise.all(reordered.map((r, i) => updateDoc(doc(db, "tasks", r.id), { order: reordered.length - i })));
        setDragId(null); setDragOver(null);
    };

    // ── Move Up/Down ──
    const moveTask = async (id: string, dir: 'up' | 'down') => {
        const idx = processedRows.findIndex(r => r.id === id);
        const target = dir === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= processedRows.length) return;
        const t1 = processedRows[idx], t2 = processedRows[target];
        await Promise.all([
            updateDoc(doc(db, "tasks", t1.id), { order: t2.order || processedRows.length - target }),
            updateDoc(doc(db, "tasks", t2.id), { order: t1.order || processedRows.length - idx }),
        ]);
    };

    // ── Sort ──
    const toggleSort = (colId: string) => {
        if (sortCol !== colId) { setSortCol(colId); setSortDir('asc'); }
        else if (sortDir === 'asc') setSortDir('desc');
        else { setSortCol(null); setSortDir(null); }
    };

    // ── Derive unique filter options ──
    const branchCol    = columns.find(c => c.id === 'branch' || c.label === 'الفرع');
    const priorityCol  = columns.find(c => c.id === 'priority');
    const statusCol    = columns.find(c => c.id === 'status');
    const branchColId  = branchCol?.id ?? null;

    const uniqueBranches   = [...new Set(rows.map(r => r[branchColId ?? 'branch'] || r.branch).filter(Boolean))];

    // ── Process rows ──
    const processedRows = (() => {
        let out = [...rows];

        // Quick filters
        if (filterBranch)   out = out.filter(r => (r[branchColId ?? 'branch'] || r.branch) === filterBranch);
        if (filterPriority) out = out.filter(r => r.priority === filterPriority);
        if (filterStatus)   out = out.filter(r => r.status   === filterStatus);
        if (filterDone === 'done')    out = out.filter(r => r.done === true);
        if (filterDone === 'pending') out = out.filter(r => !r.done);

        // Search
        if (search) out = out.filter(r => columns.some(c => r[c.id] && String(r[c.id]).toLowerCase().includes(search.toLowerCase())));

        // Sort
        if (sortCol && sortDir) {
            out.sort((a, b) => {
                const av = String(a[sortCol] || ''), bv = String(b[sortCol] || '');
                return sortDir === 'asc' ? av.localeCompare(bv, 'ar') : bv.localeCompare(av, 'ar');
            });
        } else {
            out.sort((a, b) => (b.order || 0) - (a.order || 0) || new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime());
        }

        return out;
    })();

    // Stats — check both the checkbox field AND the status select field
    const total      = rows.length;
    const doneCount  = rows.filter(r => r.done === true || r.done === 'true' || r.status === 'مكتمل').length;
    const highCount  = rows.filter(r => r.priority === 'عالي').length;


    // Export
    const handleExport = () => {
        const data = rows.map(r => { const f: any = {}; columns.forEach(c => f[c.label] = r[c.id] || ""); return f; });
        const wb = utils.book_new(); utils.book_append_sheet(wb, utils.json_to_sheet(data), "Sheet");
        writeFile(wb, `admin_${new Date().toISOString().split('T')[0]}.xlsx`);
    };
    const handleBackup = () => {
        const a = document.createElement('a');
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rows));
        a.download = `backup_${new Date().toISOString()}.json`; a.click();
    };

    const activeFiltersCount = [filterBranch, filterPriority, filterStatus, filterDone !== 'all' ? filterDone : ''].filter(Boolean).length;

    return (
        <div className={`flex flex-col ${isFullScreen ? 'fixed inset-0 z-[1000]' : 'h-full'} bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-gray-950 dark:to-indigo-950/20 animate-fade-in-up`} dir="rtl">
            
            {/* ── Modals ── */}
            {editingCol && <ColumnSettings col={editingCol} onClose={() => setEditingCol(null)} onSave={updateColumn} onDelete={() => deleteColumn(editingCol.id)} />}

            {/* ── Mobile Row Edit Sheet ── */}
            {mobileEditRow && (
                <div className="fixed inset-0 z-[400] flex items-end md:hidden" onClick={() => setMobileEditRow(null)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
                    <div className="relative w-full bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Drag Handle */}
                        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mt-3 shrink-0"/>
                        {/* Header */}
                        <div className="px-5 pt-3 pb-2 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-black text-gray-800 dark:text-white text-base">تعديل السطر</h3>
                                <p className="text-[10px] text-gray-400">{mobileEditRow.title || 'سطر جديد'}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { deleteRow(mobileEditRow.id); setMobileEditRow(null); }} className="w-8 h-8 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                                    <Trash2 size={14}/>
                                </button>
                                <button onClick={() => setMobileEditRow(null)} className="w-8 h-8 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-xl flex items-center justify-center">
                                    <X size={14}/>
                                </button>
                            </div>
                        </div>
                        {/* Fields */}
                        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-3 custom-scrollbar">
                            {columns.map(col => (
                                <div key={col.id}>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                        <TypeIcon type={col.type}/> {col.label}
                                    </label>
                                    {col.type === 'checkbox' ? (
                                        <button
                                            onClick={() => setMobileEditValues(v => ({...v, [col.id]: !v[col.id]}))}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition w-full text-sm font-bold ${
                                                mobileEditValues[col.id]
                                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                                    : 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700'
                                            }`}
                                        >
                                            <CheckCircle2 size={16} className={mobileEditValues[col.id] ? 'text-emerald-500' : 'text-gray-300'}/>
                                            {mobileEditValues[col.id] ? 'تمت' : 'لم تتم بعد'}
                                        </button>
                                    ) : col.type === 'select' ? (
                                        <div className="flex flex-wrap gap-2">
                                            {col.options?.map(opt => (
                                                <button key={opt.id}
                                                    onClick={() => setMobileEditValues(v => ({...v, [col.id]: opt.label}))}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${
                                                        mobileEditValues[col.id] === opt.label ? 'border-transparent shadow-md scale-105' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                                    }`}
                                                    style={mobileEditValues[col.id] === opt.label ? { background: opt.color, color: '#fff', borderColor: opt.color } : {}}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    ) : col.type === 'date' ? (
                                        <input
                                            type="date"
                                            value={mobileEditValues[col.id] || ''}
                                            onChange={e => setMobileEditValues(v => ({...v, [col.id]: e.target.value}))}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    ) : (
                                        <input
                                            type={col.type === 'number' ? 'number' : 'text'}
                                            value={mobileEditValues[col.id] || ''}
                                            onChange={e => setMobileEditValues(v => ({...v, [col.id]: e.target.value}))}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder={`أدخل ${col.label}...`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        {/* Save Button */}
                        <div className="p-4 shrink-0 flex gap-3">
                            <button onClick={() => setForwardingRowId(mobileEditRow.id)} className="flex-1 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold rounded-2xl text-sm flex items-center justify-center gap-2">
                                <Share2 size={15}/> تحويل
                            </button>
                            <button onClick={saveMobileEdit} className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl text-sm shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2">
                                <CheckCircle2 size={15}/> حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {forwardingRowId && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setForwardingRowId(null)}>
                    <div className="bg-white dark:bg-gray-900 w-72 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 p-5 pb-12 overflow-hidden">
                            <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"/>
                            <button onClick={() => setForwardingRowId(null)} className="absolute top-3.5 left-3.5 w-7 h-7 bg-white/20 hover:bg-white/35 flex items-center justify-center rounded-full transition text-white">
                                <X size={14}/>
                            </button>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-white/20 border-2 border-white/40 rounded-2xl flex items-center justify-center mx-auto mb-2 text-white shadow-xl">
                                    <Share2 size={22}/>
                                </div>
                                <p className="text-white font-black text-sm">تحويل المهمة</p>
                                <p className="text-blue-200 text-xs mt-0.5">اختر القسم المستلم</p>
                            </div>
                        </div>
                        {/* Body */}
                        <div className="-mt-6 mx-3 mb-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-gray-50 dark:divide-gray-700/50">
                                {DEPARTMENTS.map(dept => (
                                    <button
                                        key={dept.id}
                                        onClick={() => onForward(forwardingRowId, dept.id)}
                                        className="w-full text-right px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm dark:text-white transition font-medium flex items-center justify-between group"
                                    >
                                        <span className="text-gray-800 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition">{dept.name}</span>
                                        <span className="text-gray-300 group-hover:text-indigo-400 transition text-lg">←</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div className="px-4 md:px-6 pt-4 pb-3 space-y-3">
                {/* Title Row */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">
                            {mode === 'general' ? 'جدول الإدارة العامة' : 'جدولي الخاص'}
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">{mode === 'general' ? 'القسم الحالي: عام' : 'مساحة خاصة لمهامك'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative hidden md:block">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                            <input
                                className="pl-4 pr-9 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none w-44 focus:w-56 transition-all shadow-sm"
                                placeholder="بحث..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        {/* Filter toggle */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm border ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-400'}`}
                        >
                            <SlidersHorizontal size={14}/>
                            فلترة
                            {activeFiltersCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{activeFiltersCount}</span>}
                        </button>
                        <button onClick={handleExport} className="p-2 bg-white dark:bg-gray-800 text-emerald-600 rounded-xl hover:bg-emerald-50 transition border border-gray-200 dark:border-gray-700 shadow-sm" title="تصدير Excel"><Download size={16}/></button>
                        <button onClick={handleBackup} className="p-2 bg-white dark:bg-gray-800 text-blue-600 rounded-xl hover:bg-blue-50 transition border border-gray-200 dark:border-gray-700 shadow-sm" title="نسخة احتياطية"><Download size={16}/></button>
                        <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 bg-white dark:bg-gray-800 text-gray-500 rounded-xl hover:bg-gray-100 transition border border-gray-200 dark:border-gray-700 shadow-sm">
                            {isFullScreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                        </button>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-3 flex-wrap">
                    {[
                        { label: 'الإجمالي', value: total, color: 'from-slate-500 to-slate-600', icon: <LayoutGrid size={14}/> },
                        { label: 'مكتملة', value: doneCount, color: 'from-emerald-500 to-green-600', icon: <CheckCircle2 size={14}/> },
                        { label: 'المعلقة', value: total - doneCount, color: 'from-amber-500 to-orange-500', icon: <Clock size={14}/> },
                        { label: 'عالي الأولوية', value: highCount, color: 'from-red-500 to-pink-600', icon: <AlertCircle size={14}/> },
                    ].map(s => (
                        <div key={s.label} className={`flex items-center gap-2 bg-gradient-to-r ${s.color} text-white px-3 py-1.5 rounded-xl shadow-sm text-xs font-bold`}>
                            {s.icon} {s.label}: <span className="font-black text-base leading-none">{s.value}</span>
                        </div>
                    ))}
                    <div className="mr-auto text-xs text-gray-400 font-medium hidden md:block">
                        {processedRows.length !== total ? `عرض ${processedRows.length} من ${total}` : `${total} عنصر`}
                    </div>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-lg animate-fade-in-up grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Branch */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">الفرع</label>
                            <select className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                                <option value="">الكل</option>
                                {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        {/* Priority */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">الأولوية</label>
                            <select className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                                <option value="">الكل</option>
                                {priorityCol?.options?.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
                            </select>
                        </div>
                        {/* Status */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">الحالة</label>
                            <select className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <option value="">الكل</option>
                                {statusCol?.options?.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
                            </select>
                        </div>
                        {/* Done */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">الإنجاز</label>
                            <div className="flex gap-1.5">
                                {[{v:'all',l:'الكل'},{v:'done',l:'منجزة'},{v:'pending',l:'معلقة'}].map(x => (
                                    <button key={x.v} onClick={() => setFilterDone(x.v as any)} className={`flex-1 px-2 py-1.5 rounded-xl text-[10px] font-bold transition ${filterDone === x.v ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{x.l}</button>
                                ))}
                            </div>
                        </div>
                        {activeFiltersCount > 0 && (
                            <button onClick={() => { setFilterBranch(''); setFilterPriority(''); setFilterStatus(''); setFilterDone('all'); }} className="col-span-2 md:col-span-4 text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 justify-center pt-1 border-t dark:border-gray-700">
                                <X size={13}/> مسح كل الفلاتر
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Table ── */}
            <div className={`flex-1 mx-4 md:mx-6 mb-4 bg-white dark:bg-gray-800 ${isFullScreen ? 'rounded-none' : 'rounded-2xl'} border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col`}>
                <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
                    <table className="w-full border-collapse text-right min-w-max">
                        {/* ─ THead ─ */}
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white">
                                {/* Drag handle + Actions */}
                                <th className="w-28 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider border-l border-indigo-500/30 sticky right-0 bg-indigo-700 z-30">
                                    الإجراءات
                                </th>
                                {columns.map(col => (
                                    <th
                                        key={col.id}
                                        className="group px-3 py-3 text-[11px] font-bold uppercase tracking-wider border-l border-indigo-500/30 cursor-pointer hover:bg-white/10 transition select-none"
                                        style={{ minWidth: col.width || 140 }}
                                        onClick={() => toggleSort(col.id)}
                                    >
                                        <div className="flex items-center gap-2 justify-end">
                                            <SortIcon dir={sortCol === col.id ? sortDir : null} />
                                            <span>{col.label}</span>
                                            <TypeIcon type={col.type} />
                                            <button
                                                onClick={e => { e.stopPropagation(); setEditingCol(col); }}
                                                className="opacity-0 group-hover:opacity-100 transition p-0.5 hover:bg-white/20 rounded"
                                            >
                                                <MoreHorizontal size={12}/>
                                            </button>
                                        </div>
                                    </th>
                                ))}
                                {/* Add col */}
                                <th className="w-10 border-l border-indigo-500/30 px-2">
                                    <button onClick={addColumn} className="flex items-center justify-center w-full text-indigo-200 hover:text-white hover:bg-white/10 rounded p-1 transition">
                                        <Plus size={16}/>
                                    </button>
                                </th>
                            </tr>
                        </thead>

                        {/* ─ TBody ─ */}
                        <tbody>
                            {loading && (
                                <tr><td colSpan={columns.length + 2} className="text-center py-16 text-gray-400 text-sm">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
                                        جاري التحميل...
                                    </div>
                                </td></tr>
                            )}
                            {!loading && processedRows.length === 0 && (
                                <tr><td colSpan={columns.length + 2} className="text-center py-16 text-gray-400 text-sm">
                                    <div className="flex flex-col items-center gap-3 opacity-50">
                                        <LayoutGrid size={36} className="text-gray-300"/>
                                        <p className="font-medium">لا توجد بيانات</p>
                                    </div>
                                </td></tr>
                            )}
                            {processedRows.map((row, idx) => {
                                const isDragging  = dragId   === row.id;
                                const isDragOver  = dragOver === row.id;
                                const isEven      = idx % 2 === 1;
                                const isCompleted = row.done === true;

                                return (
                                    <tr
                                        key={row.id}
                                        draggable
                                        onDragStart={() => handleDragStart(row.id)}
                                        onDragOver={e => { e.preventDefault(); setDragOver(row.id); }}
                                        onDragEnd={handleDragEnd}
                                        onClick={() => { if (window.innerWidth < 768) openMobileEdit(row); }}
                                        className={`group transition-all border-b border-gray-100 dark:border-gray-700/50 md:cursor-default cursor-pointer
                                            ${isDragging  ? 'opacity-30 scale-[0.99]' : ''}
                                            ${isDragOver  ? 'border-t-2 border-t-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : ''}
                                            ${isCompleted ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : isEven ? 'bg-gray-50/50 dark:bg-gray-900/20' : 'bg-white dark:bg-gray-800'}
                                            hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10`}
                                    >
                                        {/* Actions Cell */}
                                        <td className={`border-l border-gray-100 dark:border-gray-700 p-1 sticky right-0 z-10 ${isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/20' : isEven ? 'bg-gray-50 dark:bg-gray-900/30' : 'bg-white dark:bg-gray-800'}`}>
                                            <div className="flex items-center justify-center gap-0.5">
                                                {/* Drag handle */}
                                                <span className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1 opacity-0 group-hover:opacity-100 transition"><GripVertical size={14}/></span>
                                                {/* Up/Down */}
                                                <button onClick={() => moveTask(row.id, 'up')} className="text-gray-300 hover:text-indigo-500 p-1 transition" title="أعلى"><ArrowUp size={13}/></button>
                                                <button onClick={() => moveTask(row.id, 'down')} className="text-gray-300 hover:text-indigo-500 p-1 transition" title="أسفل"><ArrowDown size={13}/></button>
                                                {/* Forward */}
                                                <button onClick={() => setForwardingRowId(row.id)} className="text-gray-300 hover:text-blue-500 p-1 transition" title="تحويل"><Share2 size={13}/></button>
                                                {/* Unforward */}
                                                {row.forwardedToDept && (
                                                    <button onClick={async () => await updateDoc(doc(db, "tasks", row.id), { forwardedToDept: null })} className="text-amber-400 hover:text-amber-600 p-1 transition" title="إرجاع"><ArrowLeft size={13}/></button>
                                                )}
                                                {/* Delete */}
                                                <button onClick={() => deleteRow(row.id)} className="text-gray-200 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition" title="حذف"><Trash2 size={13}/></button>
                                            </div>
                                        </td>

                                        {columns.map(col => (
                                            <td key={col.id} className="border-l border-gray-100 dark:border-gray-700 p-0 h-11">
                                                <Cell row={row} col={col} onUpdate={val => updateRow(row.id, col.id, val)} />
                                            </td>
                                        ))}
                                        <td className="p-0"/>
                                    </tr>
                                );
                            })}

                            {/* Add Row */}
                            <tr>
                                <td className="sticky right-0 bg-white dark:bg-gray-800 z-10 border-l border-gray-100 dark:border-gray-700"/>
                                <td colSpan={columns.length}>
                                    <button
                                        onClick={addRow}
                                        className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-4 py-3 w-full transition hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
                                    >
                                        <Plus size={14}/> إضافة سطر جديد
                                    </button>
                                </td>
                                <td/>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="bg-gray-50/80 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-700 px-4 py-2 flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 font-mono">
                        {processedRows.length !== total ? `${processedRows.length} / ${total} عنصر` : `${total} عنصر`}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
                        {loading
                            ? <><span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"/> جاري المزامنة...</>
                            : <><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"/> محفوظ</>
                        }
                    </span>
                </div>
            </div>
        </div>
    );
}