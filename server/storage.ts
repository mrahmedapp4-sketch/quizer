import { students, type Student, type InsertStudent } from "@shared/schema";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DATA_DIR } from "./data-dir";

export interface IStorage {
  createStudent(student: InsertStudent): Promise<Student>;
  getStudents(): Promise<Student[]>;
  getAllStudents(): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  getStudentByEmail?(email: string): Promise<Student | undefined>;
  getStudentByUsername?(username: string): Promise<Student | undefined>;
  updateStudentScore(id: number, score: number): Promise<Student>;
  updateStudentPassword(id: number, passwordHash: string): Promise<Student>;
  updateStudentAnswer(id: number, answer: string, isCorrect: boolean, responseTime?: string, isRetry?: boolean): Promise<Student>;
  updateStudentAnswerWithStreak(id: number, answer: string, isCorrect: boolean, responseTime?: string, isRetry?: boolean, newConsecutive?: number): Promise<Student>;
  resetAllStudents(): Promise<void>;
  clearAnswersOnly(): Promise<void>;
  deleteStudent(id: number): Promise<void>;
  deleteAllStudents(): Promise<void>;
  deleteStudentPermanently(id: number): Promise<void>;
  deleteAllStudentsPermanently(): Promise<void>;
  setStudentPhoto(id: number, photo: string): Promise<void>;
  getStudentPhoto(id: number): Promise<string | undefined>;
  getAllPhotos(): Promise<Record<number, string>>;
}

export class MemStorage implements IStorage {
  private students: Map<number, Student>;
  private photos: Map<number, string>;
  private currentId: number;
  private readonly studentsFile = join(DATA_DIR, "students.json");

  constructor() {
    this.students = new Map();
    this.photos = new Map();
    this.currentId = 1;
    this.loadStudents();
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const source = insertStudent as InsertStudent & {
      score?: number;
      lastAnswer?: string | null;
      isCorrect?: boolean | null;
      responseTime?: string | null;
      passwordHash?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
      archivedAt?: string | null;
    };
    const id = this.currentId++;
    const now = new Date().toISOString();
    const student: Student = { 
      ...source, 
      id, 
      email: source.email ?? null,
      username: source.username ?? null,
      grade: source.grade ?? null,
      passwordHash: source.passwordHash ?? null,
      score: source.score ?? 0,
      lastAnswer: source.lastAnswer ?? null,
      isCorrect: source.isCorrect ?? null,
      responseTime: source.responseTime ?? null,
      name: source.name ?? "",
      googleId: null,
      consecutiveCorrect: 0,
      totalAnswers: 0,
      correctAnswersCount: 0,
      createdAt: source.createdAt ?? now,
      updatedAt: source.updatedAt ?? now,
      archivedAt: source.archivedAt ?? null,
    };
    this.students.set(id, student);
    this.persistStudents();
    return student;
  }

  async getStudents(): Promise<Student[]> {
    return (await this.getAllStudents()).filter((student) => !student.archivedAt);
  }

  async getAllStudents(): Promise<Student[]> {
    return Array.from(this.students.values()).sort((a, b) => a.id - b.id);
  }

  async getStudent(id: number): Promise<Student | undefined> {
    return this.students.get(id);
  }

  async getStudentByEmail(email: string): Promise<Student | undefined> {
    return Array.from(this.students.values()).find(s => !s.archivedAt && s.email?.toLowerCase() === email.toLowerCase());
  }

  async getStudentByUsername(username: string): Promise<Student | undefined> {
    const normalized = username.trim().toLowerCase();
    return Array.from(this.students.values()).find(s => !s.archivedAt && s.username?.toLowerCase() === normalized);
  }

  async updateStudentScore(id: number, score: number): Promise<Student> {
    const student = this.students.get(id);
    if (!student) throw new Error("Student not found");
    const updated = { ...student, score, updatedAt: new Date().toISOString() };
    this.students.set(id, updated);
    this.persistStudents();
    return updated;
  }

  async updateStudentPassword(id: number, passwordHash: string): Promise<Student> {
    const student = this.students.get(id);
    if (!student) throw new Error("Student not found");
    const updated = { ...student, passwordHash, updatedAt: new Date().toISOString() };
    this.students.set(id, updated);
    this.persistStudents();
    return updated;
  }

  async updateStudentAnswer(id: number, answer: string, isCorrect: boolean, responseTime?: string, isRetry?: boolean): Promise<Student> {
    return this.updateStudentAnswerWithStreak(id, answer, isCorrect, responseTime, isRetry);
  }

