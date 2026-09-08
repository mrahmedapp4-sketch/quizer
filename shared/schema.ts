import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username"),
  grade: text("grade"),
  passwordHash: text("password_hash"),
  email: text("email"),
  score: integer("score").default(0).notNull(),
  sessionScore: integer("session_score").default(0).notNull(),
  lastAnswer: text("last_answer"),
  isCorrect: boolean("is_correct"),
  responseTime: text("response_time"),
  googleId: text("google_id"),
  consecutiveCorrect: integer("consecutive_correct").default(0).notNull(),
  totalAnswers: integer("total_answers").default(0).notNull(),
  correctAnswersCount: integer("correct_answers_count").default(0).notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
  archivedAt: text("archived_at"),
});

export const insertStudentSchema = createInsertSchema(students).pick({
  name: true,
}).extend({
  email: z.string().email().optional(),
  username: z.string().min(3).max(30).optional(),
  grade: z.enum(["second_secondary", "third_secondary"]).optional(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

export type QuizState = {
  isAcceptingAnswers: boolean;
  correctAnswer: string | null;
  customChoices: string[] | null;
  questionId: number;
  showAccuracy: boolean;
};

// WebSocket message types
export type WsMessage = 
  | { type: 'STATE_UPDATE'; payload: QuizState }
  | { type: 'STUDENTS_UPDATE'; payload: Student[] }
  | { type: 'STUDENT_RESULT'; payload: { correct: boolean; message: string } }
  | { type: 'KICK_STUDENT'; payload: { studentId: number } }
  | { type: 'KICK_ALL'; payload: {} }
  | { type: 'TEACHER_ALERT'; payload: { message: string } }
  | { type: 'PHOTO_ADDED'; payload: { studentId: number; photo: string } }
  | { type: 'COUNTERS_UPDATE'; payload: Record<string, number> };
