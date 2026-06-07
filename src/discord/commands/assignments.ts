import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { getAssignmentsByCourse, findCourseByName } from '../../db/queries';
import { db } from '../../db/init';

const assignmentsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('assignments')
    .setDescription('List all assignments or filter by course')
    .addStringOption(option =>
      option.setName('course')
        .setDescription('Filter by course name')
        .setRequired(false)
    ),
  async execute(interaction) {
    const courseName = interaction.options.getString('course');

    // 1. Filter by specific course
    if (courseName) {
      const course = findCourseByName(courseName);
      if (!course) {
        await interaction.reply({
          content: `Course **${courseName}** was not found. Use \`/courses\` to check available courses.`,
          ephemeral: true
        });
        return;
      }

      const assignments = getAssignmentsByCourse(course.id);
      if (assignments.length === 0) {
        await interaction.reply({
          content: `No assignments registered under course **${course.name}** yet.`,
          ephemeral: false
        });
        return;
      }

      const list = assignments.map(a => {
        const priorityLabel = a.priority === 3 ? '🔴 High' : (a.priority === 2 ? '🟡 Medium' : '🟢 Low');
        return `• **${a.title}**\n  - Due: \`${a.dueDate}\`\n  - Priority: ${priorityLabel}`;
      }).join('\n\n');

      await interaction.reply({
        content: `### Assignments for **${course.name}**:\n\n${list}`,
        ephemeral: false
      });
      return;
    }

    // 2. List all assignments (cross-join courses to print cleanly)
    try {
      const assignmentsWithCourses = db.prepare(`
        SELECT a.title, a.dueDate, a.priority, c.name as courseName 
        FROM assignments a
        JOIN courses c ON a.courseId = c.id
        ORDER BY a.dueDate ASC
      `).all() as { title: string; dueDate: string; priority: number; courseName: string }[];

      if (assignmentsWithCourses.length === 0) {
        await interaction.reply({
          content: 'No assignments registered in the database yet. Use `/addassignment` to add your first one!',
          ephemeral: true
        });
        return;
      }

      const list = assignmentsWithCourses.map(a => {
        const priorityLabel = a.priority === 3 ? '🔴 High' : (a.priority === 2 ? '🟡 Medium' : '🟢 Low');
        return `• **${a.title}** (Course: *${a.courseName}*)\n  - Due: \`${a.dueDate}\`\n  - Priority: ${priorityLabel}`;
      }).join('\n\n');

      await interaction.reply({
        content: `### All Assignments:\n\n${list}`,
        ephemeral: false
      });
    } catch (err) {
      console.error('Error fetching assignments:', err);
      await interaction.reply({
        content: 'Failed to retrieve assignments.',
        ephemeral: true
      });
    }
  },
};

export default assignmentsCommand;
