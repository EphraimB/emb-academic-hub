import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { updateCommuteStatus } from '../../features/commute';

const availableCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('available')
    .setDescription('Set your availability status')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Your current status')
        .setRequired(true)
        .addChoices(
          { name: 'Available', value: 'available' },
          { name: 'Busy', value: 'busy' },
          { name: 'Away', value: 'away' }
        )
    ),
  async execute(interaction) {
    const status = interaction.options.getString('status', true) as 'available' | 'busy' | 'away';
    const userId = interaction.user.id;
    const username = interaction.user.username;

    // Pass the input to the business logic feature layer
    updateCommuteStatus(userId, username, status);

    await interaction.reply({
      content: `Your status has been updated to **${status}**!`,
      ephemeral: true
    });
  },
};

export default availableCommand;
