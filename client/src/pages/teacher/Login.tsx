import { useState } from "react";
import { motion } from "framer-motion";
import { useTeacherLogin } from "@/hooks/use-teacher";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Link } from "wouter";

export default function TeacherLogin() {
  const [password, setPassword] = useState("");
  const login = useTeacherLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    login.mutate(password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <AnimatedBackground />
      
      <Link href="/" className="absolute top-4 left-4 md:top-8 md:left-8 p-2 rounded-full hover:bg-black/5 transition-colors">
        <ArrowLeft className="w-6 h-6 text-foreground/70" />
      </Link>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
            <LockKeyhole className="w-8 h-8" />
          </div>
          <h2 className="text-3xl text-white">Teacher Access</h2>
          <p className="text-gray-400 mt-2">Enter the secret passcode to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <input
              type="password"
              placeholder="Enter Passcode"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 text-center text-2xl font-mono tracking-widest rounded-xl border-2 border-white/10 bg-white/5 text-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none placeholder:text-gray-600"
              autoFocus
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={login.isPending || !password}
            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {login.isPending ? "Unlocking..." : "Enter Dashboard"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
