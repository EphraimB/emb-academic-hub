import { Client, Collection, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import { commandsList } from './commands';
import { eventsList } from './events';

// Load environment variables from .env
dotenv.config();

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Error: DISCORD_TOKEN is missing in environment variables.');
  process.exit(1);
}

// Create a new client instance
// For basic slash commands, Guilds intent is sufficient.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// Initialize the commands collection
client.commands = new Collection();

// Register commands in the client
for (const command of commandsList) {
  client.commands.set(command.data.name, command);
}

// Register event listeners
for (const event of eventsList) {
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Log in to Discord
client.login(token);
