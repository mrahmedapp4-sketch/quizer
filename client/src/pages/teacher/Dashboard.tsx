import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useTeacherActions } from "@/hooks/use-teacher";
import { useStudentsList } from "@/hooks/use-students";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { BigButton } from "@/components/BigButton";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, Beaker, Microscope, Atom, Plus, Copy, LogOut, Trophy, Users, RefreshCw, Play, Pause, Trash2, CheckCircle, Image as ImageIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Student } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function TeacherDashboard() {
  const { socket, onMessage } = useSocket();
  const { setAnswer, toggleAccepting, reset } = useTeacherActions();
  const { data: initialStudents, refetch } = useStudentsList();
  const { toast } = useToast();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [isAccepting, setIsAccepting] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [customChoices, setCustomChoices] = useState<string[] | null>(null);
  const [showAccuracy, setShowAccuracy] = useState(true);
  const [customInput, setCustomInput] = useState("");
  const [pointAdjustValue, setPointAdjustValue] = useState<string>("0");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const resultsRef = useRef<HTMLDivElement>(null);

  const resetRefresh = () => {};

  const handlePointAdjustment = async () => {
    if (selectedStudentId === null) return;
    try {
      await apiRequest("POST", `/api/students/${selectedStudentId}/points`, { points: pointAdjustValue });
      toast({ title: "تم التحديث", description: "تم تعديل النقاط بنجاح" });
      setPointAdjustValue("0");
      setSelectedStudentId(null);
    } catch (err) {
      toast({ title: "خطأ", description: "فشل تعديل النقاط", variant: "destructive" });
    }
  };

  const copyResults = () => {
    const text = students
      .sort((a, b) => b.score - a.score)
      .map((s, idx) => {
        const acc = s.totalAnswers > 0
          ? Math.round((s.correctAnswersCount / s.totalAnswers) * 100) + "%"
          : "-";
        return `${idx + 1}. ${s.name} | ${s.score} pts | دقة: ${acc}`;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ!",
      description: "تم نسخ نتائج الطلاب بنجاح",
    });
  };

  const copyResultsImage = async () => {
    if (!resultsRef.current) return;
    try {
      const canvas = await (window as any).html2canvas?.(resultsRef.current, {
        backgroundColor: "#000000",
        scale: 3,
        useCORS: true,
        logging: false,
        allowTaint: true,
        imageTimeout: 10000,
      });
      if (canvas) {
        canvas.toBlob((blob: Blob) => {
          navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          toast({
            title: "تم نسخ الصورة!",
            description: "تم نسخ صورة النتائج بجودة عالية - الصقها في أي مكان",
          });
        }, "image/png");
      }
    } catch (e) {
      toast({
        title: "تحذير",
        description: "قم بحفظ الصورة بدلاً من النسخ (استخدم Print/Save PDF)",
        variant: "destructive",
      });
    }
  };

  const [showEndReport, setShowEndReport] = useState(false);

  const endSession = async () => {
    // Show report first
    setShowEndReport(true);
  };

  const confirmEndSession = async () => {
    resetRefresh();
    // Clear all answers first to reset state
    await apiRequest("POST", "/api/teacher/reset");
    toast({
      title: "تم إنهاء الحصة",
      description: "تم إنهاء الحصة مع الاحتفاظ بحسابات الطلاب ونقاطهم",
    });
    setShowEndReport(false);
    refetch();
  };

  // Fetch initial photos
  useEffect(() => {
    fetch("/api/photos")
      .then((r) => r.json())
      .then((data) => setPhotos(data))
      .catch(() => {});
  }, []);

  // Sync initial data
  useEffect(() => {
    if (initialStudents) {
      setStudents(initialStudents);
    }
  }, [initialStudents]);

  // WebSocket listeners
  useEffect(() => {
    onMessage("STUDENTS_UPDATE", (updatedStudents) => {
      setStudents(updatedStudents);
    });

    onMessage("STATE_UPDATE", (state) => {
      setIsAccepting(state.isAcceptingAnswers);
      setCorrectAnswer(state.correctAnswer);
      setCustomChoices(state.customChoices);
      if (typeof state.showAccuracy === "boolean") setShowAccuracy(state.showAccuracy);
    });

    onMessage("PHOTO_ADDED", (payload: any) => {
      if (payload && payload.studentId && payload.photo) {
        setPhotos((prev) => ({ ...prev, [payload.studentId]: payload.photo }));
      }
    });
  }, [onMessage]);

  const handleSetCustomChoices = () => {
    const choices = customInput.split(",").map(c => c.trim()).filter(c => c.length > 0);
    if (choices.length < 2) {
      toast({ title: "خطأ", description: "يرجى إدخال خيارين على الأقل مفصولين بفاصلة", variant: "destructive" });
      return;
    }
    apiRequest("POST", "/api/teacher/answer", { answer: null, customChoices: choices });
    setCustomInput("");
  };

  const currentChoices = customChoices || ["A", "B", "C", "D"];

  return (
    <div className="min-h-screen p-4 md:p-8 relative">
      <AnimatedBackground />
      
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Control Panel */}
        <header className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/10 flex flex-col md:flex-row gap-6 items-center justify-between sticky top-4 z-50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <FlaskConical className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Chemistry Lab: Mr. Ahmed</h1>
              <div className="flex items-center gap-4 text-sm font-medium">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className={cn("w-2 h-2 rounded-full", isAccepting ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                  {isAccepting ? "LIVE: Accepting Answers" : "PAUSED: Submissions Closed"}
                </div>
                {students.length > 0 && students.every(s => s.lastAnswer) && (
                  <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-lg border border-green-500/50 text-green-400 font-bold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    ALL ANSWERED ✓
                  </div>
                )}
              </div>
            </div>
          </div>

            <div className="flex flex-col items-stretch gap-3">
              {/* السؤال التالي — صف ثابت دايماً في نفس المكان */}
              <button
                onClick={() => {
                  apiRequest("POST", "/api/teacher/reset")
                    .then(() => {
                      refetch();
                    });
                }}
                className="px-9 py-[18px] rounded-xl font-bold text-lg bg-blue-100 text-blue-700 hover:bg-blue-200 border-b-4 border-blue-200 flex items-center justify-center gap-2 transition-all shadow-md active:translate-y-0.5 w-full"
              >
                <RefreshCw className="w-6 h-6" />
                السؤال التالي
              </button>

              {/* باقي الأزرار الثانوية */}
              <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={copyResults}
                className="px-6 py-3 rounded-xl font-bold bg-zinc-900 text-white hover:bg-zinc-800 border-b-4 border-zinc-950 flex items-center gap-2 transition-all shadow-md active:translate-y-0.5"
              >
                <Copy className="w-5 h-5" />
                نسخ النتائج
              </button>
              <button
                onClick={() => toggleAccepting.mutate(!isAccepting)}
                disabled={toggleAccepting.isPending}
                className={cn(
                  "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:translate-y-0.5",
                  isAccepting 
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border-b-4 border-amber-200" 
                    : "bg-green-100 text-green-700 hover:bg-green-200 border-b-4 border-green-200"
                )}
              >
                {isAccepting ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isAccepting ? "Start Quiz" : "Stop Quiz"}
              </button>
              <button
                onClick={() => {
                  if(confirm("هل أنت متأكد؟ سيتم حذف جميع النقاط لكل الطلاب.")) reset.mutate();
                }}
                disabled={reset.isPending}
                className="px-6 py-3 rounded-xl font-bold bg-white text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all border-2 border-transparent hover:border-red-100 flex items-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                تصفير كل النقاط
              </button>
              <button
                onClick={() => {
                  if(confirm("هل أنت متأكد من إخفاء جميع الطلاب؟ ستظل حساباتهم ونقاطهم محفوظة في قاعدة البيانات.")) {
                    apiRequest("DELETE", "/api/students")
                      .then(() => refetch());
                  }
                }}
                className="px-6 py-3 rounded-xl font-bold bg-red-100 text-red-700 hover:bg-red-200 border-b-4 border-red-200 flex items-center gap-2 transition-all shadow-md active:translate-y-0.5"
              >
                <Trash2 className="w-5 h-5" />
                إخفاء كل الطلاب
              </button>
              </div>

            <Dialog>
              <DialogTrigger asChild>
                <button className="px-6 py-3 rounded-xl font-bold bg-zinc-900 text-white hover:bg-zinc-800 border-b-4 border-zinc-950 flex items-center gap-2 transition-all shadow-md active:translate-y-0.5">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  تقرير النتائج
                </button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-3xl w-[95vw] rounded-[2rem] p-0 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)]">
                {/* Printable / screenshot area */}
                <div ref={resultsRef} className="bg-[#0a0a0f]">
                  {/* Header */}
                  <div className="relative overflow-hidden px-8 pt-8 pb-4 text-center">
                    <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 via-primary/5 to-transparent pointer-events-none" />
                    <div className="relative">
                      <div className="flex items-center justify-center gap-3 mb-1">
                        <Trophy className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]" />
                        <h2 className="text-3xl font-black text-white tracking-tight">لوحة الشرف</h2>
                        <Trophy className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]" />
                      </div>
                      <p className="text-zinc-500 text-sm font-medium">مختبر الكيمياء — مستر أحمد</p>
                    </div>
                  </div>

                  {students.length === 0 ? (
                    <div className="py-16 text-center text-zinc-600 italic">لا يوجد طلاب حالياً</div>
                  ) : (() => {
                    const sorted = [...students].sort((a, b) => b.score - a.score);
                    const top3 = sorted.slice(0, 3);
                    const rest = sorted.slice(3);
                    const podiumOrder = top3.length === 1 ? [top3[0]] :
                                       top3.length === 2 ? [top3[1], top3[0]] :
                                       [top3[1], top3[0], top3[2]];
                    const podiumConfig = top3.length === 1
                      ? [{ rank: 1, height: "h-28", label: "🥇", color: "from-yellow-400 to-yellow-600", ring: "ring-yellow-400", glow: "shadow-[0_0_30px_rgba(234,179,8,0.5)]", textColor: "text-yellow-400", barBg: "bg-yellow-400" }]
                      : top3.length === 2
                      ? [
                          { rank: 2, height: "h-20", label: "🥈", color: "from-zinc-300 to-zinc-500", ring: "ring-zinc-400", glow: "", textColor: "text-zinc-300", barBg: "bg-zinc-400" },
                          { rank: 1, height: "h-28", label: "🥇", color: "from-yellow-400 to-yellow-600", ring: "ring-yellow-400", glow: "shadow-[0_0_30px_rgba(234,179,8,0.5)]", textColor: "text-yellow-400", barBg: "bg-yellow-400" },
                        ]
                      : [
                          { rank: 2, height: "h-20", label: "🥈", color: "from-zinc-300 to-zinc-500", ring: "ring-zinc-400", glow: "", textColor: "text-zinc-300", barBg: "bg-zinc-400" },
                          { rank: 1, height: "h-28", label: "🥇", color: "from-yellow-400 to-yellow-600", ring: "ring-yellow-400", glow: "shadow-[0_0_30px_rgba(234,179,8,0.5)]", textColor: "text-yellow-400", barBg: "bg-yellow-400" },
                          { rank: 3, height: "h-14", label: "🥉", color: "from-orange-400 to-orange-600", ring: "ring-orange-400", glow: "", textColor: "text-orange-400", barBg: "bg-orange-400" },
                        ];

                    return (
                      <div dir="rtl">
                        {/* Podium */}
                        <div className="flex items-end justify-center gap-4 px-8 pt-4 pb-0">
                          {podiumOrder.map((student, i) => {
                            const cfg = podiumConfig[i];
                            const acc = student.totalAnswers > 0
                              ? Math.round((student.correctAnswersCount / student.totalAnswers) * 100)
                              : null;
                            return (
                              <motion.div
                                key={student.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.12, type: "spring", stiffness: 200, damping: 20 }}
                                className="flex flex-col items-center flex-1 max-w-[160px]"
                              >
                                {/* Medal emoji */}
                                <span className="text-2xl mb-1">{cfg.label}</span>
                                {/* Photo */}
                                <div className={cn(
                                  "w-16 h-16 rounded-full overflow-hidden ring-2 mb-2 bg-zinc-800",
                                  cfg.ring,
                                  cfg.glow
                                )}>
                                  {photos[student.id] ? (
                                    <img src={photos[student.id]} alt={student.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className={cn("w-full h-full flex items-center justify-center bg-gradient-to-br text-white font-black text-xl", cfg.color)}>
                                      {student.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                {/* Name */}
                                <span className="font-bold text-white text-center text-sm leading-tight mb-1 line-clamp-2 w-full text-center">{student.name}</span>
                                {/* Score */}
                                <span className={cn("text-2xl font-black mb-1", cfg.textColor)}>{student.score}</span>
                                <span className="text-[10px] text-zinc-500 uppercase mb-2">نقطة</span>
                                {showAccuracy && acc !== null && (
                                  <span className={cn(
                                    "text-[11px] font-bold px-2 py-0.5 rounded-full mb-2",
                                    acc >= 80 ? "bg-green-500/20 text-green-400" : acc >= 50 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
                                  )}>{acc}%</span>
                                )}
                                {/* Podium bar */}
                                <div className={cn("w-full rounded-t-xl opacity-30", cfg.barBg, cfg.height)} />
                              </motion.div>
                            );
                          })}
                        </div>

                        {/* Rest of students */}
                        {rest.length > 0 && (
                          <div className="px-6 pt-4 pb-2 space-y-2 max-h-[280px] overflow-y-auto">
                            {rest.map((student, i) => {
                              const rank = i + 4;
                              const acc = student.totalAnswers > 0
                                ? Math.round((student.correctAnswersCount / student.totalAnswers) * 100)
                                : null;
                              return (
                                <motion.div
                                  key={student.id}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.35 + i * 0.04 }}
                                  className="flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-2xl px-4 py-3 border border-white/5 transition-colors"
                                >
                                  <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60 shrink-0">
                                    {rank}
                                  </span>
                                  <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-700 shrink-0">
                                    {photos[student.id] ? (
                                      <img src={photos[student.id]} alt={student.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm bg-primary/30">
                                        {student.name.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                  <span className="flex-1 font-bold text-white truncate">{student.name}</span>
                                  {showAccuracy && acc !== null && (
                                    <span className={cn(
                                      "text-xs font-bold px-2 py-0.5 rounded-full shrink-0",
                                      acc >= 80 ? "bg-green-500/20 text-green-400" : acc >= 50 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
                                    )}>{acc}%</span>
                                  )}
                                  <span className="font-black text-primary text-lg shrink-0">{student.score}</span>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Action bar */}
                <div className="p-5 bg-black/60 border-t border-white/5 flex gap-3">
                  <button
                    onClick={copyResultsImage}
                    className="flex-1 py-3 rounded-2xl font-bold bg-yellow-400 text-black flex items-center justify-center gap-2 hover:bg-yellow-300 transition-all active:scale-95 text-sm"
                  >
                    <ImageIcon className="w-4 h-4" />
                    نسخ كصورة
                  </button>
                  <button
                    onClick={copyResults}
                    className="flex-1 py-3 rounded-2xl font-bold bg-white/10 text-white border border-white/10 flex items-center justify-center gap-2 hover:bg-white/15 transition-all active:scale-95 text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    نسخ نصاً
                  </button>
                  <Button
                    variant="outline"
                    className="flex-1 py-5 rounded-2xl font-bold border-white/10 text-white hover:bg-white/5 text-sm"
                    onClick={() => window.print()}
                  >
                    طباعة PDF
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <AlertDialog open={showEndReport} onOpenChange={setShowEndReport}>
              <AlertDialogTrigger asChild>
                <button className="px-6 py-3 rounded-xl font-bold bg-zinc-900 text-white hover:bg-zinc-800 border-b-4 border-zinc-950 flex items-center gap-2 transition-all shadow-md active:translate-y-0.5">
                  <LogOut className="w-5 h-5" />
                  إنهاء الحصة
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-zinc-950 border-white/10 text-white rounded-3xl max-w-lg p-0 overflow-hidden">
                <div className="relative px-6 pt-6 pb-4 text-center border-b border-white/5">
                  <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none" />
                  <AlertDialogTitle className="relative text-xl font-black text-white flex items-center justify-center gap-2">
                    <LogOut className="w-5 h-5 text-red-400" />
                    إنهاء الحصة
                  </AlertDialogTitle>
                  <AlertDialogDescription className="relative text-zinc-500 text-sm mt-1">
                     راجع النتائج قبل الإنهاء — الحسابات والنقاط ستظل محفوظة
                  </AlertDialogDescription>
                </div>

                <div className="px-5 py-4 max-h-[320px] overflow-y-auto space-y-2" dir="rtl">
                  {students.length > 0 ? (
                    [...students]
                      .sort((a, b) => b.score - a.score)
                      .map((s, idx) => {
                        const medals = ["🥇","🥈","🥉"];
                        const acc = s.totalAnswers > 0 ? Math.round((s.correctAnswersCount / s.totalAnswers) * 100) : null;
                        return (
                          <div key={s.id} className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-2xl border",
                            idx === 0 ? "bg-yellow-400/10 border-yellow-400/30" :
                            idx === 1 ? "bg-zinc-400/10 border-zinc-400/20" :
                            idx === 2 ? "bg-orange-400/10 border-orange-400/20" :
                            "bg-white/5 border-white/5"
                          )}>
                            <span className="text-lg w-6 text-center shrink-0">{medals[idx] ?? idx + 1}</span>
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-700 shrink-0">
                              {photos[s.id] ? (
                                <img src={photos[s.id]} alt={s.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs bg-primary/30">
                                  {s.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className="flex-1 font-bold text-white truncate">{s.name}</span>
                            {showAccuracy && acc !== null && (
                              <span className={cn(
                                "text-xs font-bold px-2 py-0.5 rounded-full",
                                acc >= 80 ? "bg-green-500/20 text-green-400" : acc >= 50 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
                              )}>{acc}%</span>
                            )}
                            <span className={cn(
                              "font-black text-base shrink-0",
                              idx === 0 ? "text-yellow-400" : idx === 1 ? "text-zinc-300" : idx === 2 ? "text-orange-400" : "text-primary"
                            )}>{s.score}</span>
                          </div>
                        );
                      })
                  ) : (
                    <p className="text-center text-zinc-600 italic py-6">لا يوجد طلاب</p>
                  )}
                </div>

                <div className="px-5 pb-2">
                  <Button onClick={copyResults} className="w-full bg-zinc-800 hover:bg-zinc-700 rounded-2xl h-11 font-bold">
                    <Copy className="w-4 h-4 mr-2" />
                    نسخ النتائج
                  </Button>
                </div>

                <AlertDialogFooter className="gap-2 px-5 pb-5 pt-2 flex flex-row">
                  <AlertDialogCancel className="flex-1 bg-zinc-800 border-white/5 hover:bg-zinc-700 text-white rounded-2xl h-11">إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmEndSession}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold h-11"
                  >
                     تأكيد الإنهاء وحفظ النقاط
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Answer Key Section */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 shadow-lg border border-white/10">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                <CheckCircle className="w-5 h-5 text-primary" />
                Set Correct Answer
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {currentChoices.map((opt) => (
                  <BigButton
                    key={opt}
                    label={opt}
                    variant={correctAnswer === opt ? "success" : "outline"}
                    className={cn(
                      "h-24 text-2xl transition-all",
                      correctAnswer === opt && "ring-4 ring-green-200 ring-offset-2"
                    )}
                    onClick={() => apiRequest("POST", "/api/teacher/answer", { answer: opt, customChoices })}
                  />
                ))}
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-sm font-bold text-white mb-2">خيارات مخصصة (مثال: نعم,لا)</h3>
                <div className="flex gap-2">
                  <Input 
                    placeholder="فصل الخيارات بفاصلة..." 
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Button onClick={handleSetCustomChoices}>تحديث</Button>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10">
              <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
                <Microscope className="w-5 h-5" />
                Lab Stats
              </h3>
              <div className="space-y-2 text-sm font-medium text-foreground/80">
                <div className="flex justify-between">
                  <span className="text-white">Total Students</span>
                  <span className="font-bold text-white">{students.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white">Responses</span>
                  <span className="font-bold text-white">
                    {students.filter(s => s.lastAnswer).length} / {students.length}
                  </span>
                </div>
                <div className="pt-3 border-t border-white/10">
                  <button
                    onClick={() => apiRequest("POST", "/api/teacher/toggle-accuracy", { show: !showAccuracy })}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all border-2",
                      showAccuracy
                        ? "bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30"
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                    )}
                  >
                    <span>إظهار الدقة % للطلاب</span>
                    <span className={cn(
                      "w-10 h-5 rounded-full relative transition-all",
                      showAccuracy ? "bg-green-500" : "bg-white/20"
                    )}>
                      <span className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                        showAccuracy ? "right-0.5" : "left-0.5"
                      )} />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Students Grid */}
          <div className="lg:col-span-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 min-h-[500px] border border-white/10">
              <h2 className="text-xl font-bold mb-6 text-white text-right">قائمة الطلاب والنتائج</h2>
              
              <div className="overflow-x-auto mb-8">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="p-3 text-gray-400">اسم الطالب</th>
                      <th className="p-3 text-gray-400">الحالة</th>
                      <th className="p-3 text-gray-400">النتيجة</th>
                      {showAccuracy && <th className="p-3 text-gray-400 text-center">الدقة</th>}
                      <th className="p-3 text-gray-400 text-center">النقاط</th>
                      <th className="p-3 text-gray-400 text-center">إخفاء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const acc = student.totalAnswers > 0
                        ? Math.round((student.correctAnswersCount / student.totalAnswers) * 100)
                        : null;
                      return (
                      <tr key={student.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-3 font-bold text-white">{student.name}</td>
                        <td className="p-3">
                          {student.lastAnswer ? (
                            <div className="flex flex-col">
                              <span className="text-blue-400 font-medium">تمت الإجابة ({student.lastAnswer})</span>
                              {student.responseTime && (
                                <span className="text-[12px] text-yellow-400 font-mono bg-yellow-400/10 px-1 rounded">Time: {student.responseTime}s</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">في الانتظار</span>
                          )}
                        </td>
                        <td className="p-3">
                          {student.isCorrect === true && <span className="text-green-400 font-bold">✓ صح</span>}
                          {student.isCorrect === false && <span className="text-red-400 font-bold">✗ خطأ</span>}
                          {student.isCorrect === null && student.lastAnswer && <span className="text-amber-400 font-medium">قيد الانتظار</span>}
                          {!student.lastAnswer && <span className="text-gray-300">-</span>}
                        </td>
                        {showAccuracy && (
                          <td className="p-3 text-center font-bold">
                            {acc !== null ? (
                              <span className={acc >= 80 ? "text-green-400" : acc >= 50 ? "text-yellow-400" : "text-red-400"}>
                                {acc}%
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        )}
                        <td className="p-3 text-center font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => {
                          setSelectedStudentId(student.id);
                          setPointAdjustValue("0");
                        }}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentId(student.id);
                                setPointAdjustValue("1");
                              }}
                              className="p-1 text-primary hover:bg-primary/10 rounded-full transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <span 
                              className="cursor-pointer hover:underline underline-offset-4 text-primary"
                              onClick={() => {
                                setSelectedStudentId(student.id);
                                setPointAdjustValue("0");
                              }}
                            >
                              {student.score}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              if(confirm(`هل أنت متأكد من إخفاء الطالب ${student.name}؟ سيظل حسابه ونقاطه محفوظين.`)) {
                                apiRequest("DELETE", `/api/students/${student.id}`)
                                  .then(() => refetch());
                              }
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="إخفاء الطالب مع الاحتفاظ ببياناته"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-bold mb-4 text-white">لوحة الصور</h3>
              {students.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Users className="w-16 h-16 mb-4 opacity-20" />
                  <p>Waiting for students to join...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  <AnimatePresence>
                    {students.map((student) => (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={cn(
                          "relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2 shadow-sm bg-white/5 border-white/10",
                          student.lastAnswer 
                            ? student.isCorrect === true
                              ? "border-green-400 bg-green-500/10 shadow-green-500/20" 
                              : student.isCorrect === false
                                ? "border-red-400 bg-red-500/10 shadow-red-500/20"
                                : "border-amber-400 bg-amber-500/10 shadow-amber-500/20"
                            : "border-transparent hover:border-white/20"
                        )}
                      >
                        <div className="w-14 h-14 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-lg text-primary mb-1 border-2 border-white/10">
                          {photos[student.id] ? (
                            <img src={photos[student.id]} alt={student.name} className="w-full h-full object-cover" />
                          ) : (
                            <Atom className="w-6 h-6" />
                          )}
                        </div>
                        <div className="font-bold truncate w-full text-white" title={student.name}>
                          {student.name}
                        </div>
                        <div className="text-sm font-mono bg-white/10 text-white px-2 py-1 rounded-md w-full">
                          Score: {student.score}
                        </div>
                        
                        {/* Status Badge */}
                        {student.lastAnswer && (
                          <div className={cn(
                            "absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-sm border-2 border-white",
                            student.isCorrect === true ? "bg-green-500" : 
                            student.isCorrect === false ? "bg-red-500" : "bg-amber-400"
                          )}>
                            {student.lastAnswer}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </main>
        
        <Dialog open={selectedStudentId !== null} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
          <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center text-white">تعديل النقاط للطالب</DialogTitle>
              <DialogDescription className="text-center text-gray-400">
                {students.find(s => s.id === selectedStudentId)?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  value={pointAdjustValue} 
                  onChange={(e) => setPointAdjustValue(e.target.value)}
                  className="bg-white/5 border-white/10 text-white text-center text-xl h-14 rounded-xl"
                  placeholder="عدد النقاط"
                />
              </div>
              <p className="text-xs text-center text-gray-500">استخدم أرقام سالبة للخصم (مثال: -5)</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                variant="outline" 
                onClick={() => setSelectedStudentId(null)}
                className="rounded-xl border-white/10 hover:bg-white/5 text-white h-12"
              >
                إلغاء
              </Button>
              <Button 
                onClick={handlePointAdjustment}
                className="rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-bold h-12"
              >
                تأكيد التعديل
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
