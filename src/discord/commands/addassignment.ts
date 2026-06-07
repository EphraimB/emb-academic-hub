import { SlashCommandBuilder } from 'discord.js';
import { randomUUID } from 'crypto';
import { Command } from '../types';
import { addAssignment, findCourseByName } from '../../db/queries';

const addAssignmentCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('addassignment')
    .setDescription('Add a new assignment under a course')
    .addStringOption(option =>
      option.setName('course')
        .setDescription('Course name (e.g. Calculus 2)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Assignment title (e.g. Homework 3)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('due-date')
        .setDescription('Due date in YYYY-MM-DD format (e.g. 2026-06-15)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('priority')
        .setDescription('Priority level')
        .setRequired(true)
        .addChoices(
          { name: 'Low (1)', value: 1 },
          { name: 'Medium (2)', value: 2 },
          { name: 'High (3)', value: 3 }
        )
    ),
  async execute(interaction) {
    const courseName = interaction.options.getString('course', true);
    const title = interaction.options.getString('title', true);
    const dueDate = interaction.options.getString('due-date', true);
    const priority = interaction.options.getInteger('priority', true);

    // 1. Resolve course
    const course = findCourseByName(courseName);
    if (!course) {
      await interaction.reply({
        content: `Error: Course **${courseName}** was not found. Please create it first using \`/addcourse\`.`,
        ephemeral: true
      });
      return;
    }

    // 2. Validate date format (simple YYYY-MM-DD regex check)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dueDate)) {
      await interaction.reply({
        content: `Error: Due date **${dueDate}** must be in YYYY-MM-DD format.`,
        ephemeral: true
      });
      return;
    }

    // 3. Add to Database
    const id = randomUUID();
    try {
      addAssignment({
        id,
        courseId: course.id,
        title,
        dueDate,
        priority
      });

      const priorityLabel = priority === 3 ? 'High (3)' : (priority === 2 ? 'Medium (2)' : 'Low (1)');
      await interaction.reply({
        content: `Successfully added assignment **${title}** under course **${course.name}**!\n• Due Date: \`${dueDate}\`\n• Priority: \`${priorityLabel}\``,
        ephemeral: false
      });
    } catch (err) {
      console.error('Error adding assignment:', err);
      await interaction.reply({
        content: 'Failed to add assignment. Please try again.',
        ephemeral: true
      });
    }
  },
};

export default addAssignmentCommand;
