import { Link } from "wouter";
import { motion } from "framer-motion";
import { GraduationCap, FlaskConical, ShieldCheck, Trophy } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { BigButton } from "@/components/BigButton";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-12 z-10"
      >
        <h1 className="text-5xl md:text-8xl mb-4 text-primary drop-shadow-2xl font-black tracking-tighter bg-gradient-to-b from-primary to-primary/60 bg-clip-text text-transparent">
          مرحباً طلاب مستر أحمد
        </h1>
        <p className="text-xl md:text-3xl text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed tracking-tight opacity-90">
          تجربة كويز ممتعة وتفاعلية في الفصل للجميع!
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        className="flex flex-col md:grid md:grid-cols-4 gap-5 md:gap-7 z-10 w-full max-w-[1500px] px-4"
      >
        <Link href="/student/join" className="contents">
          <motion.div 
            whileHover={{ scale: 1.05, y: -5 }} 
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="order-1 flex w-full h-full"
          >
            <BigButton
              label="أنا طالب"
              sublabel="سجل دخولك وانضم للمتعة!"
              variant="secondary"
              size="xl"
              icon={<FlaskConical className="w-16 h-16 mb-2" />}
              className="h-full min-h-[14rem] md:h-72 shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-secondary/30 border-b-8 active:border-b-0 transition-all rounded-[2.5rem] text-2xl md:text-4xl w-full"
            />
          </motion.div>
        </Link>

        <Link href="/teacher/login" className="contents">
          <motion.div 
            whileHover={{ scale: 1.05, y: -5 }} 
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="order-2 flex w-full h-full"
          >
            <BigButton
              label="أنا معلم"
              sublabel="أنشئ كويزات وتابع الدرجات"
              variant="primary"
              size="xl"
              icon={<GraduationCap className="w-16 h-16 mb-2" />}
              className="h-full min-h-[14rem] md:h-72 shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-primary/30 border-b-8 active:border-b-0 transition-all rounded-[2.5rem] text-2xl md:text-4xl w-full"
            />
          </motion.div>
        </Link>
        
        <Link href="/host/login" className="contents">
          <motion.div 
            whileHover={{ scale: 1.05, y: -5 }} 
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="order-3 flex w-full h-full"
          >
            <BigButton
              label="أنا المضيف"
              sublabel="راقب حالة الكويز مباشرة"
              variant="accent"
              size="xl"
              icon={<ShieldCheck className="w-16 h-16 mb-2" />}
              className="h-full min-h-[14rem] md:h-72 shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-accent/30 border-b-8 active:border-b-0 transition-all rounded-[2.5rem] text-2xl md:text-4xl w-full"
              data-testid="link-host-login"
            />
          </motion.div>
        </Link>

        <Link href="/leaderboard" className="contents">
          <motion.div
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="order-4 flex w-full h-full"
          >
            <BigButton
              label="لوحة المتصدرين"
              sublabel="شوف ترتيب الطلاب والنقاط"
              variant="accent"
              size="xl"
              icon={<Trophy className="w-16 h-16 mb-2" />}
              className="h-full min-h-[14rem] md:h-72 shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-yellow-500/30 border-b-8 active:border-b-0 transition-all rounded-[2.5rem] text-2xl md:text-4xl w-full"
            />
          </motion.div>
        </Link>
      </motion.div>

      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-4 text-sm text-gray-600 font-mono"
      >
      </motion.footer>
    </div>
  );
}
