import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useSocket } from "@/hooks/use-socket";
import { useStudentSubmit } from "@/hooks/use-students";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { BigButton } from "@/components/BigButton";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, Beaker, Atom, Microscope, Star, Check, X, Clock, Trophy, AlertCircle, RefreshCw, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { unlockAudio, playCorrect, playWrong, playStreak } from "@/lib/sounds";

export default function StudentDashboard() {
  useEffect(() => {
    // Hidden style to remove Replit badge
    const style = document.createElement('style');
    style.innerHTML = `
      iframe[src*="replit.com"], 
      .replit-badge, 
      [title="Built with Replit"] { 
        display: none !important; 
        visibility: hidden !important; 
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const [, setLocation] = useLocation();
  const { onMessage } = useSocket();
  const submit = useStudentSubmit();
  const { toast } = useToast();
  
  const [studentId, setStudentId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [customChoices, setCustomChoices] = useState<string[] | null>(null);
  const [result, setResult] = useState<{ correct: boolean; message: string; doublePoints?: boolean; newScore?: number; newSessionScore?: number } | null>(null);
  const [score, setScore] = useState(0);
  const [sessionScore, setSessionScore] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showAccuracy, setShowAccuracy] = useState(true);
  const [isRetry, setIsRetry] = useState(false);
  const [hasRetried, setHasRetried] = useState(false);
  const [questionId, setQuestionId] = useState(0);
  const isRetryRef = useRef(isRetry);
  const resultRef = useRef(result);
  const lastResultSyncKey = useRef<string | null>(null);

  const resetRefresh = () => {};
  const [teacherHasAnswer, setTeacherHasAnswer] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    isRetryRef.current = isRetry;
    resultRef.current = result;
  }, [isRetry, result]);

  useEffect(() => {
    if (isAccepting && !selectedAnswer && !result) {
      setStartTime(performance.now());
    }
  }, [isAccepting, selectedAnswer, result]);

  // Restore quickly from local storage, then verify/sync the durable account
  // from the HttpOnly cookie. This also works after a server restart.
  useEffect(() => {
    const storedId = localStorage.getItem("studentId");
    const storedName = localStorage.getItem("studentName");

    if (storedId && storedName) {
      setStudentId(storedId);
      setName(storedName);
    }

    let firstSync = true;
    const syncStudent = async () => {
      try {
        const response = await fetch("/api/student/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("not signed in");
        const student = await response.json();
        setStudentId(String(student.id));
        setName(student.name);
        setGrade(student.grade ?? null);
        setScore(student.score ?? 0);
        setSessionScore(student.sessionScore ?? 0);
        localStorage.setItem("studentId", String(student.id));
        localStorage.setItem("studentName", student.name);
      } catch {
        if (firstSync && (!storedId || !storedName)) setLocation("/student/join");
      } finally {
        firstSync = false;
      }
    };
    syncStudent();
    const syncInterval = window.setInterval(syncStudent, 2000);
    return () => window.clearInterval(syncInterval);
  }, [setLocation]);

  const logout = async () => {
    await fetch("/api/student/logout", { method: "POST", credentials: "include" }).catch(() => {});
    localStorage.removeItem("studentId");
    localStorage.removeItem("studentName");
    setLocation("/student/join");
  };

  const correctMessages = [
    "برافو عليك 👏 دماغك دي محتاجة تتأمن عليها!",
    "إجابة صح 100%… واضح إنك مذاكر مش هزار 😎",
    "عاش يا نجم 🌟 كمل كده!",
    "الله ينور عليك 👌 إجابة مظبوطة!",
    "أنت كده بتجمع درجات مش بتهزر 💪",
    "إيه العظمة دي! صح يا بطل 🏆",
    "دماغ شغالة فل الفل 🔥",
    "حلو الكلام… الإجابة زي الفل!",
    "واضح إنك مركز ومصحي بدري 😄",
    "إجابة تقيلة 👌 ربنا يزيدك",
    "إنت كده داخل المنافسة بقوة 💥",
    "مظبوط يا معلم 👨‍🏫",
    "كده انت فهمان مش حافظ بس 👌",
    "الإجابة صح… وده مش صدفة 😉",
    "عاش التفكير 👏",
    "مستوى عالي النهارده 😎",
    "إيه التركيز ده!",
    "كده أنا أفرح بيك بقى 😄",
    "صح صح صح ✔️",
    "لو كل الإجابات كده… هتخلص المنهج بدري 😁",
    "الله عليك يا وحش 😎",
    "أيوه كده… ده الكلام الكبير!",
    "ده أنت طلعت تقيل أوي 💪",
    "إيه الثبات الانفعالي ده 👏",
    "عاش… كده اللعب على المكشوف!",
    "ده أنت جاي تلعب كبير بقى 🎬",
    "يا سلام على العظمة!",
    "كده انت بتقول أنا هنا أهو 😏",
    "ده شغل عالي أوي",
    "حلو أوي… أنا بحب الثقة دي",
    "ده أنت فاجئتني بصراحة 😄",
    "ياااه… ده انت فاهم اللعبة صح",
    "إحنا كده هنكسب البطولة 🏆",
    "تقفل ملف وتفتح التاني 👌",
    "أنت بتقول للمنهج أنا قدك",
    "ده أنت نجم الشباك النهارده 🌟",
    "كده أنت بتكتب التاريخ",
    "كبير يا كبير",
    "ده لعب عيال بالنسبة لك 😎",
    "أقف احتراما للعب التقيل 👏"
  ];

  const wrongMessages = [
    "لا يا بطل… حاول تاني بس المرة دي شغل دماغك شوية 😅",
    "قريب… بس مش للدرجة دي 😄",
    "الإجابة دي عايزة إعادة نظر 👀",
    "لأ خالص 😂 بس حلو إنك حاولت",
    "شكلك كنت سرحان ثانية كده",
    "لأ… دي محتاجة مراجعة سريعة",
    "إحنا مش بعيدين… بس لسه مجتش",
    "المحاولة جميلة بس الإجابة لأ 😅",
    "ركز بس وهتوصل",
    "لا يا عم مش كده خالص 😄",
    "دي إجابة من كوكب تاني 👽",
    "لأ… بس عندك فرصة تعوض",
    "حاول تفكر فيها تاني بهدوء",
    "الإجابة دي شكلها اتلخبطت منك",
    "كنت ماشي صح… وبعدين لفّيت فجأة 😂",
    "لأ… بس واضح إنك بتجرب",
    "ركز معايا كده شوية",
    "الإجابة دي محتاجة إنعاش",
    "لأ… بس المرة الجاية هتيجي صح",
    "متزعلش… الغلط بيعلّم 😉",
    "إيه يا عم الكلام ده 😅",
    "لا يا نجم… مش كده خالص",
    "أنت كنت داخل بثقة زيادة شوية 😂",
    "إيه التخبيص ده؟",
    "لأ لأ… كده الموضوع خرج عن السيطرة",
    "هو إحنا بنهزر ولا إيه 😄",
    "شكلك سمعت السؤال غلط",
    "دي إجابة محتاجة لجنة تقصي حقائق",
    "مين ضحك عليك وقالك كده؟ 😂",
    "أنت قلبت السيناريو خالص",
    "إيه الجرأة دي بس!",
    "لأ… دي طلعت حركة فيلم هندي",
    "كده إحنا محتاجين نرجع للمذاكرة",
    "أنت روحت بعيد أوي",
    "ده مش التويست اللي كنا مستنينه",
    "لأ يا معلم… رجعنا لنقطة الصفر",
    "كنت ماشي صح… وبوظتها في الآخر 😅",
    "ده مش مشهد النهاية اللي عايزينه",
    "لأ… دي محتاجة إعادة تصوير",
    "استنى بس… نعيد اللقطة تاني 🎬"
  ];

  // WebSocket Listeners
  useEffect(() => {
    onMessage("STATE_UPDATE", (state) => {
      setIsAccepting(state.isAcceptingAnswers);
      setTeacherHasAnswer(!!state.correctAnswer);
      setCustomChoices(state.customChoices);
      if (typeof state.questionId === "number") setQuestionId(state.questionId);
      if (typeof state.showAccuracy === "boolean") setShowAccuracy(state.showAccuracy);
      if (state.correctAnswer && !selectedAnswer && !result) {
        setStartTime(Date.now());
      }
      // Reset local state if quiz resets or new question starts
      if (state.isAcceptingAnswers && !state.correctAnswer) {
        setResult(null);
        resultRef.current = null;
        setSelectedAnswer(null);
        setShowLeaderboard(false);
        setIsRetry(false);
        isRetryRef.current = false;
        setHasRetried(false);
        lastResultSyncKey.current = null;
      }
    });

    onMessage("KICK_STUDENT", (payload: any) => {
      const myId = localStorage.getItem("studentId");
      if (payload && String(payload.studentId) === myId) {
        localStorage.removeItem("studentId");
        localStorage.removeItem("studentName");
        window.location.href = "/student/join";
      }
    });

    onMessage("KICK_ALL", () => {
      localStorage.removeItem("studentId");
      localStorage.removeItem("studentName");
      window.location.href = "/student/join";
    });

    onMessage("STUDENT_RESULT", (payload) => {
      setResult(payload);
      if (payload.correct) {
        playCorrect();
      } else {
        playWrong();
      }
      
       const resultPayload = payload as typeof payload & { doublePoints?: boolean; newScore?: number; newSessionScore?: number };
      if (resultPayload.doublePoints) {
        playStreak();
        toast({
          title: "🎉 مبروك!",
          description: `لقد حصلت على ضعف النقاط! رصيدك الآن: ${resultPayload.newScore}`,
          variant: "default",
        });
      }
    });

    onMessage("TEACHER_ALERT", (payload: any) => {
      if (payload && payload.message) {
        toast({
          title: "تنبيه من المعلم",
          description: payload.message,
        });
      }
    });

    // We can also listen to general student updates to catch our own score updates
    onMessage("STUDENTS_UPDATE", (students) => {
      const sorted = [...students].sort((a, b) => b.score - a.score);
      setLeaderboard(sorted);
      
      const me = students.find(s => String(s.id) === localStorage.getItem("studentId"));
      if (me) {
        setScore(me.score);
         setSessionScore(me.sessionScore ?? 0);
        setTotalAnswers(me.totalAnswers ?? 0);
        setCorrectAnswersCount(me.correctAnswersCount ?? 0);
        setStreak(me.consecutiveCorrect ?? 0);
        // Show rank if student has answered
        if (me.lastAnswer) {
          setShowLeaderboard(true);
        }
        
        // Also sync result state if we reconnected
        if (me.lastAnswer && me.isCorrect !== null && !isRetryRef.current) {
          const resultKey = `${me.id}:${me.updatedAt ?? ""}:${me.lastAnswer}:${me.isCorrect}`;
          if (lastResultSyncKey.current === resultKey || resultRef.current) return;
          lastResultSyncKey.current = resultKey;
          const randomMessage = me.isCorrect 
            ? correctMessages[Math.floor(Math.random() * correctMessages.length)]
            : wrongMessages[Math.floor(Math.random() * wrongMessages.length)];
            
          setResult({
            correct: me.isCorrect,
            message: randomMessage
          });
          setSelectedAnswer(me.lastAnswer);
        } else if (!me.lastAnswer) {
          lastResultSyncKey.current = null;
          setSelectedAnswer(null);
          setResult(null);
          resultRef.current = null;
        }
      }
    });
  }, [onMessage]);

  const handleAnswer = (answer: string) => {
    resetRefresh();
    if (!isAccepting || (result?.correct) || submit.isPending) return;
    
    if (!teacherHasAnswer) {
      toast({
        variant: "destructive",
        title: "انتظر قليلاً",
        description: "WAITING FOR MR AHMED TO SET THE RIGHT ANSWER",
      });
      return;
    }
    
    setSelectedAnswer(answer);
  };

  const confirmAnswer = () => {
    unlockAudio();
    resetRefresh();
    const currentStudentId = studentId ?? localStorage.getItem("studentId");
    if (!currentStudentId || !selectedAnswer) {
      toast({
        title: "تعذر إرسال الإجابة",
        description: "اختر إجابة ثم حاول مرة أخرى",
        variant: "destructive",
      });
      return;
    }
    const parsedStudentId = Number.parseInt(currentStudentId, 10);
    if (!Number.isFinite(parsedStudentId)) {
      toast({
        title: "تعذر إرسال الإجابة",
        description: "جلسة الطالب غير صالحة، أعد تسجيل الدخول",
        variant: "destructive",
      });
      return;
    }
    const timeTaken = ((Date.now() - (startTime || Date.now())) / 1000).toFixed(3);
    submit.mutate({ id: parsedStudentId, answer: selectedAnswer, responseTime: timeTaken, isRetry });
  };

  const handleRetry = () => {
    if (!isAccepting) {
      toast({
        variant: "destructive",
        title: "المحاولة الثانية غير متاحة الآن",
        description: "انتظر حتى يفتح المدرس استقبال الإجابات",
      });
      return;
    }
    setResult(null);
    resultRef.current = null;
    setSelectedAnswer(null);
    setIsRetry(true);
    isRetryRef.current = true;
    setHasRetried(true);
    if (questionId > 0) localStorage.setItem(`hasRetried:${questionId}`, "true");
  };

  useEffect(() => {
    if (questionId <= 0) return;
    setHasRetried(localStorage.getItem(`hasRetried:${questionId}`) === "true");
  }, [questionId]);

  useEffect(() => {
    const response = submit.data as {
      correct?: boolean;
      message?: string;
      doublePoints?: boolean;
      newScore?: number;
      newSessionScore?: number;
    } | undefined;
    if (!response) return;
    if (typeof response.newScore === "number") setScore(response.newScore);
    if (typeof response.newSessionScore === "number") setSessionScore(response.newSessionScore);
    if (typeof response.correct === "boolean" && typeof response.message === "string") {
      setResult({
        correct: response.correct,
        message: response.message,
        doublePoints: response.doublePoints,
        newScore: response.newScore,
        newSessionScore: response.newSessionScore,
      });
    }
  }, [submit.data]);

  if (!name) return null;

  const myRank = leaderboard.findIndex(s => String(s.id) === studentId) + 1;

  const currentChoices = customChoices || ["A", "B", "C", "D"];
  const variants: Record<string, "primary" | "secondary" | "accent" | "destructive" | "outline"> = {
    A: "outline",
    B: "outline", 
    C: "outline",
    D: "outline"
  };

  return (
    <div className="min-h-screen flex flex-col p-4 relative overflow-hidden bg-black">
      <AnimatedBackground />

      {/* Header */}
      <header className="bg-white/5 backdrop-blur-md px-3 py-3 rounded-2xl shadow-xl border border-white/10 mb-6 z-10">
        {/* Row 1: identity + score */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: photo + name */}
          <div className="flex items-center gap-2 min-w-0">
            {(() => {
              const photo = localStorage.getItem("studentPhoto");
              return photo ? (
                <img
                  src={photo}
                  alt="selfie"
                  className="w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-xl object-cover border-2 border-primary/60 shadow-md shadow-primary/20"
                />
              ) : (
                <div className="w-10 h-10 shrink-0 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5" />
                </div>
              );
            })()}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <img src="/logo.png" className="w-4 h-4 object-contain shrink-0" alt="Logo" />
                <span className="text-[9px] text-primary font-bold uppercase tracking-widest truncate">Hi, Mr.Ahmed's Students</span>
              </div>
              <span className="font-bold text-sm sm:text-base text-white truncate leading-tight">{name}</span>
              {grade && <span className="text-[10px] text-gray-400">{grade === "third_secondary" ? "تالتة ثانوي" : "تانية ثانوي"}</span>}
            </div>
          </div>
          <div className="shrink-0">
            <button onClick={logout} title="تسجيل الخروج" className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/10">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: secondary stats — only shown when there's something to show */}
        {(streak > 0 || (showAccuracy && totalAnswers > 0) || myRank > 0) && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {streak > 0 && (
              <motion.div
                key={streak}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-bold text-xs",
                  streak === 3
                    ? "bg-orange-500/20 border-orange-500/50 text-orange-400 animate-pulse"
                    : "bg-orange-500/10 border-orange-500/20 text-orange-300"
                )}
              >
                <span>🔥</span>
                <span>{streak}</span>
              </motion.div>
            )}
            {showAccuracy && totalAnswers > 0 && (
              <div
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 font-bold text-xs"
                style={{ color: (() => {
                  const acc = Math.round((correctAnswersCount / totalAnswers) * 100);
                  return acc >= 80 ? '#4ade80' : acc >= 50 ? '#facc15' : '#f87171';
                })() }}
              >
                <Star className="w-3 h-3" />
                <span>{Math.round((correctAnswersCount / totalAnswers) * 100)}%</span>
              </div>
            )}
            {myRank > 0 && (
              <div className="flex items-center gap-1 bg-primary/20 px-2.5 py-1.5 rounded-lg border border-primary/30 text-primary font-bold text-xs">
                <Atom className="w-3 h-3" />
                <span>#{myRank}</span>
              </div>
            )}
          </div>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 max-w-2xl mx-auto w-full mb-5 z-10" dir="rtl">
        <div className="rounded-2xl border border-primary/30 bg-primary/15 px-4 py-3 text-center shadow-lg shadow-primary/10">
          <div className="text-xs sm:text-sm font-bold text-primary/80">إجمالي النقاط</div>
          <div className="text-3xl sm:text-4xl font-black text-white mt-1">{score}</div>
          <div className="text-[11px] text-primary/70">رصيد الحساب بالكامل</div>
        </div>
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/15 px-4 py-3 text-center shadow-lg shadow-yellow-400/10">
          <div className="text-xs sm:text-sm font-bold text-yellow-300/90">نقاط الحصة الحالية</div>
          <div className="text-3xl sm:text-4xl font-black text-white mt-1">{sessionScore}</div>
          <div className="text-[11px] text-yellow-300/70">النقاط المكتسبة في هذه الحصة</div>
        </div>
      </section>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full z-10 px-0 sm:px-4">
        
        {/* Status Message */}
        <div className="mb-4 sm:mb-8 w-full text-center min-h-[60px] sm:min-h-[80px]">
          <AnimatePresence mode="wait">
            {!isAccepting && !result && !selectedAnswer && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-black/80 backdrop-blur-md text-white px-8 py-4 rounded-2xl inline-flex items-center gap-3 shadow-xl"
              >
                <Clock className="w-6 h-6 animate-pulse text-yellow-400" />
                <span className="text-xl font-bold">Waiting for teacher...</span>
              </motion.div>
            )}

            {isAccepting && !result && !selectedAnswer && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-xl font-display font-medium text-primary/80 animate-pulse text-center max-w-xs"
              >
                {!teacherHasAnswer ? "WAITING FOR MR AHMED TO SET THE RIGHT ANSWER" : "Choose an Answer!"}
              </motion.div>
            )}

            {result && (
              <div className="flex flex-col items-center gap-4">
                {result.doublePoints ? (
                   <motion.div
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="bg-gradient-to-br from-yellow-400 to-orange-500 p-8 rounded-[3rem] shadow-[0_0_50px_rgba(234,179,8,0.5)] border-4 border-white text-white text-center"
                   >
                     <Trophy className="w-20 h-20 mx-auto mb-4 drop-shadow-lg" />
                     <h2 className="text-4xl font-black mb-2 uppercase tracking-tighter">Congratulations!</h2>
                     <p className="text-2xl font-bold mb-4">YOU GOT THE DOUBLE!</p>
                     <div className="text-6xl font-black bg-white/20 py-4 rounded-2xl border border-white/30">
                        {result.newScore} <span className="text-2xl">pts</span>
                     </div>
                   </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    className={cn(
                      "px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-2 border-4",
                      result.correct 
                        ? "bg-green-100 border-green-400 text-green-700" 
                        : "bg-red-100 border-red-400 text-red-700"
                    )}
                  >
                    {result.correct ? (
                      <Check className="w-16 h-16" />
                    ) : (
                      <X className="w-16 h-16" />
                    )}
                    <span className="text-3xl font-bold font-display">{result.message}</span>
                  </motion.div>
                )}

                {!result.correct && !hasRetried && isAccepting && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={handleRetry}
                    className="mt-4 px-8 py-4 bg-primary text-white rounded-2xl font-bold text-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <RefreshCw className="w-6 h-6" />
                    اديني فرصة تانية
                  </motion.button>
                )}

                {showLeaderboard && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 w-full shadow-2xl"
                  >
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Trophy className="w-6 h-6 text-yellow-400" />
                      <h3 className="text-white text-xl font-bold">Class Leaderboard</h3>
                    </div>
                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                      {leaderboard.slice(0, 5).map((student, idx) => (
                        <div 
                          key={student.id} 
                          className={cn(
                            "flex justify-between items-center p-3 rounded-xl transition-all",
                            String(student.id) === studentId 
                              ? "bg-primary/20 text-white font-bold border border-primary/30 ring-2 ring-primary/20" 
                              : "bg-white/5 text-white/70"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-[10px] opacity-70">#{idx + 1}</span>
                            <span>{student.name}</span>
                          </div>
                          <span className="font-mono text-primary">{student.score} pts</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Answer Grid */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full px-4 sm:px-8 lg:px-12 mb-4 sm:mb-8 max-w-2xl mx-auto">
          {currentChoices.map((opt) => {
            const isSelected = selectedAnswer === opt;
            const isDisabled = !isAccepting || (!!result && !isSelected);
            const variant = variants[opt] || "outline";

            return (
              <BigButton
                key={opt}
                label={opt}
                variant={isSelected ? "success" : variant as any}
                size="xl"
                disabled={isDisabled}
                onClick={() => handleAnswer(opt)}
                className={cn(
                  "h-20 sm:h-28 lg:h-32 text-3xl sm:text-4xl lg:text-5xl transition-all duration-300 w-full rounded-2xl sm:rounded-[2.5rem]",
                  isSelected && "ring-4 sm:ring-8 ring-white ring-offset-2 sm:ring-offset-4 ring-offset-primary/20 scale-[1.02] sm:scale-[1.05] z-20 shadow-xl sm:shadow-2xl",
                  isDisabled && !isSelected && "opacity-30 scale-95 grayscale",
                  isDisabled && isSelected && "opacity-100 grayscale-0"
                )}
              />
            );
          })}
        </div>

        {/* Submit Button - Always Visible */}
        <div className="w-full px-1 sm:px-2 mt-4">
          <AnimatePresence>
            {selectedAnswer && !result && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                onClick={confirmAnswer}
                disabled={submit.isPending}
                className="w-full py-3 sm:py-4 bg-white text-black rounded-xl sm:rounded-2xl font-bold text-base sm:text-xl shadow-xl sm:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {submit.isPending ? "Sending..." : "Check your answer"} 
                <Check className="w-5 h-5 sm:w-6 sm:h-6" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
