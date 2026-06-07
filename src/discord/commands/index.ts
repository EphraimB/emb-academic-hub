import ping from './ping';
import available from './available';
import { Command } from '../types';

export const commandsList: Command[] = [
  ping,
  available
];
