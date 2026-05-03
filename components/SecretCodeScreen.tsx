import React, { useState } from "react";
import { auth } from "../services/firebase";
import { signOut } from "firebase/auth";
import { ShieldCheck, LogOut } from "lucide-react";

interface SecretCodeScreenProps {
  onSuccess: (accessLevel: 'full' | 'charity_restricted') => void;
}

export default function SecretCodeScreen({ onSuccess }: SecretCodeScreenProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === "Me3oan2026") {
      // Save verification state
      localStorage.setItem("ma3wan_code_verified", "full");
      onSuccess('full');
    } else {
      setError("الكود السري غير صحيح 🚫");
      setCode("");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-indigo-950 flex items-center justify-center p-4 font-sans"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative">
        <div className="h-2 w-full bg-indigo-500 absolute top-0"></div>
        <div className="p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800">تحقق أمني إضافي</h2>
          <p className="text-gray-500 text-sm mt-2">
            يرجى إدخال كود الوصول الخاص بالفريق
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <input
                type="password"
                className="w-full text-center text-lg tracking-widest px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                placeholder="أدخل الكود هنا"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm font-bold animate-pulse">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition shadow-lg"
            >
              تحقق ودخول
            </button>
          </form>

          <button
            onClick={handleLogout}
            className="mt-6 text-sm text-gray-400 hover:text-red-500 flex items-center justify-center gap-1 mx-auto transition"
          >
            <LogOut size={14} /> تسجيل خروج
          </button>
        </div>
      </div>
    </div>
  );
}