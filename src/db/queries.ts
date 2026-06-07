import { db } from './init';
import { TaskItem } from '../core/scheduler';

export interface Semester {
  id: string;
  name: string;
  isCurrent: number;   // 0 or 1
  isArchived: number;  // 0 or 1
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
export function addSemester(id: string, name: string, isCurrent: number = 0): void {
  const stmt = db.prepare('INSERT OR IGNORE INTO semesters (id, name, isCurrent, isArchived) VALUES (?, ?, ?, 0)');
  stmt.run(id, name, isCurrent);
}

export function getAllSemesters(): Semester[] {
  const stmt = db.prepare('SELECT id, name, isCurrent, isArchived FROM semesters');
  return stmt.all() as Semester[];
}

export function getCurrentSemester(): Semester | null {
  const stmt = db.prepare('SELECT * FROM semesters WHERE isCurrent = 1 AND isArchived = 0');
  return (stmt.get() as Semester) || null;
}

export function findSemesterByName(name: string): Semester | null {
  const stmt = db.prepare('SELECT * FROM semesters WHERE name LIKE ?');
  return (stmt.get(name) as Semester) || null;
}

export function setCurrentSemester(semesterId: string): void {
  const clearCurrent = db.prepare('UPDATE semesters SET isCurrent = 0');
  const setCurrent = db.prepare('UPDATE semesters SET isCurrent = 1 WHERE id = ?');
  
  const runTx = db.transaction(() => {
    clearCurrent.run();
    setCurrent.run(semesterId);
  });
  runTx();
}

export function setSemesterArchive(semesterId: string, isArchived: number): void {
  if (isArchived === 1) {
    db.prepare('UPDATE semesters SET isArchived = 1, isCurrent = 0 WHERE id = ?').run(semesterId);
  } else {
    db.prepare('UPDATE semesters SET isArchived = 0 WHERE id = ?').run(semesterId);
  }
}

export function updateSemesterName(semesterId: string, name: string): void {
  db.prepare('UPDATE semesters SET name = ? WHERE id = ?').run(name, semesterId);
}

export function deleteSemester(semesterId: string): void {
  db.prepare('DELETE FROM semesters WHERE id = ?').run(semesterId);
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

// Helper to find course by name inside the current active semester
export function findCourseInCurrentSemester(name: string): Course | null {
  const current = getCurrentSemester();
  if (!current) return null;
  const stmt = db.prepare('SELECT * FROM courses WHERE name LIKE ? AND semesterId = ?');
  return (stmt.get(name, current.id) as Course) || null;
}

export function updateCourse(courseId: string, updates: Partial<Omit<Course, 'id' | 'semesterId'>>): void {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const setClauses = keys.map(key => `${key} = ?`).join(', ');
  const values = keys.map(key => (updates as any)[key]);
  values.push(courseId);

  const stmt = db.prepare(`UPDATE courses SET ${setClauses} WHERE id = ?`);
  stmt.run(...values);
}

export function deleteCourse(courseId: string): void {
  db.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
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

// Helper to find assignment by title inside the current active semester
export function findAssignmentInCurrentSemester(title: string): Assignment | null {
  const current = getCurrentSemester();
  if (!current) return null;
  const stmt = db.prepare(`
    SELECT a.* FROM assignments a
    JOIN courses c ON a.courseId = c.id
    WHERE a.title LIKE ? AND c.semesterId = ?
  `);
  return (stmt.get(title, current.id) as Assignment) || null;
}

export function updateAssignment(assignmentId: string, updates: Partial<Omit<Assignment, 'id' | 'courseId'>>): void {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const setClauses = keys.map(key => `${key} = ?`).join(', ');
  const values = keys.map(key => (updates as any)[key]);
  values.push(assignmentId);

  const stmt = db.prepare(`UPDATE assignments SET ${setClauses} WHERE id = ?`);
  stmt.run(...values);
}

export function deleteAssignment(assignmentId: string): void {
  db.prepare('DELETE FROM assignments WHERE id = ?').run(assignmentId);
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

// Helper to find task by title inside the current active semester
export function findTaskInCurrentSemester(title: string): Task | null {
  const current = getCurrentSemester();
  if (!current) return null;
  const stmt = db.prepare(`
    SELECT t.* FROM tasks t
    JOIN assignments a ON t.assignmentId = a.id
    JOIN courses c ON a.courseId = c.id
    WHERE t.title LIKE ? AND c.semesterId = ?
  `);
  return (stmt.get(title, current.id) as Task) || null;
}

export function setTaskCompletion(taskId: string, completed: number): void {
  const stmt = db.prepare('UPDATE tasks SET completed = ? WHERE id = ?');
  stmt.run(completed, taskId);
}

export function updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'assignmentId'>>): void {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const setClauses = keys.map(key => `${key} = ?`).join(', ');
  const values = keys.map(key => (updates as any)[key]);
  values.push(taskId);

  const stmt = db.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ?`);
  stmt.run(...values);
}

export function deleteTask(taskId: string): void {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
}


// Scheduler Query Helper (limited to current active semester)
export function getPendingTasksWithPriority(): TaskItem[] {
  const current = getCurrentSemester();
  if (!current) return [];
  
  const stmt = db.prepare(`
    SELECT t.id, t.title, t.estimatedMinutes, a.priority, c.name as courseName
    FROM tasks t
    JOIN assignments a ON t.assignmentId = a.id
    JOIN courses c ON a.courseId = c.id
    WHERE t.completed = 0 AND c.semesterId = ?
  `);
  return stmt.all(current.id) as TaskItem[];
}
