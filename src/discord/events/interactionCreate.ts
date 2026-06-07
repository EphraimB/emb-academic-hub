import { Events, Interaction } from 'discord.js';
import { Event } from '../types';

const interactionCreateEvent: Event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        if (command.autocomplete) {
          await command.autocomplete(interaction);
        }
      } catch (error) {
        console.error(`Error running autocomplete for command ${interaction.commandName}:`, error);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      const responsePayload = { content: 'There was an error while executing this command!', flags: ['Ephemeral'] as any };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(responsePayload);
      } else {
        await interaction.reply(responsePayload);
      }
    }
  },
};

export default interactionCreateEvent;
