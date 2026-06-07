import ping from './ping';
import course from './course';
import task from './task';
import available from './available';
import semester from './semester';
import assignment from './assignment';
import today from './today';
import { Command } from '../types';

export const commandsList: Command[] = [
  ping,
  course,
  task,
  available,
  semester,
  assignment,
  today
];


