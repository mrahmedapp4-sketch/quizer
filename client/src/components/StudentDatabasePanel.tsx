import { useEffect, useState } from "react";
import { Database, KeyRound, Plus, Search, Trash2, UserRound } from "lucide-react";
import { Student } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function StudentDatabasePanel({ onStudentsChanged }: { onStudentsChanged?: () => void }) {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [passwordStudent, setPasswordStudent] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const refresh = async () => {
    const response = await fetch("/api/teacher/students", { credentials: "include" });
    if (!response.ok) throw new Error("تعذر تحميل قاعدة بيانات الطلاب");
    const data = await response.json();
    setStudents(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    refresh()
      .catch((error) => toast({ title: "خطأ في قاعدة البيانات", description: error.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const addPoint = async (student: Student) => {
    try {
      await apiRequest("POST", `/api/teacher/students/${student.id}/points`, { points: 1 });
      await refresh();
      onStudentsChanged?.();
      toast({ title: "تمت إضافة نقطة", description: `تم تحديث نقاط ${student.name}` });
    } catch {
      toast({ title: "خطأ", description: "تعذر إضافة النقطة", variant: "destructive" });
    }
  };

  const archiveStudent = async (student: Student) => {
    if (!window.confirm(`هل تريد أرشفة الطالب ${student.name}؟`)) return;
    try {
      await apiRequest("DELETE", `/api/students/${student.id}`);
      await refresh();
      onStudentsChanged?.();
      toast({ title: "تمت الأرشفة", description: "تم إخفاء الحساب من قائمة الطلاب النشطين" });
    } catch {
      toast({ title: "خطأ", description: "تعذر أرشفة الطالب", variant: "destructive" });
    }
  };

  const savePassword = async () => {
    if (!passwordStudent) return;
    try {
      await apiRequest("POST", `/api/teacher/students/${passwordStudent.id}/password`, { password: newPassword });
      setPasswordStudent(null);
      setNewPassword("");
      toast({ title: "تم تغيير كلمة المرور", description: `تم تحديث حساب ${passwordStudent.name}` });
    } catch (error) {
      toast({ title: "خطأ", description: error instanceof Error ? error.message : "تعذر تغيير كلمة المرور", variant: "destructive" });
    }
  };

  const resetDatabase = async () => {
    if (window.prompt("هذا حذف نهائي. اكتب حذف الكل للتأكيد") !== "حذف الكل") return;
    setResetting(true);
    try {
      await apiRequest("DELETE", "/api/teacher/reset-database");
      setStudents([]);
      onStudentsChanged?.();
      toast({ title: "تم تنظيف قاعدة البيانات", description: "تم حذف حسابات الطلاب وبياناتهم نهائيًا" });
    } catch {
      toast({ title: "خطأ", description: "تعذر تنظيف قاعدة البيانات", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = students.filter((student) =>
    [student.name, student.username ?? "", student.email ?? ""].some((value) => value.toLowerCase().includes(query)),
  );
  const activeCount = students.filter((student) => !student.archivedAt).length;

  return (
    <>
      <section className="lg:col-span-12 bg-zinc-950/90 backdrop-blur-xl rounded-3xl p-6 border border-amber-400/20 shadow-xl" dir="rtl">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-400/10 text-amber-300"><Database className="w-6 h-6" /></div>
            <div>
              <h2 className="text-xl font-bold text-white">إدارة قاعدة بيانات الطلاب</h2>
              <p className="text-sm text-zinc-400">من المضيف: بحث، إضافة نقاط، وإدارة الحسابات</p>
            </div>
          </div>
          <Button type="button" onClick={resetDatabase} disabled={resetting} className="bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-400/30 rounded-xl font-bold">
            <Trash2 className="w-4 h-4 ml-2" /> {resetting ? "جاري التنظيف..." : "تنظيف قاعدة البيانات"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><div className="text-xs text-zinc-400">كل الحسابات</div><div className="text-2xl font-black text-white">{students.length}</div></div>
          <div className="rounded-2xl bg-green-500/10 border border-green-400/20 p-4"><div className="text-xs text-green-300">النشطة</div><div className="text-2xl font-black text-green-200">{activeCount}</div></div>
          <div className="rounded-2xl bg-zinc-500/10 border border-zinc-400/20 p-4"><div className="text-xs text-zinc-400">المؤرشفة</div><div className="text-2xl font-black text-zinc-200">{students.length - activeCount}</div></div>
        </div>

        <div className="relative mb-5">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم الطالب أو اسم المستخدم أو البريد..." className="h-12 pr-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-500 rounded-xl" />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-right min-w-[760px]">
            <thead className="bg-white/5"><tr className="border-b border-white/10 text-xs text-zinc-400">
              <th className="p-4">الطالب</th><th className="p-4">اسم المستخدم</th><th className="p-4">الصف</th><th className="p-4 text-center">النقاط</th><th className="p-4">الحالة</th><th className="p-4 text-center">الإجراءات</th>
            </tr></thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                  <td className="p-4"><div className="flex items-center gap-2 text-white font-bold"><UserRound className="w-4 h-4 text-primary" />{student.name}</div></td>
                  <td className="p-4 font-mono text-sm text-amber-200">{student.username || "—"}</td>
                  <td className="p-4 text-sm text-zinc-300">{student.grade === "third_secondary" ? "الثالث الثانوي" : student.grade === "second_secondary" ? "الثاني الثانوي" : "—"}</td>
                  <td className="p-4 text-center font-black text-primary">{student.score}</td>
                  <td className="p-4"><span className={cn("rounded-full px-3 py-1 text-xs font-bold", student.archivedAt ? "bg-zinc-700 text-zinc-300" : "bg-green-500/15 text-green-300")}>{student.archivedAt ? "مؤرشف" : "نشط"}</span></td>
                  <td className="p-4">{student.archivedAt ? <span className="text-xs text-zinc-500">لا توجد إجراءات</span> : <div className="flex items-center justify-center gap-2">
                    <Button type="button" onClick={() => addPoint(student)} className="h-9 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30"><Plus className="w-4 h-4 ml-1" /> نقطة</Button>
                    <Button type="button" onClick={() => { setPasswordStudent(student); setNewPassword(""); }} className="h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white"><KeyRound className="w-4 h-4 ml-1" /> كلمة مرور</Button>
                    <Button type="button" onClick={() => archiveStudent(student)} className="h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-400/20"><Trash2 className="w-4 h-4" /></Button>
                  </div>}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-zinc-500">لا يوجد طلاب مطابقون للبحث</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-zinc-500">كلمات المرور لا تظهر؛ يمكن للمضيف تعيين كلمة مرور جديدة فقط.</p>
      </section>

      <Dialog open={passwordStudent !== null} onOpenChange={(open) => !open && setPasswordStudent(null)}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-sm rounded-3xl" dir="rtl">
          <DialogHeader><DialogTitle className="text-xl font-bold text-center text-white">تغيير كلمة مرور الطالب</DialogTitle><DialogDescription className="text-center text-gray-400">{passwordStudent?.name} · {passwordStudent?.username || "بدون اسم مستخدم"}</DialogDescription></DialogHeader>
          <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)" className="bg-white/5 border-white/10 text-white h-12 rounded-xl my-4" autoFocus />
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setPasswordStudent(null)} className="rounded-xl border-white/10 hover:bg-white/5 text-white h-12">إلغاء</Button><Button onClick={savePassword} disabled={newPassword.length < 6} className="rounded-xl bg-primary text-primary-foreground font-bold h-12">حفظ كلمة المرور</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}