import { SlashCommandBuilder, AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { randomUUID } from 'crypto';
import { Command } from '../types';
import { 
  addAssignment, 
  getAssignmentsByCourse, 
  findCourseInCurrentSemester, 
  getCurrentSemester, 
  updateAssignment, 
  deleteAssignment 
} from '../../db/queries';
import { db } from '../../db/init';

const assignmentCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('assignment')
    .setDescription('Manage assignments')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new assignment')
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
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all assignments or filter by course')
        .addStringOption(option =>
          option.setName('course')
            .setDescription('Filter by course name')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit details of an assignment')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Select the assignment to edit')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option.setName('title')
            .setDescription('New assignment title')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('due-date')
            .setDescription('New due date in YYYY-MM-DD format')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('priority')
            .setDescription('New priority level')
            .setRequired(false)
            .addChoices(
              { name: 'Low (1)', value: 1 },
              { name: 'Medium (2)', value: 2 },
              { name: 'High (3)', value: 3 }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete an assignment and all associated tasks')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Select the assignment to delete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const semester = getCurrentSemester();

    if (!semester) {
      await interaction.reply({
        content: 'No semester is active. Use \`/semester switch\` to activate one.',
        flags: ['Ephemeral'] as any
      });
      return;
    }

    // ==========================================
    // SUBCOMMAND: /assignment create
    // ==========================================
    if (subcommand === 'create') {
      const courseName = interaction.options.getString('course', true);
      const title = interaction.options.getString('title', true);
      const dueDate = interaction.options.getString('due-date', true);
      const priority = interaction.options.getInteger('priority', true);

      // 1. Resolve Course in current active semester
      const course = findCourseInCurrentSemester(courseName);
      if (!course) {
        await interaction.reply({
          content: `Error: Course **${courseName}** was not found in the current active semester (${semester.name}).`,
          flags: ['Ephemeral'] as any
        });
        return;
      }

      // 2. Validate Date Format YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dueDate)) {
        await interaction.reply({
          content: `Error: Due date **${dueDate}** must be in YYYY-MM-DD format.`,
          flags: ['Ephemeral'] as any
        });
        return;
      }

      // 3. Add to DB
      const id = randomUUID();
      try {
        addAssignment({
          id,
          courseId: course.id,
          title,
          dueDate,
          priority
        });

        const priorityLabel = priority === 3 ? 'High' : (priority === 2 ? 'Medium' : 'Low');
        await interaction.reply({
          content: `Successfully created assignment **${title}** under course **${course.name}**!\n• Due Date: \`${dueDate}\`\n• Priority: \`${priorityLabel}\``
        });
      } catch (err) {
        console.error('Error adding assignment:', err);
        await interaction.reply({
          content: 'Failed to create assignment.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /assignment list
    // ==========================================
    if (subcommand === 'list') {
      const courseName = interaction.options.getString('course');

      if (courseName) {
        // List assignments for a specific course in the active semester
        const course = findCourseInCurrentSemester(courseName);
        if (!course) {
          await interaction.reply({
            content: `Course **${courseName}** was not found in the current active semester (${semester.name}).`,
            flags: ['Ephemeral'] as any
          });
          return;
        }

        const assignments = getAssignmentsByCourse(course.id);
        if (assignments.length === 0) {
          await interaction.reply({
            content: `No assignments registered under course **${course.name}**.`
          });
          return;
        }

        const list = assignments.map(a => {
          const priorityLabel = a.priority === 3 ? '🔴 High' : (a.priority === 2 ? '🟡 Medium' : '🟢 Low');
          return `• **${a.title}**\n  - Due: \`${a.dueDate}\`\n  - Priority: ${priorityLabel}`;
        }).join('\n\n');

        await interaction.reply({
          content: `### Assignments for **${course.name}** (*${semester.name}*):\n\n${list}`
        });
      } else {
        // List all assignments in the active semester grouped by course name
        try {
          const assignmentsWithCourses = db.prepare(`
            SELECT a.title, a.dueDate, a.priority, c.name as courseName 
            FROM assignments a
            JOIN courses c ON a.courseId = c.id
            WHERE c.semesterId = ?
            ORDER BY a.dueDate ASC
          `).all(semester.id) as { title: string; dueDate: string; priority: number; courseName: string }[];

          if (assignmentsWithCourses.length === 0) {
            await interaction.reply({
              content: `No assignments registered in the active semester **${semester.name}** yet. Use \`/assignment create\` to add one!`,
              flags: ['Ephemeral'] as any
            });
            return;
          }

          // Group assignments by courseName
          const grouped: Record<string, typeof assignmentsWithCourses> = {};
          for (const a of assignmentsWithCourses) {
            if (!grouped[a.courseName]) {
              grouped[a.courseName] = [];
            }
            grouped[a.courseName].push(a);
          }

          let output = `### Academic Assignments for **${semester.name}**:\n\n`;
          for (const [course, courseAssignments] of Object.entries(grouped)) {
            output += `📚 **${course}**\n`;
            output += courseAssignments.map(a => {
              const priorityLabel = a.priority === 3 ? '🔴' : (a.priority === 2 ? '🟡' : '🟢');
              return `  - ${priorityLabel} **${a.title}** (Due: \`${a.dueDate}\`)`;
            }).join('\n') + '\n\n';
          }

          await interaction.reply({
            content: output
          });
        } catch (err) {
          console.error('Error fetching assignments:', err);
          await interaction.reply({
            content: 'Failed to retrieve assignments.',
            flags: ['Ephemeral'] as any
          });
        }
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /assignment edit
    // ==========================================
    if (subcommand === 'edit') {
      const assignmentId = interaction.options.getString('id', true);
      const title = interaction.options.getString('title');
      const dueDate = interaction.options.getString('due-date');
      const priority = interaction.options.getInteger('priority');

      // Verify assignment exists in active semester
      const assignment = db.prepare(`
        SELECT a.title FROM assignments a
        JOIN courses c ON a.courseId = c.id
        WHERE a.id = ? AND c.semesterId = ?
      `).get(assignmentId, semester.id) as { title: string } | undefined;

      if (!assignment) {
        await interaction.reply({
          content: 'Error: Selected assignment was not found in the current active semester.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      const updates: any = {};
      if (title) updates.title = title;
      if (priority !== null && priority !== undefined) updates.priority = priority;

      if (dueDate) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dueDate)) {
          await interaction.reply({
            content: `Error: Due date **${dueDate}** must be in YYYY-MM-DD format.`,
            flags: ['Ephemeral'] as any
          });
          return;
        }
        updates.dueDate = dueDate;
      }

      if (Object.keys(updates).length === 0) {
        await interaction.reply({
          content: 'No updates specified. Use options to update fields.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      try {
        updateAssignment(assignmentId, updates);
        await interaction.reply({
          content: `Successfully updated details for assignment **${assignment.title}**! ✏9;`
        });
      } catch (err) {
        console.error('Error updating assignment:', err);
        await interaction.reply({
          content: 'Failed to update assignment.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /assignment delete
    // ==========================================
    if (subcommand === 'delete') {
      const assignmentId = interaction.options.getString('id', true);

      // Verify assignment exists in active semester
      const assignment = db.prepare(`
        SELECT a.title FROM assignments a
        JOIN courses c ON a.courseId = c.id
        WHERE a.id = ? AND c.semesterId = ?
      `).get(assignmentId, semester.id) as { title: string } | undefined;

      if (!assignment) {
        await interaction.reply({
          content: 'Error: Selected assignment was not found in the current active semester.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      try {
        deleteAssignment(assignmentId);
        await interaction.reply({
          content: `Successfully deleted assignment **${assignment.title}** and all of its associated tasks! 🗑️`
        });
      } catch (err) {
        console.error('Error deleting assignment:', err);
        await interaction.reply({
          content: 'Failed to delete assignment.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const semester = getCurrentSemester();

    if (!semester) {
      await interaction.respond([]);
      return;
    }

    try {
      // Find all assignments associated with courses inside the current active semester
      const assignments = db.prepare(`
        SELECT a.id, a.title, c.name as courseName 
        FROM assignments a
        JOIN courses c ON a.courseId = c.id
        WHERE c.semesterId = ?
      `).all(semester.id) as { id: string; title: string; courseName: string }[];

      // Filter based on input
      const filtered = assignments
        .filter(a => a.title.toLowerCase().includes(focusedValue.toLowerCase()))
        .map(a => {
          const name = `${a.title} [${a.courseName}]`;
          const displayName = name.length > 100 ? name.substring(0, 97) + '...' : name;
          return {
            name: displayName,
            value: a.id
          };
        })
        .slice(0, 25);

      await interaction.respond(filtered);
    } catch (err) {
      console.error('Error resolving autocomplete options:', err);
      await interaction.respond([]);
    }
  }
};

export default assignmentCommand;
