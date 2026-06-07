import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { parseTimeToMinutes, getBestTaskCombination } from '../../core/scheduler';
import { getPendingTasksWithPriority } from '../../db/queries';

const availableCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('available')
    .setDescription('Find the best combination of tasks that fit in your available time')
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Available time (e.g. 30m, 1.5h, 45)')
        .setRequired(true)
    ),
  async execute(interaction) {
    const timeInput = interaction.options.getString('time', true);

    // 1. Parse time string to numerical minutes
    const minutes = parseTimeToMinutes(timeInput);
    if (minutes === null || minutes <= 0) {
      await interaction.reply({
        content: `Error: Invalid time format **"${timeInput}"**. Please use formats like \`30m\`, \`1.5h\`, \`1h 30m\`, or simply a number of minutes like \`45\`.`,
        flags: ['Ephemeral'] as any
      });
      return;
    }

    // 2. Fetch pending tasks from database
    const pendingTasks = getPendingTasksWithPriority();
    if (pendingTasks.length === 0) {
      await interaction.reply({
        content: 'You have no pending tasks to schedule! 🎉'
      });
      return;
    }

    // 3. Compute optimal task combination
    const recommended = getBestTaskCombination(minutes, pendingTasks);
    if (recommended.length === 0) {
      const minDuration = Math.min(...pendingTasks.map(t => t.estimatedMinutes));
      await interaction.reply({
        content: `None of your pending tasks fit in your available time of **${minutes} minutes** (your shortest pending task is **${minDuration}m**). Try setting a larger time window or adding shorter task steps!`
      });
      return;
    }

    // 4. Format and display recommendation list
    const totalMinutes = recommended.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const list = recommended.map(t => {
      const priorityLabel = t.priority === 3 ? '🔴' : (t.priority === 2 ? '🟡' : '🟢');
      return `• ${priorityLabel} **${t.title}** (\`${t.estimatedMinutes}m\`) [Course: *${t.courseName}*]`;
    }).join('\n');

    await interaction.reply({
      content: `### ⏱️ Recommended Study Plan for **${timeInput}** (${minutes} mins):\n\n${list}\n\n📊 Total Study Time: **${totalMinutes} / ${minutes} minutes**`
    });
  },
};

export default availableCommand;
