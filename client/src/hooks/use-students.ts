import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertStudent } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export function useStudentJoin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (data: InsertStudent) => {
      const res = await fetch(api.students.join.path, {
        method: api.students.join.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: (student) => {
      localStorage.setItem("studentId", String(student.id));
      localStorage.setItem("studentName", student.name);
      toast({ title: "Joined!", description: `Welcome to class, ${student.name}!` });
      setLocation("/student/dashboard");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Could not join", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export function useStudentSubmit() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, answer, responseTime, isRetry }: { id: number; answer: string; responseTime?: string; isRetry?: boolean }) => {
      const url = api.students.submit.path.replace(":id", String(id));
      const res = await fetch(url, {
        method: api.students.submit.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, responseTime, isRetry }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Answer Submitted", description: "Waiting for results..." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Submission Failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export function useStudentsList() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const res = await fetch(api.students.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch students");
      return api.students.list.responses[200].parse(await res.json());
    },
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });
}
