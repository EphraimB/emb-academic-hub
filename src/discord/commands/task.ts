import { SlashCommandBuilder, AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { randomUUID } from 'crypto';
import { Command } from '../types';
import { 
  findCourseInCurrentSemester, 
  addAssignment, 
  addTask, 
  setTaskCompletion, 
  getAllSemesters, 
  getCurrentSemester,
  addSemester, 
  addCourse 
} from '../../db/queries';
import { db } from '../../db/init';

const taskCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('task')
    .setDescription('Manage academic tasks')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a task under a course')
        .addStringOption(option =>
          option.setName('course')
            .setDescription('Course name (e.g. Calculus 2)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Task title (e.g. Read Chapter 4)')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('minutes')
            .setDescription('Estimated duration in minutes')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List tasks')
        .addStringOption(option =>
          option.setName('course')
            .setDescription('Filter by course name')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('done')
        .setDescription('Mark a task as completed')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Select the task to complete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a task from the database')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Select the task to delete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    // ==========================================
    // SUBCOMMAND: /task add
    // ==========================================
    if (subcommand === 'add') {
      const courseName = interaction.options.getString('course', true);
      const title = interaction.options.getString('title', true);
      const minutes = interaction.options.getInteger('minutes', true);

      // 1. Resolve Active Semester (create if missing)
      let semester = getCurrentSemester();
      let semesterId = '';
      if (semester) {
        semesterId = semester.id;
      } else {
        semesterId = randomUUID();
        try {
          addSemester(semesterId, 'General Semester', 1); // 1 = isCurrent
          semester = getCurrentSemester();
        } catch (err) {
          console.error('Error creating default semester:', err);
          await interaction.reply({
            content: 'Failed to initialize default academic semester.',
            flags: ['Ephemeral'] as any
          });
          return;
        }
      }

      if (!semester) {
        await interaction.reply({
          content: 'No active semester set.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      // 2. Resolve Course in current semester (or auto-create)
      let course = findCourseInCurrentSemester(courseName);
      if (!course) {
        const courseId = randomUUID();
        try {
          addCourse({
            id: courseId,
            semesterId: semester.id,
            name: courseName,
            meetingDays: JSON.stringify([1, 3, 5]), // Default MWF
            startTime: 600, // Default 10:00 AM
            endTime: 690, // Default 11:30 AM
            location: 'N/A'
          });
          course = findCourseInCurrentSemester(courseName);
        } catch (err) {
          console.error('Error auto-creating course:', err);
        }
      }

      if (!course) {
        await interaction.reply({
          content: `Failed to resolve or auto-create course **${courseName}** under semester **${semester.name}**.`,
          flags: ['Ephemeral'] as any
        });
        return;
      }

      // 3. Resolve or Create Default Assignment ("General Tasks")
      let assignment = db.prepare('SELECT id FROM assignments WHERE courseId = ? AND title = ?')
        .get(course.id, 'General Tasks') as { id: string } | undefined;
      
      let assignmentId = '';
      if (assignment) {
        assignmentId = assignment.id;
      } else {
        assignmentId = randomUUID();
        try {
          addAssignment({
            id: assignmentId,
            courseId: course.id,
            title: 'General Tasks',
            dueDate: new Date().toISOString().split('T')[0], // Today
            priority: 2 // Medium
          });
        } catch (err) {
          console.error('Error creating default assignment:', err);
          await interaction.reply({
            content: 'Failed to initialize general tasks list for this course.',
            flags: ['Ephemeral'] as any
          });
          return;
        }
      }

      // 4. Insert Task
      const taskId = randomUUID();
      try {
        addTask({
          id: taskId,
          assignmentId,
          title,
          estimatedMinutes: minutes,
          completed: 0
        });

        await interaction.reply({
          content: `Successfully added task **${title}** under course **${course.name}**!\n• Duration: \`${minutes} mins\``
        });
      } catch (err) {
        console.error('Error adding task:', err);
        await interaction.reply({
          content: 'Failed to create the task.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /task list
    // ==========================================
    if (subcommand === 'list') {
      const courseName = interaction.options.getString('course');
      const semester = getCurrentSemester();
      
      if (!semester) {
        await interaction.reply({
          content: 'No semester is active. Use \`/semester switch\` to activate one.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      if (courseName) {
        // List tasks for specific course in current active semester
        const course = findCourseInCurrentSemester(courseName);
        if (!course) {
          await interaction.reply({
            content: `Course **${courseName}** was not found in the current active semester (${semester.name}).`,
            flags: ['Ephemeral'] as any
          });
          return;
        }

        const tasks = db.prepare(`
          SELECT t.title, t.estimatedMinutes, t.completed 
          FROM tasks t 
          JOIN assignments a ON t.assignmentId = a.id 
          WHERE a.courseId = ?
        `).all(course.id) as { title: string; estimatedMinutes: number; completed: number }[];

        if (tasks.length === 0) {
          await interaction.reply({
            content: `No tasks found for course **${course.name}**.`
          });
          return;
        }

        const list = tasks.map(t => {
          const statusIcon = t.completed === 1 ? '✅ Completed' : '❌ Pending';
          return `• **${t.title}**\n  - Duration: \`${t.estimatedMinutes} mins\`\n  - Status: ${statusIcon}`;
        }).join('\n\n');

        await interaction.reply({
          content: `### Tasks for **${course.name}** (*${semester.name}*):\n\n${list}`
        });
      } else {
        // List all tasks in current active semester grouped by course name
        const tasks = db.prepare(`
          SELECT t.title, t.estimatedMinutes, t.completed, c.name as courseName
          FROM tasks t
          JOIN assignments a ON t.assignmentId = a.id
          JOIN courses c ON a.courseId = c.id
          WHERE c.semesterId = ?
          ORDER BY c.name ASC
        `).all(semester.id) as { title: string; estimatedMinutes: number; completed: number; courseName: string }[];

        if (tasks.length === 0) {
          await interaction.reply({
            content: `No tasks registered in the active semester **${semester.name}** yet. Use \`/task add\` to add your first one!`,
            flags: ['Ephemeral'] as any
          });
          return;
        }

        // Group tasks by courseName
        const grouped: Record<string, typeof tasks> = {};
        for (const t of tasks) {
          if (!grouped[t.courseName]) {
            grouped[t.courseName] = [];
          }
          grouped[t.courseName].push(t);
        }

        let output = `### Academic Tasks for **${semester.name}**:\n\n`;
        for (const [course, courseTasks] of Object.entries(grouped)) {
          output += `📚 **${course}**\n`;
          output += courseTasks.map(t => {
            const status = t.completed === 1 ? '✅' : '❌';
            return `  - [${status}] **${t.title}** (\`${t.estimatedMinutes}m\`)`;
          }).join('\n') + '\n\n';
        }

        await interaction.reply({
          content: output
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /task done
    // ==========================================
    if (subcommand === 'done') {
      const taskId = interaction.options.getString('id', true);
      const semester = getCurrentSemester();

      if (!semester) {
        await interaction.reply({
          content: 'No semester is currently active.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      // Verify task exists in active semester
      const task = db.prepare(`
        SELECT t.title FROM tasks t 
        JOIN assignments a ON t.assignmentId = a.id
        JOIN courses c ON a.courseId = c.id
        WHERE t.id = ? AND c.semesterId = ?
      `).get(taskId, semester.id) as { title: string } | undefined;

      if (!task) {
        await interaction.reply({
          content: 'Error: Selected task was not found or is in another semester.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      try {
        setTaskCompletion(taskId, 1);
        await interaction.reply({
          content: `Successfully marked task **${task.title}** as Completed! ✅`
        });
      } catch (err) {
        console.error('Error completing task:', err);
        await interaction.reply({
          content: 'Failed to mark task as completed.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /task delete
    // ==========================================
    if (subcommand === 'delete') {
      const taskId = interaction.options.getString('id', true);
      const semester = getCurrentSemester();

      if (!semester) {
        await interaction.reply({
          content: 'No semester is currently active.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      // Verify task exists in active semester
      const task = db.prepare(`
        SELECT t.title FROM tasks t 
        JOIN assignments a ON t.assignmentId = a.id
        JOIN courses c ON a.courseId = c.id
        WHERE t.id = ? AND c.semesterId = ?
      `).get(taskId, semester.id) as { title: string } | undefined;

      if (!task) {
        await interaction.reply({
          content: 'Error: Selected task was not found.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      try {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
        await interaction.reply({
          content: `Successfully deleted task **${task.title}**! 🗑️`
        });
      } catch (err) {
        console.error('Error deleting task:', err);
        await interaction.reply({
          content: 'Failed to delete task.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const subcommand = interaction.options.getSubcommand();
    const semester = getCurrentSemester();

    if (!semester) {
      await interaction.respond([]);
      return;
    }

    try {
      // Find all tasks associated with courses inside the current active semester
      const query = subcommand === 'done'
        ? `SELECT t.id, t.title, c.name as courseName 
           FROM tasks t
           JOIN assignments a ON t.assignmentId = a.id
           JOIN courses c ON a.courseId = c.id
           WHERE t.completed = 0 AND c.semesterId = ?`
        : `SELECT t.id, t.title, c.name as courseName 
           FROM tasks t
           JOIN assignments a ON t.assignmentId = a.id
           JOIN courses c ON a.courseId = c.id
           WHERE c.semesterId = ?`;

      const tasks = db.prepare(query).all(semester.id) as { id: string; title: string; courseName: string }[];

      // Filter based on input
      const filtered = tasks
        .filter(t => t.title.toLowerCase().includes(focusedValue.toLowerCase()))
        .map(t => {
          const name = `${t.title} [${t.courseName}]`;
          const displayName = name.length > 100 ? name.substring(0, 97) + '...' : name;
          return {
            name: displayName,
            value: t.id
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

export default taskCommand;
