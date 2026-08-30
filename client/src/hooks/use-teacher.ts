import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export function useTeacherLogin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch(api.teacher.login.path, {
        method: api.teacher.login.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Login failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Welcome back!", description: "Logged in as Teacher." });
      setLocation("/teacher/dashboard");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Access Denied", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export function useTeacherActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const setAnswer = useMutation({
    mutationFn: async (answer: string) => {
      const res = await fetch(api.teacher.setAnswer.path, {
        method: api.teacher.setAnswer.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answer }),
      });
      if (!res.ok) throw new Error("Failed to set answer");
      return res.json();
    },
    onSuccess: (_, answer) => {
      toast({ title: "Answer Set", description: `Correct answer is now ${answer}` });
      // Invalidate queries if we were fetching them, but we use WS for real-time
    },
  });

  const toggleAccepting = useMutation({
    mutationFn: async (accepting: boolean) => {
      const res = await fetch(api.teacher.toggleAccepting.path, {
        method: api.teacher.toggleAccepting.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accepting }),
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      return res.json();
    },
    onSuccess: (_, accepting) => {
      toast({ 
        title: accepting ? "Quiz Active" : "Quiz Paused",
        description: accepting ? "Students can now answer." : "Submissions are closed."
      });
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.teacher.reset.path, {
        method: api.teacher.reset.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reset");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reset Complete", description: "All scores and answers cleared." });
    },
  });

  return { setAnswer, toggleAccepting, reset };
}
