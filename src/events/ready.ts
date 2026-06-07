import { Events, Client } from 'discord.js';
import { Event } from '../types';

const readyEvent: Event = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    if (!client.user) return;
    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};

export default readyEvent;
