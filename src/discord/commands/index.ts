import ping from './ping';
import addcourse from './addcourse';
import courses from './courses';
import { Command } from '../types';

export const commandsList: Command[] = [
  ping,
  addcourse,
  courses
];
