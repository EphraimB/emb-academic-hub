import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { findTaskByTitle, setTaskCompletion } from '../../db/queries';

const completeTaskCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('completetask')
    .setDescription('Mark a task step as completed or pending')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('The task title/description')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('status')
        .setDescription('Set completion status')
        .setRequired(true)
        .addChoices(
          { name: 'Completed ✅', value: 1 },
          { name: 'Pending ❌', value: 0 }
        )
    ),
  async execute(interaction) {
    const title = interaction.options.getString('title', true);
    const status = interaction.options.getInteger('status', true);

    // 1. Resolve task
    const task = findTaskByTitle(title);
    if (!task) {
      await interaction.reply({
        content: `Error: Task **${title}** was not found. Use \`/tasks\` to view tasks.`,
        ephemeral: true
      });
      return;
    }

    // 2. Update completion status
    try {
      setTaskCompletion(task.id, status);
      const statusText = status === 1 ? 'Completed ✅' : 'Pending ❌';
      
      await interaction.reply({
        content: `Successfully updated task **${task.title}** status to **${statusText}**!`,
        ephemeral: false
      });
    } catch (err) {
      console.error('Error updating task status:', err);
      await interaction.reply({
        content: 'Failed to update task status.',
        ephemeral: true
      });
    }
  },
};

export default completeTaskCommand;
