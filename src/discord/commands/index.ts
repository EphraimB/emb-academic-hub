import ping from './ping';
import courses from './courses';
import task from './task';
import available from './available';
import { Command } from '../types';

export const commandsList: Command[] = [
  ping,
  courses,
  task,
  available
];
