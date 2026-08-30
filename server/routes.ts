import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { loadCounters, saveCounters } from "./counters";
import { loadEmails, saveEmails, addOrUpdateEmail, type SavedEmail } from "./emails";
import { createAuthToken, hashPassword, readAuthToken, verifyPassword } from "./auth";

const TEACHER_PASSWORD = "246802";
const HOST_PASSWORD = "123789";

// Google OAuth Config
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const CALLBACK_URL = (() => {
  if (process.env.GOOGLE_CALLBACK_URL) return process.env.GOOGLE_CALLBACK_URL;
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS}/auth/google/callback`;
  if (process.env.NODE_ENV === "production") return "https://ahmedlivequiz.up.railway.app/auth/google/callback";
  return "http://localhost:5000/auth/google/callback";
})();

console.log("[Google OAuth] Callback URL:", CALLBACK_URL);

// Configure Passport
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Create or find student by Google email
      const email = profile.emails?.[0]?.value || "";
      let student = email ? await storage.getStudentByEmail?.(email) : undefined;
      const studentName = profile.displayName || profile.name?.givenName || email;
      const googlePhoto = profile.photos?.[0]?.value || null;

      if (!student) {
        // Create new student
        student = await storage.createStudent({
          name: studentName,
          ...(email ? { email } : {}),
        });
      }

      // Save Google profile photo to storage
      if (googlePhoto) {
        await storage.setStudentPhoto(student.id, googlePhoto);
      }

      // Attach googlePhoto to user object so the callback can use it
      (student as any).googlePhoto = googlePhoto;

      // Persist email to file so it survives server restarts
      if (email) {
        savedEmails = addOrUpdateEmail(email, studentName, savedEmails);
        saveEmails(savedEmails);
      }
      
      return done(null, student);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const student = await storage.getStudent(id);
      done(null, student);
    } catch (err) {
      done(err);
    }
  });
}

// Global Quiz State
let quizState = {
  isAcceptingAnswers: true,
  correctAnswer: null as string | null,
  customChoices: null as string[] | null,
  answerStartTime: 0,
  showAccuracy: true,
};

// Session Counters — loaded from disk so they survive server restarts
let sessionCounters = loadCounters();
let savedEmails: SavedEmail[] = loadEmails();

const STUDENT_AUTH_COOKIE = "student_auth";
const STUDENT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function publicStudent(student: any) {
  if (!student) return student;
  const { passwordHash, ...safeStudent } = student;
  return safeStudent;
}

function getCookie(req: any, name: string): string | undefined {
  const header = req.headers?.cookie;
  if (!header) return undefined;
  const item = header.split(";").map((part: string) => part.trim()).find((part: string) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
}

function getStudentIdFromRequest(req: any): number | undefined {
  const sessionId = Number(req.session?.studentId);
  if (Number.isInteger(sessionId) && sessionId > 0) return sessionId;
  return readAuthToken(getCookie(req, STUDENT_AUTH_COOKIE));
}

function rememberStudent(req: any, res: any, studentId: number) {
  req.session.studentId = studentId;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${STUDENT_AUTH_COOKIE}=${encodeURIComponent(createAuthToken(studentId))}; Max-Age=${STUDENT_COOKIE_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
}

function forgetStudent(res: any) {
  res.setHeader("Set-Cookie", `${STUDENT_AUTH_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
}

function requireTeacher(req: any, res: any, next: any) {
  if (req.session?.teacherAuthenticated === true) return next();
  return res.status(401).json({ message: "يجب تسجيل دخول المراقب" });
}

function requireMonitor(req: any, res: any, next: any) {
  if (req.session?.teacherAuthenticated === true || req.session?.hostAuthenticated === true) return next();
  return res.status(401).json({ message: "يجب تسجيل دخول المضيف أو المدرس" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: "/ws",
    perMessageDeflate: false,
    clientTracking: true
  });

  // Heartbeat: detect and terminate dead connections every 30 seconds
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(heartbeatInterval));

  // Broadcast helper
  const broadcast = (message: any) => {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (e) {
          console.error("Broadcast error:", e);
        }
      }
    });
  };

  // Broadcast helper for state - strips internal fields before sending
  const broadcastState = async () => {
    const { answerStartTime, ...publicState } = quizState;
    broadcast({ type: "STATE_UPDATE", payload: publicState });
    const students = await storage.getStudents();
    broadcast({ type: "STUDENTS_UPDATE", payload: students.map(publicStudent) });
    broadcast({ type: "COUNTERS_UPDATE", payload: sessionCounters });
  };

  wss.on("connection", (ws: any) => {
    // Mark connection as alive and listen for pong responses
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    // Send initial state on connection (without internal fields)
    const { answerStartTime, ...publicState } = quizState;
    ws.send(JSON.stringify({ type: "STATE_UPDATE", payload: publicState }));
    ws.send(JSON.stringify({ type: "COUNTERS_UPDATE", payload: sessionCounters }));
    storage.getStudents().then((students) => {
      ws.send(JSON.stringify({ type: "STUDENTS_UPDATE", payload: students.map(publicStudent) }));
    });
  });

  // Teacher APIs
  app.post("/api/host/login", (req, res) => {
    if (req.body?.password === HOST_PASSWORD) {
      (req.session as any).hostAuthenticated = true;
      return req.session.save((error) => {
        if (error) {
          console.error("[Host Auth] Failed to save session:", error);
          return res.status(500).json({ message: "تعذر حفظ جلسة المضيف" });
        }
        return res.json({ success: true });
      });
    }
    return res.status(401).json({ message: "كلمة مرور المضيف غير صحيحة" });
  });

  app.get("/api/host/session", (req, res) => {
    if ((req.session as any).hostAuthenticated === true) return res.json({ authenticated: true });
    return res.status(401).json({ message: "يجب تسجيل دخول المضيف" });
  });

  app.post("/api/host/logout", (req, res) => {
    (req.session as any).hostAuthenticated = false;
    res.json({ success: true });
  });

  app.post(api.teacher.login.path, (req, res) => {
    const { password } = req.body;
    if (password === TEACHER_PASSWORD) {
      (req.session as any).teacherAuthenticated = true;
      req.session.save((error) => {
        if (error) {
          console.error("[Teacher Auth] Failed to save session:", error);
          return res.status(500).json({ message: "تعذر حفظ جلسة المدرس" });
        }
        return res.json({ success: true });
      });
    } else {
      res.status(401).json({ message: "Invalid password" });
    }
  });

  app.get("/api/teacher/session", requireTeacher, (_req, res) => {
    res.json({ authenticated: true });
  });

  app.post("/api/teacher/logout", requireTeacher, (req, res) => {
    (req.session as any).teacherAuthenticated = false;
    res.json({ success: true });
  });

  app.post(api.teacher.setAnswer.path, requireTeacher, async (req, res) => {
    const { answer, customChoices } = req.body;
    quizState.correctAnswer = answer;
    quizState.customChoices = customChoices || null;
    quizState.answerStartTime = Date.now();
    
    // Grade existing answers
    const students = await storage.getStudents();
    for (const student of students) {
      if (student.lastAnswer) {
        const isCorrect = student.lastAnswer === answer;
        const newScore = isCorrect ? student.score + 10 : student.score; 
        
        // Update DB
        if (isCorrect !== student.isCorrect) {
             await storage.updateStudentAnswer(student.id, student.lastAnswer, isCorrect);
             if (isCorrect) {
                 await storage.updateStudentScore(student.id, newScore);
             }
        }
      }
    }
    
    broadcastState();
    res.json({ success: true });
  });

  app.post(api.teacher.toggleAccepting.path, requireTeacher, (req, res) => {
    const { accepting } = req.body;
    quizState.isAcceptingAnswers = accepting;
    broadcastState();
    res.json({ success: true });
  });

  app.post("/api/teacher/reset", requireTeacher, async (req, res) => {
    // Reset student answers but keep scores
    await storage.clearAnswersOnly(); // This clears only lastAnswer and isCorrect
    sessionCounters.nextQuestionCount++;
    saveCounters(sessionCounters);
    quizState.correctAnswer = null;
    quizState.customChoices = null;
    quizState.isAcceptingAnswers = true;
    quizState.answerStartTime = 0;
    broadcastState();
    res.json({ success: true });
  });

  app.post("/api/teacher/reset-points", requireTeacher, async (req, res) => {
    await storage.resetAllStudents();
    quizState.correctAnswer = null;
    quizState.customChoices = null;
    quizState.isAcceptingAnswers = true;
    quizState.answerStartTime = 0;
    broadcastState();
    res.json({ success: true });
  });

  app.post("/api/teacher/toggle-accuracy", requireTeacher, (req, res) => {
    const { show } = req.body;
    quizState.showAccuracy = typeof show === "boolean" ? show : !quizState.showAccuracy;
    broadcastState();
    res.json({ success: true, showAccuracy: quizState.showAccuracy });
  });

  app.delete("/api/students/:id", requireMonitor, async (req, res) => {
    const id = parseInt(req.params.id);
    const student = await storage.getStudent(id);
    if (student) {
      await storage.updateStudentScore(id, 0);
    }
    await storage.deleteStudent(id);
    
    // Notify the specific student to logout/kick
    const kickMessage = JSON.stringify({ type: "KICK_STUDENT", payload: { studentId: id } });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(kickMessage);
      }
    });

    broadcastState();
    res.json({ success: true });
  });

  app.delete("/api/students", requireMonitor, async (req, res) => {
    // Reset all scores before deleting
    // await storage.resetAllStudents();
    await storage.deleteAllStudents();
    sessionCounters.deleteAllCount++;
    saveCounters(sessionCounters);
    
    // Notify all students to logout/kick
    const kickAllMessage = JSON.stringify({ type: "KICK_ALL", payload: {} });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(kickAllMessage);
      }
    });

    broadcastState();
    res.json({ success: true });
  });

  app.post("/api/students/:id/photo", async (req, res) => {
    const id = parseInt(req.params.id);
    const { photo } = req.body;
    if (!photo || typeof photo !== "string") {
      return res.status(400).json({ message: "Photo required" });
    }
    await storage.setStudentPhoto(id, photo);
    broadcast({ type: "PHOTO_ADDED", payload: { studentId: id, photo } });
    res.json({ success: true });
  });

  app.get("/api/photos", async (req, res) => {
    const photos = await storage.getAllPhotos();
    res.json(photos);
  });

  // Student accounts. The signed cookie lets a student stay signed in on
  // each device independently, while the account and points live on disk.
  app.post("/api/student/register", async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const grade = req.body?.grade;

    if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
      return res.status(400).json({ message: "اسم المستخدم يجب أن يكون بالإنجليزية من 3 إلى 30 حرفاً" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "كلمة المرور يجب ألا تقل عن 6 أحرف" });
    }
    if (!name || name.length > 80) {
      return res.status(400).json({ message: "يرجى إدخال اسم الطالب" });
    }
    if (grade !== "second_secondary" && grade !== "third_secondary") {
      return res.status(400).json({ message: "اختر الصف الدراسي" });
    }
    if (await storage.getStudentByUsername?.(username)) {
      return res.status(409).json({ message: "اسم المستخدم مستخدم بالفعل" });
    }

    const student = await storage.createStudent({
      name,
      username,
      grade,
      passwordHash: hashPassword(password),
    } as any);
    rememberStudent(req, res, student.id);
    sessionCounters.joinCount++;
    saveCounters(sessionCounters);
    broadcastState();
    return res.status(201).json(publicStudent(student));
  });

  app.post("/api/student/login", async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const student = await storage.getStudentByUsername?.(username);

    if (!student || !student.passwordHash || !verifyPassword(password, student.passwordHash)) {
      return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }
    rememberStudent(req, res, student.id);
    return res.json(publicStudent(student));
  });

  app.get("/api/student/me", async (req, res) => {
    const studentId = getStudentIdFromRequest(req);
    if (!studentId) return res.status(401).json({ message: "يجب تسجيل الدخول" });
    const student = await storage.getStudent(studentId);
    if (!student || student.archivedAt) {
      forgetStudent(res);
      return res.status(401).json({ message: "الحساب غير موجود" });
    }
    return res.json(publicStudent(student));
  });

  app.post("/api/student/logout", (req, res) => {
    if (req.session) {
      delete (req.session as any).studentId;
    }
    forgetStudent(res);
    res.json({ success: true });
  });

  app.post("/api/students/:id/points", requireMonitor, async (req, res) => {
    const id = parseInt(req.params.id);
    const { points } = req.body;
    const student = await storage.getStudent(id);
    if (!student || student.archivedAt) return res.status(404).json({ message: "Student not found" });
    
    const newScore = student.score + (parseInt(points) || 0);
    await storage.updateStudentScore(id, newScore);
    broadcastState();
    res.json({ success: true, newScore });
  });

  // Monitor-only database management. Passwords are never returned: only the
  // password hash is stored, and a monitor can set a new password instead.
  app.get("/api/teacher/students", requireMonitor, async (_req, res) => {
    const allStudents = await storage.getAllStudents();
    res.json(allStudents.map(publicStudent));
  });

  app.post("/api/teacher/students/:id/points", requireMonitor, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const points = Number.parseInt(String(req.body?.points ?? ""), 10);
    if (!Number.isInteger(id) || !Number.isInteger(points) || points === 0 || Math.abs(points) > 10000) {
      return res.status(400).json({ message: "أدخل عدد نقاط صحيح بين -10000 و10000" });
    }
    const student = await storage.getStudent(id);
    if (!student || student.archivedAt) return res.status(404).json({ message: "الطالب غير موجود أو مؤرشف" });
    const updated = await storage.updateStudentScore(id, student.score + points);
    broadcastState();
    res.json({ success: true, student: publicStudent(updated) });
  });

  app.post("/api/teacher/students/:id/password", requireMonitor, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (password.length < 6 || password.length > 100) {
      return res.status(400).json({ message: "كلمة المرور يجب أن تكون من 6 إلى 100 حرف" });
    }
    const student = await storage.getStudent(id);
    if (!student || student.archivedAt) return res.status(404).json({ message: "الطالب غير موجود أو مؤرشف" });
    const updated = await storage.updateStudentPassword(id, hashPassword(password));
    res.json({ success: true, student: publicStudent(updated) });
  });

  app.delete("/api/teacher/reset-database", requireMonitor, async (_req, res) => {
    await storage.deleteAllStudentsPermanently();
    savedEmails = [];
    saveEmails(savedEmails);
    sessionCounters.joinCount = 0;
    sessionCounters.deleteAllCount = 0;
    sessionCounters.nextQuestionCount = 0;
    saveCounters(sessionCounters);
    quizState.correctAnswer = null;
    quizState.customChoices = null;
    quizState.isAcceptingAnswers = true;
    quizState.answerStartTime = 0;

    const kickAllMessage = JSON.stringify({ type: "KICK_ALL", payload: {} });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(kickAllMessage);
    });
    broadcastState();
    res.json({ success: true });
  });

  // Student APIs
  app.post(api.students.join.path, async (req, res) => {
    try {
      const { name } = req.body;
      const students = await storage.getStudents();
      const existing = students.find(s => s.name.toLowerCase() === name.toLowerCase());
      
      if (existing) {
        rememberStudent(req, res, existing.id);
        return res.status(200).json(existing);
      }

      const student = await storage.createStudent(req.body);
      sessionCounters.joinCount++;
      saveCounters(sessionCounters);
      broadcastState();
      rememberStudent(req, res, student.id);
      res.status(201).json(publicStudent(student));
    } catch (e) {
      res.status(400).json({ message: "Could not join" });
    }
  });

  app.post(api.students.submit.path, async (req, res) => {
    if (!quizState.isAcceptingAnswers) {
      return res.status(400).json({ message: "Not accepting answers" });
    }

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

    const { answer, isRetry } = req.body;
    const studentIdStr = req.params.id;
    if (!studentIdStr) return res.status(400).json({ message: "Student ID required" });
    const studentId = parseInt(studentIdStr as string);
    
    const student = await storage.getStudent(studentId);
    if (!student || student.archivedAt) return res.status(404).json({ message: "Student not found" });

    // Calculate final response time based on teacher setting the answer
    const serverEndTime = Date.now();
    const serverDuration = quizState.answerStartTime > 0 
      ? ((serverEndTime - quizState.answerStartTime) / 1000).toFixed(3) 
      : "0.000";
    
    if (!quizState.correctAnswer) {
      // Notify teacher about early attempt
      broadcast({ 
        type: "TEACHER_ALERT", 
        payload: { message: `الطالب ${student.name} حاول الإجابة قبل تحديد الإجابة الصحيحة!` } 
      });
      return res.status(400).json({ message: "WAITING FOR MR AHMED TO SET THE RIGHT ANSWER" });
    }
    
    let isCorrect = answer === quizState.correctAnswer;
    
    // Check if student already has a correct answer for this question (unless retrying)
    if (!isRetry && student.isCorrect && student.lastAnswer) {
      return res.status(400).json({ message: "لقد أجبت بشكل صحيح بالفعل على هذا السؤال!" });
    }

    // Check if student already submitted an answer (unless retrying)
    if (!isRetry && student.lastAnswer) {
      return res.status(400).json({ message: "لقد قمت بإرسال إجابة بالفعل!" });
    }
    
    let pointsChange = 0;
    let doublePoints = false;

    if (isCorrect) {
        if (isRetry) {
            pointsChange = 3;
        } else {
            const students = await storage.getStudents();
            const correctAnswersCount = students.filter(s => s.isCorrect && s.lastAnswer).length;
            pointsChange = Math.max(1, 10 - correctAnswersCount);
        }
    } else {
        if (isRetry) {
            pointsChange = -5;
        } else {
            pointsChange = 0;
        }
    }
    
    let newScore = student.score + pointsChange;
    let newConsecutive = isCorrect ? student.consecutiveCorrect + 1 : 0;

    // Every 4th consecutive correct answer = double points, then streak resets to 0
    if (isCorrect && newConsecutive === 4) {
        pointsChange = pointsChange * 2;
        newScore = student.score + pointsChange;
        doublePoints = true;
        newConsecutive = 0; // reset after double so next cycle starts fresh
    }

    await storage.updateStudentScore(studentId, newScore);
    await storage.updateStudentAnswerWithStreak(studentId, answer, isCorrect, serverDuration, isRetry, newConsecutive);
    
    broadcastState();
    
    const messages = isCorrect ? correctMessages : (wrongMessages as string[]);
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    res.json({ 
      success: true, 
      correct: isCorrect,
      message: randomMessage,
      doublePoints,
      newScore
    });
  });

  app.get(api.students.list.path, async (req, res) => {
    const students = await storage.getStudents();
    res.json(students.map(publicStudent));
  });

  // All-time saved emails (persisted across server restarts)
  app.get("/api/emails", (_req, res) => {
    res.json(savedEmails);
  });

  // Google OAuth Routes
  app.get("/auth/google", 
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/student/join" }),
    (req, res) => {
      const student = (req.user as any);
      if (student) {
        // Broadcast photo to teacher dashboard
        if (student.googlePhoto) {
          broadcast({ type: "PHOTO_ADDED", payload: { studentId: student.id, photo: student.googlePhoto } });
        }
        const photoUrl = student.googlePhoto ? `&photo=${encodeURIComponent(student.googlePhoto)}` : "";
        res.redirect(`/student/join?id=${student.id}&name=${encodeURIComponent(student.name)}${photoUrl}`);
      } else {
        res.redirect("/student/join");
      }
    }
  );

  app.get("/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        res.status(500).json({ message: "Logout failed" });
      } else {
        res.redirect("/");
      }
    });
  });

  // Registered students and their points are intentionally kept between
  // server restarts. The teacher can still explicitly delete accounts.

  // Health check for deployment
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}
