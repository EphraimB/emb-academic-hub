import { SlashCommandBuilder, AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { randomUUID } from 'crypto';
import { Command } from '../types';
import { 
  addCourse, 
  getCoursesBySemester, 
  getAllSemesters, 
  getCurrentSemester, 
  findSemesterByName,
  updateCourse,
  deleteCourse,
  addSemester
} from '../../db/queries';
import { db } from '../../db/init';

const courseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('course')
    .setDescription('Manage courses')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new course')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Course name (e.g. Calculus 2)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('days')
            .setDescription('Meeting days (e.g. 1,3,5 for MWF)')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('start-time')
            .setDescription('Start time in minutes from midnight (default: 600 for 10:00 AM)')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('end-time')
            .setDescription('End time in minutes from midnight (default: 690 for 11:30 AM)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('location')
            .setDescription('Building and Room number')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all courses in active semester or filter by semester')
        .addStringOption(option =>
          option.setName('semester')
            .setDescription('Semester name to list courses for')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit details of a course')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Select the course to edit')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option.setName('name')
            .setDescription('New course name')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('days')
            .setDescription('Update meeting days (e.g. 1,3 for TTh)')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('start-time')
            .setDescription('Update start time in minutes from midnight')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('end-time')
            .setDescription('Update end time in minutes from midnight')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('location')
            .setDescription('Update location')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a course and all associated assignments/tasks')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Select the course to delete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    // ==========================================
    // SUBCOMMAND: /course create
    // ==========================================
    if (subcommand === 'create') {
      const name = interaction.options.getString('name', true);
      const days = interaction.options.getString('days') || '1,3,5';
      const startTime = interaction.options.getInteger('start-time') ?? 600;
      const endTime = interaction.options.getInteger('end-time') ?? 690;
      const location = interaction.options.getString('location') || 'N/A';

      // 1. Resolve current active semester
      let semester = getCurrentSemester();
      if (!semester) {
        // Create default semester if missing
        const semesterId = randomUUID();
        try {
          addSemester(semesterId, 'General Semester', 1); // 1 = isCurrent
          semester = getCurrentSemester();
        } catch (err) {
          console.error('Error auto-creating default semester:', err);
          await interaction.reply({
            content: 'Failed to initialize default active semester.',
            flags: ['Ephemeral'] as any
          });
          return;
        }
      }

      if (!semester) {
        await interaction.reply({
          content: 'No active semester is set.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      // 2. Parse meetingDays
      const daysArray = days.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
      const meetingDaysJSON = JSON.stringify(daysArray);

      // 3. Add to Database
      const courseId = randomUUID();
      try {
        addCourse({
          id: courseId,
          semesterId: semester.id,
          name,
          meetingDays: meetingDaysJSON,
          startTime,
          endTime,
          location
        });

        await interaction.reply({
          content: `Successfully created course **${name}** under active semester **${semester.name}**!\n• Location: \`${location}\`\n• Schedule: Days \`${days}\`, \`${startTime}\` to \`${endTime}\` minutes from midnight.`
        });
      } catch (err) {
        console.error('Error creating course:', err);
        await interaction.reply({
          content: 'Failed to create course.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /course list
    // ==========================================
    if (subcommand === 'list') {
      const semesterName = interaction.options.getString('semester');
      let matched: any = null;

      if (semesterName) {
        matched = findSemesterByName(semesterName);
        if (!matched) {
          await interaction.reply({
            content: `Semester **${semesterName}** was not found. Use \`/semester list\` to see registered semesters.`,
            flags: ['Ephemeral'] as any
          });
          return;
        }
      } else {
        matched = getCurrentSemester();
        if (!matched) {
          const semesters = getAllSemesters();
          if (semesters.length === 0) {
            await interaction.reply({
              content: 'No semesters registered in the database yet. Use \`/semester create\` to add one!',
              flags: ['Ephemeral'] as any
            });
            return;
          }

          const list = semesters.map(s => `• **${s.name}**`).join('\n');
          await interaction.reply({
            content: `No active semester is set. Use \`/semester switch\` to select one.\n\n### Registered Semesters:\n${list}`,
            flags: ['Ephemeral'] as any
          });
          return;
        }
      }

      const courses = getCoursesBySemester(matched.id);
      if (courses.length === 0) {
        await interaction.reply({
          content: `No courses registered under semester **${matched.name}** yet. Add your first course using \`/course create\`.`
        });
        return;
      }

      const list = courses.map(c => {
        let daysStr = 'N/A';
        try {
          const days = JSON.parse(c.meetingDays) as number[];
          daysStr = days.join(', ');
        } catch (err) {
          console.error(err);
        }

        const formatTime = (min: number) => {
          const h = Math.floor(min / 60);
          const m = min % 60;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const formattedH = h % 12 === 0 ? 12 : h % 12;
          const formattedM = m < 10 ? `0${m}` : m;
          return `${formattedH}:${formattedM} ${ampm}`;
        };

        const startStr = formatTime(c.startTime);
        const endStr = formatTime(c.endTime);

        return `• **${c.name}**\n  - Location: \`${c.location || 'N/A'}\`\n  - Time: \`${startStr} - ${endStr}\` on days \`[${daysStr}]\``;
      }).join('\n\n');

      await interaction.reply({
        content: `### Courses for semester **${matched.name}**:\n\n${list}`
      });
      return;
    }

    // ==========================================
    // SUBCOMMAND: /course edit
    // ==========================================
    if (subcommand === 'edit') {
      const courseId = interaction.options.getString('id', true);
      const name = interaction.options.getString('name');
      const days = interaction.options.getString('days');
      const startTime = interaction.options.getInteger('start-time');
      const endTime = interaction.options.getInteger('end-time');
      const location = interaction.options.getString('location');

      const course = db.prepare('SELECT name FROM courses WHERE id = ?').get(courseId) as { name: string } | undefined;
      if (!course) {
        await interaction.reply({
          content: 'Error: Course was not found.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      const updates: any = {};
      if (name) updates.name = name;
      if (location) updates.location = location;
      if (startTime !== null && startTime !== undefined) updates.startTime = startTime;
      if (endTime !== null && endTime !== undefined) updates.endTime = endTime;
      
      if (days) {
        const daysArray = days.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
        updates.meetingDays = JSON.stringify(daysArray);
      }

      if (Object.keys(updates).length === 0) {
        await interaction.reply({
          content: 'No updates specified. Use options to update fields.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      try {
        updateCourse(courseId, updates);
        await interaction.reply({
          content: `Successfully updated details for course **${course.name}**! ✏9;`
        });
      } catch (err) {
        console.error('Error updating course:', err);
        await interaction.reply({
          content: 'Failed to update course.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /course delete
    // ==========================================
    if (subcommand === 'delete') {
      const courseId = interaction.options.getString('id', true);

      const course = db.prepare('SELECT name FROM courses WHERE id = ?').get(courseId) as { name: string } | undefined;
      if (!course) {
        await interaction.reply({
          content: 'Error: Course was not found.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      try {
        deleteCourse(courseId);
        await interaction.reply({
          content: `Successfully deleted course **${course.name}** and all associated assignments and tasks! 🗑️`
        });
      } catch (err) {
        console.error('Error deleting course:', err);
        await interaction.reply({
          content: 'Failed to delete course.',
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
      // Find all courses registered under the active semester
      const courses = db.prepare('SELECT id, name FROM courses WHERE semesterId = ?').all(semester.id) as { id: string; name: string }[];
      const filtered = courses
        .filter(c => c.name.toLowerCase().includes(focusedValue.toLowerCase()))
        .map(c => {
          const displayName = c.name.length > 100 ? c.name.substring(0, 97) + '...' : c.name;
          return {
            name: displayName,
            value: c.id
          };
        })
        .slice(0, 25);
      await interaction.respond(filtered);
    } catch (err) {
      console.error('Error autocomplete courses:', err);
      await interaction.respond([]);
    }
  }
};

export default courseCommand;
