import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Crown, GraduationCap, Medal, RefreshCw, Trophy } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { useStudentsList } from "@/hooks/use-students";
import { useSocket } from "@/hooks/use-socket";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GradeFilter = "all" | "second_secondary" | "third_secondary";

const grades: Record<string, string> = {
  second_secondary: "تانية ثانوي",
  third_secondary: "تالتة ثانوي",
};

export default function Leaderboard() {
  const { data: initialStudents, refetch, isFetching } = useStudentsList();
  const { onMessage } = useSocket();
  const [students, setStudents] = useState<any[]>([]);
  const [filter, setFilter] = useState<GradeFilter>("all");

  useEffect(() => {
    if (initialStudents) setStudents(initialStudents);
  }, [initialStudents]);

  useEffect(() => {
    onMessage("STUDENTS_UPDATE", (updatedStudents) => setStudents(updatedStudents));
  }, [onMessage]);

  const ranked = useMemo(
    () =>
      students
        .filter((student) => filter === "all" || student.grade === filter)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    [students, filter],
  );

  return (
    <div className="min-h-screen relative overflow-hidden p-4 sm:p-8" dir="rtl">
      <AnimatedBackground />
      <Link href="/" className="absolute top-4 left-4 md:top-8 md:left-8 z-20 p-2 rounded-full hover:bg-black/10">
        <ArrowLeft className="w-6 h-6 text-foreground/70" />
      </Link>

      <main className="relative z-10 max-w-4xl mx-auto pt-8">
        <div className="text-center mb-8">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex p-4 rounded-3xl bg-yellow-400/15 text-yellow-400 mb-4">
            <Trophy className="w-12 h-12" />
          </motion.div>
          <h1 className="text-4xl sm:text-6xl font-black text-white">لوحة المتصدرين</h1>
          <p className="text-gray-400 mt-2 text-lg">ترتيب الطلاب حسب مجموع النقاط الدائم</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {(["all", "second_secondary", "third_secondary"] as GradeFilter[]).map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={cn(
                "px-4 py-2 rounded-xl border font-bold transition-colors",
                filter === option ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-gray-400 hover:text-white",
              )}
            >
              {option === "all" ? "كل الطلاب" : grades[option]}
            </button>
          ))}
          <Button onClick={() => refetch()} variant="outline" className="rounded-xl border-white/10 bg-white/5 text-white">
            <RefreshCw className={cn("w-4 h-4 ml-2", isFetching && "animate-spin")} /> تحديث
          </Button>
        </div>

        <section className="bg-zinc-950/85 rounded-[2rem] border border-white/10 p-4 sm:p-7 shadow-2xl">
          {ranked.length === 0 ? (
            <div className="py-20 text-center text-gray-500">
              <GraduationCap className="w-14 h-14 mx-auto mb-3 opacity-40" />
              لا يوجد طلاب في هذا التصنيف حتى الآن
            </div>
          ) : (
            <div className="space-y-3">
              {ranked.map((student, index) => {
                const rank = index + 1;
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index, 8) * 0.04 }}
                    className={cn(
                      "flex items-center gap-3 sm:gap-5 p-4 rounded-2xl border",
                      rank === 1 ? "bg-yellow-400/10 border-yellow-400/30" : rank === 2 ? "bg-zinc-300/10 border-zinc-300/20" : rank === 3 ? "bg-orange-400/10 border-orange-400/25" : "bg-white/5 border-white/5",
                    )}
                  >
                    <div className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center font-black text-white/70 shrink-0">
                      {rank <= 3 ? (rank === 1 ? <Crown className="w-5 h-5 text-yellow-400" /> : <Medal className={cn("w-5 h-5", rank === 2 ? "text-zinc-300" : "text-orange-400")} />) : rank}
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-primary/20 flex items-center justify-center text-primary font-black text-lg shrink-0">
                      {student.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-white truncate">{student.name}</p>
                      <p className="text-xs text-gray-500">{grades[student.grade] || "طالب"}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <span className={cn("font-black text-xl sm:text-2xl", rank === 1 ? "text-yellow-400" : "text-primary")}>{student.score}</span>
                      <span className="text-xs text-gray-500 mr-1">نقطة</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}