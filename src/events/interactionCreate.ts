import { Events, Interaction } from 'discord.js';
import { Event } from '../types';

const interactionCreateEvent: Event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
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
      const responsePayload = { content: 'There was an error while executing this command!', ephemeral: true };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(responsePayload);
      } else {
        await interaction.reply(responsePayload);
      }
    }
  },
};

export default interactionCreateEvent;
