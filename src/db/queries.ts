import { db } from './init';
import { TaskItem } from '../core/scheduler';

export interface Semester {
  id: string;
  name: string;
}

export interface Course {
  id: string;
  semesterId: string;
  name: string;
  meetingDays: string; // JSON stringified array of numbers (e.g. '[1, 3, 5]')
  startTime: number;   // Minutes from midnight (e.g. 600)
  endTime: number;     // Minutes from midnight (e.g. 690)
  location: string | null;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  dueDate: string;     // ISO Date string (e.g. '2026-06-15')
  priority: number;    // 1 (Low) to 3 (High)
}

export interface Task {
  id: string;
  assignmentId: string;
  title: string;
  estimatedMinutes: number;
  completed: number;   // 0 or 1
}

// Semesters Queries
export function addSemester(id: string, name: string): void {
  const stmt = db.prepare('INSERT OR IGNORE INTO semesters (id, name) VALUES (?, ?)');
  stmt.run(id, name);
}

export function getAllSemesters(): Semester[] {
  const stmt = db.prepare('SELECT id, name FROM semesters');
  return stmt.all() as Semester[];
}

// Courses Queries
export function addCourse(course: Course): void {
  const stmt = db.prepare(`
    INSERT INTO courses (id, semesterId, name, meetingDays, startTime, endTime, location)
    VALUES (@id, @semesterId, @name, @meetingDays, @startTime, @endTime, @location)
  `);
  stmt.run(course);
}

export function getCoursesBySemester(semesterId: string): Course[] {
  const stmt = db.prepare('SELECT * FROM courses WHERE semesterId = ?');
  return stmt.all(semesterId) as Course[];
}

export function findCourseByName(name: string): Course | null {
  const stmt = db.prepare('SELECT * FROM courses WHERE name LIKE ?');
  return (stmt.get(name) as Course) || null;
}

// Assignments Queries
export function addAssignment(assignment: Assignment): void {
  const stmt = db.prepare(`
    INSERT INTO assignments (id, courseId, title, dueDate, priority)
    VALUES (@id, @courseId, @title, @dueDate, @priority)
  `);
  stmt.run(assignment);
}

export function getAssignmentsByCourse(courseId: string): Assignment[] {
  const stmt = db.prepare('SELECT * FROM assignments WHERE courseId = ? ORDER BY dueDate ASC');
  return stmt.all(courseId) as Assignment[];
}

export function findAssignmentByTitle(title: string): Assignment | null {
  const stmt = db.prepare('SELECT * FROM assignments WHERE title LIKE ?');
  return (stmt.get(title) as Assignment) || null;
}

// Tasks Queries
export function addTask(task: Task): void {
  const stmt = db.prepare(`
    INSERT INTO tasks (id, assignmentId, title, estimatedMinutes, completed)
    VALUES (@id, @assignmentId, @title, @estimatedMinutes, @completed)
  `);
  stmt.run(task);
}

export function getTasksByAssignment(assignmentId: string): Task[] {
  const stmt = db.prepare('SELECT * FROM tasks WHERE assignmentId = ?');
  return stmt.all(assignmentId) as Task[];
}

export function findTaskByTitle(title: string): Task | null {
  const stmt = db.prepare('SELECT * FROM tasks WHERE title LIKE ?');
  return (stmt.get(title) as Task) || null;
}

export function setTaskCompletion(taskId: string, completed: number): void {
  const stmt = db.prepare('UPDATE tasks SET completed = ? WHERE id = ?');
  stmt.run(completed, taskId);
}

// Scheduler Query Helper
export function getPendingTasksWithPriority(): TaskItem[] {
  const stmt = db.prepare(`
    SELECT t.id, t.title, t.estimatedMinutes, a.priority, c.name as courseName
    FROM tasks t
    JOIN assignments a ON t.assignmentId = a.id
    JOIN courses c ON a.courseId = c.id
    WHERE t.completed = 0
  `);
  return stmt.all() as TaskItem[];
}
