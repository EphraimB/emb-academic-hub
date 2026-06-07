import { SlashCommandBuilder } from 'discord.js';
import { randomUUID } from 'crypto';
import { Command } from '../types';
import { addTask, findAssignmentByTitle } from '../../db/queries';

const addTaskCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('addtask')
    .setDescription('Add a task/actionable step under an assignment')
    .addStringOption(option =>
      option.setName('assignment')
        .setDescription('Assignment title (e.g. Homework 3)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Task description/step (e.g. Read section 4.1)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('minutes')
        .setDescription('Estimated duration in minutes')
        .setRequired(true)
    ),
  async execute(interaction) {
    const assignmentTitle = interaction.options.getString('assignment', true);
    const title = interaction.options.getString('title', true);
    const estimatedMinutes = interaction.options.getInteger('minutes', true);

    // 1. Resolve assignment
    const assignment = findAssignmentByTitle(assignmentTitle);
    if (!assignment) {
      await interaction.reply({
        content: `Error: Assignment **${assignmentTitle}** was not found. Please create it first using \`/addassignment\`.`,
        ephemeral: true
      });
      return;
    }

    // 2. Add to Database
    const id = randomUUID();
    try {
      addTask({
        id,
        assignmentId: assignment.id,
        title,
        estimatedMinutes,
        completed: 0 // Initialize as uncompleted
      });

      await interaction.reply({
        content: `Successfully added task **${title}** under assignment **${assignment.title}**!\n• Estimated Duration: \`${estimatedMinutes} mins\``,
        ephemeral: false
      });
    } catch (err) {
      console.error('Error adding task:', err);
      await interaction.reply({
        content: 'Failed to add task. Please try again.',
        ephemeral: true
      });
    }
  },
};

export default addTaskCommand;
