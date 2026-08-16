import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, FlaskConical, GraduationCap, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Grade = "second_secondary" | "third_secondary";
type Mode = "login" | "register";

const gradeLabels: Record<Grade, string> = {
  second_secondary: "تانية ثانوي",
  third_secondary: "تالتة ثانوي",
};

export default function StudentJoin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<Grade>("second_secondary");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/student/me", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((student) => {
        if (!student) return;
        localStorage.setItem("studentId", String(student.id));
        localStorage.setItem("studentName", student.name);
        setLocation("/student/dashboard");
      })
      .catch(() => {});
  }, [setLocation]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "اكتب اسم المستخدم وكلمة المرور" });
      return;
    }
    if (mode === "register") {
      if (!name.trim()) {
        toast({ variant: "destructive", title: "بيانات ناقصة", description: "اكتب اسمك بالكامل" });
        return;
      }
      if (password !== confirmPassword) {
        toast({ variant: "destructive", title: "كلمة المرور غير متطابقة", description: "اكتب نفس كلمة المرور في الخانتين" });
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetch(mode === "register" ? "/api/student/register" : "/api/student/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register"
            ? { username: username.trim(), password, name: name.trim(), grade }
            : { username: username.trim(), password },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر تسجيل الدخول");

      localStorage.setItem("studentId", String(data.id));
      localStorage.setItem("studentName", data.name);
      toast({
        title: mode === "register" ? "تم إنشاء الحساب" : "أهلاً بعودتك",
        description: `أهلاً يا ${data.name} — ${gradeLabels[data.grade as Grade] || ""}`,
      });
      setLocation("/student/dashboard");
    } catch (error) {
      toast({
        variant: "destructive",
        title: mode === "register" ? "تعذر إنشاء الحساب" : "تعذر تسجيل الدخول",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <AnimatedBackground />
      <Link href="/" className="absolute top-4 left-4 md:top-8 md:left-8 p-2 rounded-full hover:bg-black/10 transition-colors z-20">
        <ArrowLeft className="w-6 h-6 text-foreground/70" />
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-zinc-950/90 rounded-[2rem] p-5 sm:p-8 shadow-2xl border border-white/10"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto text-primary mb-4">
            <FlaskConical className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-black text-white">حساب الطالب</h1>
          <p className="text-gray-400 mt-2">نقطك بتفضل محفوظة وتكمل من أي جهاز</p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-colors ${mode === "login" ? "bg-primary text-white" : "text-gray-400 hover:text-white"}`}
          >
            <LogIn className="w-4 h-4" /> تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-colors ${mode === "register" ? "bg-primary text-white" : "text-gray-400 hover:text-white"}`}
          >
            <UserPlus className="w-4 h-4" /> إنشاء حساب
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="الاسم الظاهر للطلاب"
              className="h-14 bg-white/5 border-white/10 text-white text-right rounded-2xl text-lg"
              maxLength={80}
            />
          )}

          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))}
            placeholder="اسم المستخدم بالإنجليزية"
            className="h-14 bg-white/5 border-white/10 text-white text-left rounded-2xl text-lg"
            dir="ltr"
            maxLength={30}
            autoComplete="username"
          />

          {mode === "register" && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">أنت في الصف</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(gradeLabels) as Grade[]).map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setGrade(option)}
                    className={`rounded-2xl border py-3 font-bold transition-colors ${grade === option ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-white/5 text-gray-400 hover:text-white"}`}
                  >
                    <GraduationCap className="w-5 h-5 mx-auto mb-1" />
                    {gradeLabels[option]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <Input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="كلمة المرور (6 أحرف على الأقل)"
              type={showPassword ? "text" : "password"}
              className="h-14 bg-white/5 border-white/10 text-white text-left rounded-2xl text-lg pl-12"
              dir="ltr"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-4 top-4 text-gray-400 hover:text-white">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {mode === "register" && (
            <Input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="تأكيد كلمة المرور"
              type={showPassword ? "text" : "password"}
              className="h-14 bg-white/5 border-white/10 text-white text-left rounded-2xl text-lg"
              dir="ltr"
              autoComplete="new-password"
            />
          )}

          <Button type="submit" disabled={isLoading} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-lg">
            {isLoading ? "جاري التحميل..." : mode === "register" ? "إنشاء الحساب والبدء" : "دخول إلى الكويز"}
          </Button>
        </form>

        <div className="mt-6 flex gap-2 items-start text-xs text-gray-400 bg-primary/10 border border-primary/20 rounded-2xl p-3 leading-relaxed">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <span>تسجيل الدخول يفضل محفوظاً على هذا الجهاز، وتقدر تستخدم نفس الحساب على أجهزة تانية في نفس الوقت.</span>
        </div>
      </motion.div>
    </div>
  );
}