import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, HelpCircle, Inbox, Calendar, LayoutGrid, 
    Filter, FileText, Send, User, PenTool, 
    CheckCircle2, Clock, Share2, Copy, MessageCircle 
} from 'lucide-react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                                    <HelpCircle size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-gray-800 dark:text-white">دليل استخدام المنصة</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">شرح شامل لكل الأقسام والمميزات</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
                            
                            {/* 1. القائمة الجانبية والمهام */}
                            <section className="space-y-4">
                                <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                    <LayoutGrid size={20} />
                                    أقسام القائمة الرئيسية (تظهر داخل كل قسم)
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                                        <div className="flex items-center gap-2 mb-2 font-bold text-blue-700 dark:text-blue-300">
                                            <Inbox size={18} /> الوارد
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                            يحتوي على المهام التي تم تحويلها إليك من أقسام أخرى. أي مهمة يرسلها قسم آخر لقسمك ستظهر هنا.
                                        </p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-800">
                                        <div className="flex items-center gap-2 mb-2 font-bold text-green-700 dark:text-green-300">
                                            <Calendar size={18} /> اليوم
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                            يعرض المهام التي قمت بإضافتها لنفسك أو لقسمك وموعد تسليمها هو <strong>اليوم</strong>.
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-800">
                                        <div className="flex items-center gap-2 mb-2 font-bold text-purple-700 dark:text-purple-300">
                                            <Clock size={18} /> قريباً
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                            المهام المستقبلية التي قمت بإضافتها وموعدها في الأيام القادمة.
                                        </p>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-800">
                                        <div className="flex items-center gap-2 mb-2 font-bold text-orange-700 dark:text-orange-300">
                                            <Filter size={18} /> الأقسام الداخلية
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                            يمكنك تنظيم مهام قسمك بإنشاء <strong>أقسام داخلية</strong> (مثل: بوستات، ريلز، تقارير).
                                            <br/>
                                            <span className="text-xs bg-orange-200 dark:bg-orange-800 px-1.5 rounded text-orange-800 dark:text-orange-100 font-bold">ملاحظة هامة:</span> الأقسام الداخلية خاصة بقسمك فقط ولا تظهر للأقسام الأخرى. لإنشاء قسم جديد، فقط اكتب اسمه في خانة "القسم الداخلي" عند إضافة المهمة.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <hr className="border-gray-100 dark:border-gray-800" />

                            {/* 2. إضافة المهام والنسخ */}
                            <section className="space-y-4">
                                <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                                    <CheckCircle2 size={20} />
                                    إدارة المهام والنسخ
                                </h3>
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                                        <li className="flex items-start gap-3">
                                            <User className="shrink-0 text-gray-400 mt-0.5" size={16} />
                                            <span>
                                                <strong>إضافة مهمة:</strong> يمكنك إضافة مهمة لنفسك أو توجيهها لقسم آخر. تظهر المهمة في القسم المحدد.
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <Copy className="shrink-0 text-gray-400 mt-0.5" size={16} />
                                            <span>
                                                <strong>نسخ المهام:</strong> يمكنك نسخ نص المهمة بسهولة لمشاركته عبر واتساب أو أي منصة أخرى.
                                            </span>
                                        </li>
                                    </ul>
                                </div>
                            </section>

                            <hr className="border-gray-100 dark:border-gray-800" />

                            {/* 3. التقارير والإدارة العامة */}
                            <section className="space-y-4">
                                <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                    <FileText size={20} />
                                    التقارير والإدارة العامة
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                                        <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2">التقارير</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            قسم خاص لعرض إحصائيات الأداء، عدد المهام المنجزة، والمتأخرة لكل قسم وعضو.
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-200 mb-2">الإدارة العامة</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            شيت الإدارة العامة يحتوي على ملفات تنظيمية، لوائح، وقرارات إدارية تهم جميع الأعضاء.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <hr className="border-gray-100 dark:border-gray-800" />

                            {/* 4. الشيت التعليمي والمحادثات */}
                            <section className="space-y-4">
                                <h3 className="text-lg font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                                    <MessageCircle size={20} />
                                    التعليم والتواصل
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-800">
                                        <h4 className="font-bold text-purple-800 dark:text-purple-200 mb-2">الشيت التعليمي</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            نظام متكامل لإدارة المهام التعليمية (مشابه لشيت الإدارة العامة). يمكنك من خلاله إضافة المهام، تنظيم الجداول، ومتابعة سير العملية التعليمية بانتظام.
                                        </p>
                                    </div>
                                    <div className="bg-pink-50 dark:bg-pink-900/10 p-4 rounded-2xl border border-pink-100 dark:border-pink-800">
                                        <h4 className="font-bold text-pink-800 dark:text-pink-200 mb-2">المحادثات (Chat)</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            زر المحادثة في الأعلى يتيح لك التواصل السريع مع أعضاء الفريق أو المشرفين.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <hr className="border-gray-100 dark:border-gray-800" />

                            {/* 5. الهوية البصرية ومن أحياها */}
                            <section className="space-y-4">
                                <h3 className="text-lg font-bold text-teal-600 dark:text-teal-400 flex items-center gap-2">
                                    <PenTool size={20} />
                                    أقسام إضافية
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-teal-50 dark:bg-teal-900/10 p-4 rounded-2xl border border-teal-100 dark:border-teal-800">
                                        <h4 className="font-bold text-teal-800 dark:text-teal-200 mb-2">الهوية البصرية</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            تحتوي على اللوجو، الألوان، والخطوط الرسمية للمؤسسة لاستخدامها في التصاميم.
                                        </p>
                                    </div>
                                    <div className="bg-cyan-50 dark:bg-cyan-900/10 p-4 rounded-2xl border border-cyan-100 dark:border-cyan-800">
                                        <h4 className="font-bold text-cyan-800 dark:text-cyan-200 mb-2">ومن أحياها</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            إدارة حالات التبرع بالدم، ومتابعة المتبرعين والحالات الطارئة.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <hr className="border-gray-100 dark:border-gray-800" />

                            {/* 6. الاجتماعات والتقويم */}
                            <section className="space-y-4">
                                <h3 className="text-lg font-bold text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                                    <Calendar size={20} />
                                    الاجتماعات والتقويم
                                </h3>
                                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-2xl border border-yellow-100 dark:border-yellow-800">
                                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                                        <li><strong>إنشاء اجتماع:</strong> الزر متاح في الشريط العلوي (يظهر كأيقونة في الموبايل).</li>
                                        <li><strong>التقويم:</strong> يعرض جميع المهام والاجتماعات. عند الضغط على يوم، تظهر مهام ذلك اليوم فقط.</li>
                                        <li><strong>الأجندة:</strong> عرض قائمة بالمهام والاجتماعات القادمة مرتبة زمنياً.</li>
                                    </ul>
                                </div>
                            </section>

                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 text-center">
                            <button 
                                onClick={onClose}
                                className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-lg shadow-indigo-200 dark:shadow-none"
                            >
                                فهمت، شكراً!
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
