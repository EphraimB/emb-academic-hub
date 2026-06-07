import ping from './ping';
import addcourse from './addcourse';
import courses from './courses';
import addassignment from './addassignment';
import assignments from './assignments';
import addtask from './addtask';
import tasks from './tasks';
import completetask from './completetask';
import { Command } from '../types';

export const commandsList: Command[] = [
  ping,
  addcourse,
  courses,
  addassignment,
  assignments,
  addtask,
  tasks,
  completetask
];