  async updateStudentAnswerWithStreak(id: number, answer: string, isCorrect: boolean, responseTime?: string, isRetry?: boolean, newConsecutive?: number): Promise<Student> {
    const student = this.students.get(id);
    if (!student) throw new Error("Student not found");
    
    // Use provided consecutive value (already calculated in routes with double-point logic)
    // or fall back to calculating it here
    const consecutive = newConsecutive !== undefined
      ? newConsecutive
      : (isCorrect ? student.consecutiveCorrect + 1 : 0);

    // Only count totalAnswers and correctAnswersCount on first attempt (not retry)
    const newTotal = isRetry ? student.totalAnswers : student.totalAnswers + 1;
    const newCorrectCount = isCorrect
      ? student.correctAnswersCount + 1
      : student.correctAnswersCount;

    const updated = { 
      ...student, 
      lastAnswer: answer, 
      isCorrect, 
      responseTime: responseTime || null,
      consecutiveCorrect: consecutive,
      totalAnswers: newTotal,
      correctAnswersCount: newCorrectCount,
      updatedAt: new Date().toISOString(),
    };
    this.students.set(id, updated);
    this.persistStudents();
    return updated;
  }

  async resetAllStudents(): Promise<void> {
    for (const [id, student] of this.students.entries()) {
      if (student.archivedAt) continue;
      this.students.set(id, { 
        ...student, 
        score: 0, 
        lastAnswer: null, 
        isCorrect: null,
        responseTime: null,
        consecutiveCorrect: 0,
        totalAnswers: 0,
        correctAnswersCount: 0,
        updatedAt: new Date().toISOString(),
      });
    }
    this.persistStudents();
  }

  async clearAnswersOnly(): Promise<void> {
    for (const [id, student] of this.students.entries()) {
      if (student.archivedAt) continue;
      this.students.set(id, { 
        ...student, 
        lastAnswer: null, 
        isCorrect: null,
        responseTime: null,
        // consecutiveCorrect is NOT reset here — streak persists across questions
      });
    }
    this.persistStudents();
  }

  async deleteStudent(id: number): Promise<void> {
    const student = this.students.get(id);
    if (!student) return;
    const archivedAt = student.archivedAt ?? new Date().toISOString();
    this.students.set(id, { ...student, archivedAt, updatedAt: archivedAt });
    this.persistStudents();
  }

  async deleteAllStudents(): Promise<void> {
    const archivedAt = new Date().toISOString();
    for (const [id, student] of this.students.entries()) {
      if (!student.archivedAt) {
        this.students.set(id, { ...student, archivedAt, updatedAt: archivedAt });
      }
    }
    this.persistStudents();
  }

  async deleteStudentPermanently(id: number): Promise<void> {
    this.students.delete(id);
    this.photos.delete(id);
    this.persistStudents();
  }

  async deleteAllStudentsPermanently(): Promise<void> {
    this.students.clear();
    this.photos.clear();
    this.currentId = 1;
    this.persistStudents();
  }

  async setStudentPhoto(id: number, photo: string): Promise<void> {
    this.photos.set(id, photo);
  }

  async getStudentPhoto(id: number): Promise<string | undefined> {
    return this.photos.get(id);
  }

  async getAllPhotos(): Promise<Record<number, string>> {
    const result: Record<number, string> = {};
    for (const [id, photo] of this.photos.entries()) {
      result[id] = photo;
    }
    return result;
  }

  private loadStudents(): void {
    try {
      if (!existsSync(this.studentsFile)) return;
      const saved = JSON.parse(readFileSync(this.studentsFile, "utf8")) as Student[];
      if (!Array.isArray(saved)) return;
      for (const student of saved) {
        if (!student || typeof student.id !== "number") continue;
        this.students.set(student.id, {
          ...student,
          email: student.email ?? null,
          username: student.username ?? null,
          grade: student.grade ?? null,
          passwordHash: (student as any).passwordHash ?? null,
          score: student.score ?? 0,
          lastAnswer: student.lastAnswer ?? null,
          isCorrect: student.isCorrect ?? null,
          responseTime: student.responseTime ?? null,
          consecutiveCorrect: student.consecutiveCorrect ?? 0,
          totalAnswers: student.totalAnswers ?? 0,
          correctAnswersCount: student.correctAnswersCount ?? 0,
          createdAt: (student as any).createdAt ?? null,
          updatedAt: (student as any).updatedAt ?? (student as any).createdAt ?? null,
          archivedAt: (student as any).archivedAt ?? null,
        });
      }
      const ids = Array.from(this.students.keys());
      this.currentId = ids.length ? Math.max(...ids) + 1 : 1;
    } catch (error) {
      console.error("[storage] Could not load students.json:", error);
    }
  }

  private persistStudents(): void {
    try {
      mkdirSync(dirname(this.studentsFile), { recursive: true });
      writeFileSync(this.studentsFile, JSON.stringify(Array.from(this.students.values()), null, 2), "utf8");
    } catch (error) {
      console.error("[storage] Could not save students.json:", error);
    }
  }
}

export const storage = new MemStorage();
