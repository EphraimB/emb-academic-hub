import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { getTasksByAssignment, findAssignmentByTitle } from '../../db/queries';
import { db } from '../../db/init';

const tasksCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('tasks')
    .setDescription('List all tasks or filter by assignment')
    .addStringOption(option =>
      option.setName('assignment')
        .setDescription('Filter by assignment title')
        .setRequired(false)
    ),
  async execute(interaction) {
    const assignmentTitle = interaction.options.getString('assignment');

    // 1. Filter by specific assignment
    if (assignmentTitle) {
      const assignment = findAssignmentByTitle(assignmentTitle);
      if (!assignment) {
        await interaction.reply({
          content: `Assignment **${assignmentTitle}** was not found. Use \`/assignments\` to check available assignments.`,
          ephemeral: true
        });
        return;
      }

      const tasks = getTasksByAssignment(assignment.id);
      if (tasks.length === 0) {
        await interaction.reply({
          content: `No tasks registered under assignment **${assignment.title}** yet.`,
          ephemeral: false
        });
        return;
      }

      const list = tasks.map(t => {
        const statusIcon = t.completed === 1 ? '✅ Completed' : '❌ Pending';
        return `• **${t.title}**\n  - Duration: \`${t.estimatedMinutes} mins\`\n  - Status: ${statusIcon}`;
      }).join('\n\n');

      await interaction.reply({
        content: `### Tasks for **${assignment.title}**:\n\n${list}`,
        ephemeral: false
      });
      return;
    }

    // 2. List all tasks (cross-join assignments to print cleanly)
    try {
      const tasksWithAssignments = db.prepare(`
        SELECT t.title, t.estimatedMinutes, t.completed, a.title as assignmentTitle 
        FROM tasks t
        JOIN assignments a ON t.assignmentId = a.id
        ORDER BY a.title ASC
      `).all() as { title: string; estimatedMinutes: number; completed: number; assignmentTitle: string }[];

      if (tasksWithAssignments.length === 0) {
        await interaction.reply({
          content: 'No tasks registered in the database yet. Use `/addtask` to add your first one!',
          ephemeral: true
        });
        return;
      }

      const list = tasksWithAssignments.map(t => {
        const statusIcon = t.completed === 1 ? '✅ Completed' : '❌ Pending';
        return `• **${t.title}** (Assignment: *${t.assignmentTitle}*)\n  - Duration: \`${t.estimatedMinutes} mins\`\n  - Status: ${statusIcon}`;
      }).join('\n\n');

      await interaction.reply({
        content: `### All Tasks:\n\n${list}`,
        ephemeral: false
      });
    } catch (err) {
      console.error('Error fetching tasks:', err);
      await interaction.reply({
        content: 'Failed to retrieve tasks.',
        ephemeral: true
      });
    }
  },
};

export default tasksCommand;
