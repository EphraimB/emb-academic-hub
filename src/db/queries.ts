import { db } from './init';

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
