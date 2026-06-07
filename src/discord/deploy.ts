import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { commandsList } from './commands';

// Load environment variables
dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('Error: DISCORD_TOKEN and CLIENT_ID are required in environment variables.');
  process.exit(1);
}

const commandsJSON = commandsList.map(command => command.data.toJSON());
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`Started refreshing ${commandsJSON.length} application (/) commands.`);

    if (guildId) {
      console.log(`Targeting Guild ID: ${guildId} (Instant propagation)`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsJSON }
      );
      console.log(`Successfully reloaded application (/) commands for guild: ${guildId}`);
    } else {
      console.log('Targeting Global Commands (Can take up to an hour to propagate)');
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commandsJSON }
      );
      console.log('Successfully reloaded application (/) commands globally.');
    }
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
})();
