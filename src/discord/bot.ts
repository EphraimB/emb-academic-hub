import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { commandsList } from './commands';
import { eventsList } from './events';

export async function startBot(token: string): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
    ],
  });

  client.commands = new Collection();

  // Register commands
  for (const command of commandsList) {
    client.commands.set(command.data.name, command);
  }

  // Register events
  for (const event of eventsList) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }

  await client.login(token);
  return client;
}
