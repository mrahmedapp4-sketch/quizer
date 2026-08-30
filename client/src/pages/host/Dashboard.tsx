import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useStudentsList } from "@/hooks/use-students";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, ShieldCheck, LogIn, Trash2, ChevronRight, Mail, Copy, Check } from "lucide-react";
import { Student } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface Counters {
  joinCount: number;
  deleteAllCount: number;
  nextQuestionCount: number;
}

function AnimatedCounter({ value }: { value: number }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -12, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="inline-block tabular-nums"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

export default function HostDashboard() {
  const { onMessage } = useSocket();
  const { data: initialStudents } = useStudentsList();
  const [, setLocation] = useLocation();

  const [students, setStudents] = useState<Student[]>([]);
  const [isAccepting, setIsAccepting] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [counters, setCounters] = useState<Counters>({
    joinCount: 0,
    deleteAllCount: 0,
    nextQuestionCount: 0,
  });

  useEffect(() => {
    if (sessionStorage.getItem("host_auth") !== "true") {
      setLocation("/host/login");
    }
  }, [setLocation]);

  useEffect(() => {
    if (initialStudents) {
      setStudents(initialStudents);
    }
  }, [initialStudents]);

  useEffect(() => {
    onMessage("STUDENTS_UPDATE", (updatedStudents) => {
      setStudents(updatedStudents);
    });

    onMessage("STATE_UPDATE", (state) => {
      setIsAccepting(state.isAcceptingAnswers);
      setCorrectAnswer(state.correctAnswer);
    });

    onMessage("COUNTERS_UPDATE", (data) => {
      setCounters(data as unknown as Counters);
    });
  }, [onMessage]);

  const [allSavedEmails, setAllSavedEmails] = useState<{ email: string; name: string; firstSeen: string }[]>([]);

  useEffect(() => {
    const fetchEmails = () => {
      fetch("/api/emails")
        .then(r => r.json())
        .then(data => setAllSavedEmails(Array.isArray(data) ? data : []))
        .catch(() => {});
    };
    fetchEmails();
    const interval = setInterval(fetchEmails, 10000);
    return () => clearInterval(interval);
  }, []);

  // Merge saved emails with current session emails (avoid duplicates)
  const sessionEmails = students.filter(s => s.email).map(s => s.email as string);
  const allEmailsList = Array.from(
    new Map<string, { email: string; name: string; firstSeen: string }>([
      ...allSavedEmails.map(e => [e.email.toLowerCase(), e] as [string, { email: string; name: string; firstSeen: string }]),
      ...sessionEmails.map(e => [e.toLowerCase(), { email: e, name: "", firstSeen: "" }] as [string, { email: string; name: string; firstSeen: string }]),
    ]).values()
  );

  const copyAllEmails = () => {
    navigator.clipboard.writeText(allEmailsList.map(e => e.email).join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const copyOneEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const counterCards = [
    {
      label: "تسجيلات الدخول",
      sublabel: "طالب انضم للجلسة",
      value: counters.joinCount,
      icon: LogIn,
      color: "blue",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      text: "text-blue-400",
      iconBg: "bg-blue-500/20",
    },
    {
      label: "إخفاء كل الطلاب",
      sublabel: "مرة ضغط المدرس",
      value: counters.deleteAllCount,
      icon: Trash2,
      color: "red",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      text: "text-red-400",
      iconBg: "bg-red-500/20",
    },
    {
      label: "السؤال التالي",
      sublabel: "مرة انتقل للسؤال التالي",
      value: counters.nextQuestionCount,
      icon: ChevronRight,
      color: "emerald",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      text: "text-emerald-400",
      iconBg: "bg-emerald-500/20",
    },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 relative">
      <AnimatedBackground />

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/10 flex flex-col md:flex-row gap-6 items-center justify-between sticky top-4 z-50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Host Dashboard (View Only)</h1>
              <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                <span className={cn("w-2 h-2 rounded-full", isAccepting ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                {isAccepting ? "LIVE: Accepting Answers" : "PAUSED: Submissions Closed"}
              </div>
            </div>
          </div>
          <div className="px-6 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
            مرحباً بك في وضع المراقبة
          </div>
        </header>

        {/* Session Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {counterCards.map((card) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.label}
                layout
                className={cn(
                  "rounded-3xl p-6 border backdrop-blur-md shadow-lg flex items-center gap-5",
                  card.bg,
                  card.border
                )}
              >
                <div className={cn("p-3 rounded-2xl flex-shrink-0", card.iconBg)}>
                  <Icon className={cn("w-7 h-7", card.text)} />
                </div>
                <div className="text-right flex-1" dir="rtl">
                  <div className={cn("text-4xl font-black tracking-tight", card.text)}>
                    <AnimatedCounter value={card.value} />
                  </div>
                  <div className="text-white font-bold text-sm mt-0.5">{card.label}</div>
                  <div className="text-gray-500 text-xs">{card.sublabel}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Registered Emails Panel */}
        <div className="bg-zinc-900/80 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Mail className="w-5 h-5 text-purple-400" />
              الإيميلات المحفوظة
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({allEmailsList.length} إيميل — محفوظة دايماً)
              </span>
            </div>
            {allEmailsList.length > 0 && (
              <button
                onClick={copyAllEmails}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors text-sm font-bold"
              >
                {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedAll ? "تم النسخ!" : "نسخ الكل"}
              </button>
            )}
          </div>
          {allEmailsList.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">لا يوجد إيميلات محفوظة حتى الآن</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allEmailsList.map((entry) => (
                <button
                  key={entry.email}
                  onClick={() => copyOneEmail(entry.email)}
                  title={entry.firstSeen ? `انضم: ${new Date(entry.firstSeen).toLocaleDateString("ar-EG")}` : "انقر للنسخ"}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-purple-500/10 hover:border-purple-500/20 hover:text-purple-300 transition-all text-sm font-mono"
                >
                  {copiedEmail === entry.email ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 opacity-50" />}
                  {entry.email}
                </button>
              ))}
            </div>
          )}
        </div>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-zinc-900/80 backdrop-blur-md rounded-3xl p-6 shadow-lg border border-white/10">
              <h2 className="text-xl font-bold mb-4 text-white">Current Answer Key</h2>
              <div className="text-4xl font-bold text-center p-8 bg-white/5 rounded-2xl border border-white/10 text-primary">
                {correctAnswer || "Not Set"}
              </div>
            </div>

            <div className="bg-blue-500/5 rounded-3xl p-6 border border-blue-500/10">
              <h3 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Quick Stats
              </h3>
              <div className="space-y-2 text-sm font-medium text-gray-400">
                <div className="flex justify-between">
                  <span>Total Students</span>
                  <span className="font-bold text-white">{students.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Responses</span>
                  <span className="font-bold text-white">
                    {students.filter(s => s.lastAnswer).length} / {students.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-3xl p-6 min-h-[500px] border border-white/10">
              <h2 className="text-xl font-bold mb-6 text-white text-right">قائمة الطلاب والنتائج (عرض فقط)</h2>
              <div className="overflow-x-auto mb-8">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="p-3 text-gray-400">اسم الطالب</th>
                      <th className="p-3 text-gray-400 hidden sm:table-cell">الإيميل</th>
                      <th className="p-3 text-gray-400">الحالة</th>
                      <th className="p-3 text-gray-400">النتيجة</th>
                      <th className="p-3 text-gray-400 text-center">النقاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-3 font-bold text-white max-w-[120px] sm:max-w-[180px]">
                          <span className="block truncate" title={student.name}>{student.name}</span>
                        </td>
                        <td className="p-3 text-gray-400 text-xs hidden sm:table-cell max-w-[160px]">
                          <span className="block truncate font-mono" title={student.email || ""}>{student.email || "—"}</span>
                        </td>
                        <td className="p-3 text-gray-300">
                          {student.lastAnswer ? `تمت الإجابة (${student.lastAnswer})` : "في الانتظار"}
                        </td>
                        <td className="p-3 font-bold">
                          {student.isCorrect === true && <span className="text-green-500">✓ صح</span>}
                          {student.isCorrect === false && <span className="text-red-500">✗ خطأ</span>}
                          {student.isCorrect === null && student.lastAnswer && <span className="text-amber-500">قيد الانتظار</span>}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-blue-400">{student.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
