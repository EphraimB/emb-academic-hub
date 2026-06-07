import { 
  SlashCommandBuilder, 
  AutocompleteInteraction, 
  ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js';
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

function parseTimeToMinutes(timeStr: string): number | null {
  const regex = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i;
  const match = timeStr.trim().match(regex);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];

  if (hours < 0 || minutes < 0 || minutes >= 60) return null;

  if (ampm) {
    const ampmUpper = ampm.toUpperCase();
    if (hours < 1 || hours > 12) return null;
    if (ampmUpper === 'PM' && hours !== 12) {
      hours += 12;
    } else if (ampmUpper === 'AM' && hours === 12) {
      hours = 0;
    }
  } else {
    if (hours < 0 || hours >= 24) return null;
  }

  return hours * 60 + minutes;
}

function formatMeetingDays(meetingDaysJson: string): string {
  try {
    const days = JSON.parse(meetingDaysJson) as number[];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const mapped = days.map(d => dayNames[d]);
    
    const sorted = [...days].sort((a, b) => a - b);
    const sortedStr = sorted.join(',');
    if (sortedStr === '1,3,5') return 'Monday, Wednesday, Friday (MWF)';
    if (sortedStr === '2,4') return 'Tuesday, Thursday (TTh)';
    if (sortedStr === '1,3') return 'Monday, Wednesday (MW)';
    
    return mapped.join(', ');
  } catch (err) {
    return 'N/A';
  }
}

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
          option.setName('start-time')
            .setDescription('Start time (e.g. 10:00 AM or 14:30)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('end-time')
            .setDescription('End time (e.g. 11:30 AM or 16:00)')
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
        .addBooleanOption(option =>
          option.setName('change-days')
            .setDescription('Set to True to update the meeting days dropdown menu')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('start-time')
            .setDescription('Update start time (e.g. 10:00 AM or 14:30)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('end-time')
            .setDescription('Update end time (e.g. 11:30 AM or 16:00)')
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
      const startTimeStr = interaction.options.getString('start-time');
      const endTimeStr = interaction.options.getString('end-time');
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

      // 2. Parse times
      let startTime = 600;
      if (startTimeStr) {
        const parsed = parseTimeToMinutes(startTimeStr);
        if (parsed === null) {
          await interaction.reply({
            content: `Error: Invalid start time format **"${startTimeStr}"**. Please use formats like \`10:00 AM\` or \`14:30\`.`,
            flags: ['Ephemeral'] as any
          });
          return;
        }
        startTime = parsed;
      }

      let endTime = 690;
      if (endTimeStr) {
        const parsed = parseTimeToMinutes(endTimeStr);
        if (parsed === null) {
          await interaction.reply({
            content: `Error: Invalid end time format **"${endTimeStr}"**. Please use formats like \`11:30 AM\` or \`16:00\`.`,
            flags: ['Ephemeral'] as any
          });
          return;
        }
        endTime = parsed;
      }

      if (endTime <= startTime) {
        await interaction.reply({
          content: `Error: End time must be after start time.`,
          flags: ['Ephemeral'] as any
        });
        return;
      }

      // 3. Render select menu and button components
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_course_days_create')
        .setPlaceholder('Select meeting days...')
        .setMinValues(1)
        .setMaxValues(7)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Monday').setValue('1'),
          new StringSelectMenuOptionBuilder().setLabel('Tuesday').setValue('2'),
          new StringSelectMenuOptionBuilder().setLabel('Wednesday').setValue('3'),
          new StringSelectMenuOptionBuilder().setLabel('Thursday').setValue('4'),
          new StringSelectMenuOptionBuilder().setLabel('Friday').setValue('5'),
          new StringSelectMenuOptionBuilder().setLabel('Saturday').setValue('6'),
          new StringSelectMenuOptionBuilder().setLabel('Sunday').setValue('0')
        );

      const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_course_days_create')
        .setLabel('Confirm Days')
        .setStyle(ButtonStyle.Success);

      const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton);

      const response = await interaction.reply({
        content: `📚 **Creating Course "${name}":** Select the meeting days using the dropdown below, then click **Confirm Days**:`,
        components: [row1, row2],
        fetchReply: true
      });

      const collector = response.createMessageComponentCollector({
        time: 60000
      });

      let selectedDays: number[] = [];

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: 'Error: Only the user who ran the command can use these controls.',
            flags: ['Ephemeral'] as any
          });
          return;
        }

        if (i.isStringSelectMenu() && i.customId === 'select_course_days_create') {
          selectedDays = i.values.map((v: string) => parseInt(v, 10));
          await i.deferUpdate();
        } else if (i.customId === 'confirm_course_days_create') {
          if (selectedDays.length === 0) {
            await i.reply({
              content: 'Error: You must select at least one day.',
              flags: ['Ephemeral'] as any
            });
            return;
          }

          const meetingDaysJSON = JSON.stringify(selectedDays);
          const courseId = randomUUID();

          try {
            addCourse({
              id: courseId,
              semesterId: semester!.id,
              name,
              meetingDays: meetingDaysJSON,
              startTime,
              endTime,
              location
            });

            const formatTime = (min: number) => {
              const h = Math.floor(min / 60);
              const m = min % 60;
              const ampm = h >= 12 ? 'PM' : 'AM';
              const formattedH = h % 12 === 0 ? 12 : h % 12;
              const formattedM = m < 10 ? `0${m}` : m;
              return `${formattedH}:${formattedM} ${ampm}`;
            };

            collector.stop('submitted');

            await i.update({
              content: `Successfully created course **${name}** under active semester **${semester!.name}**!\n• Location: \`${location}\`\n• Schedule: \`${formatTime(startTime)} - ${formatTime(endTime)}\` on **${formatMeetingDays(meetingDaysJSON)}**`,
              components: []
            });
          } catch (err) {
            console.error('Error creating course:', err);
            await i.reply({
              content: 'Failed to create course.',
              flags: ['Ephemeral'] as any
            });
          }
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason !== 'submitted') {
          interaction.editReply({
            content: 'Course creation timed out.',
            components: []
          }).catch(console.error);
        }
      });

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
        const daysStr = formatMeetingDays(c.meetingDays);

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

        return `• **${c.name}**\n  - Location: \`${c.location || 'N/A'}\`\n  - Time: \`${startStr} - ${endStr}\` on **${daysStr}**`;
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
      const changeDays = interaction.options.getBoolean('change-days') ?? false;
      const startTimeStr = interaction.options.getString('start-time');
      const endTimeStr = interaction.options.getString('end-time');
      const location = interaction.options.getString('location');

      const course = db.prepare('SELECT name, startTime, endTime FROM courses WHERE id = ?').get(courseId) as { name: string; startTime: number; endTime: number } | undefined;
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

      let newStart = course.startTime;
      let newEnd = course.endTime;

      if (startTimeStr) {
        const parsed = parseTimeToMinutes(startTimeStr);
        if (parsed === null) {
          await interaction.reply({
            content: `Error: Invalid start time format **"${startTimeStr}"**. Please use formats like \`10:00 AM\` or \`14:30\`.`,
            flags: ['Ephemeral'] as any
          });
          return;
        }
        updates.startTime = parsed;
        newStart = parsed;
      }

      if (endTimeStr) {
        const parsed = parseTimeToMinutes(endTimeStr);
        if (parsed === null) {
          await interaction.reply({
            content: `Error: Invalid end time format **"${endTimeStr}"**. Please use formats like \`11:30 AM\` or \`16:00\`.`,
            flags: ['Ephemeral'] as any
          });
          return;
        }
        updates.endTime = parsed;
        newEnd = parsed;
      }

      if (newEnd <= newStart) {
        await interaction.reply({
          content: `Error: End time must be after start time.`,
          flags: ['Ephemeral'] as any
        });
        return;
      }

      if (changeDays) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_course_days_edit')
          .setPlaceholder('Select new meeting days...')
          .setMinValues(1)
          .setMaxValues(7)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Monday').setValue('1'),
            new StringSelectMenuOptionBuilder().setLabel('Tuesday').setValue('2'),
            new StringSelectMenuOptionBuilder().setLabel('Wednesday').setValue('3'),
            new StringSelectMenuOptionBuilder().setLabel('Thursday').setValue('4'),
            new StringSelectMenuOptionBuilder().setLabel('Friday').setValue('5'),
            new StringSelectMenuOptionBuilder().setLabel('Saturday').setValue('6'),
            new StringSelectMenuOptionBuilder().setLabel('Sunday').setValue('0')
          );

        const confirmButton = new ButtonBuilder()
          .setCustomId('confirm_course_days_edit')
          .setLabel('Confirm Days')
          .setStyle(ButtonStyle.Success);

        const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton);

        const response = await interaction.reply({
          content: `✏️ **Editing Course "${course.name}":** Select the new meeting days using the dropdown below, then click **Confirm Days**:`,
          components: [row1, row2],
          fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
          time: 60000
        });

        let selectedDays: number[] = [];

        collector.on('collect', async i => {
          if (i.user.id !== interaction.user.id) {
            await i.reply({
              content: 'Error: Only the user who ran the command can use these controls.',
              flags: ['Ephemeral'] as any
            });
            return;
          }

          if (i.isStringSelectMenu() && i.customId === 'select_course_days_edit') {
            selectedDays = i.values.map((v: string) => parseInt(v, 10));
            await i.deferUpdate();
          } else if (i.customId === 'confirm_course_days_edit') {
            if (selectedDays.length === 0) {
              await i.reply({
                content: 'Error: You must select at least one day.',
                flags: ['Ephemeral'] as any
              });
              return;
            }

            updates.meetingDays = JSON.stringify(selectedDays);

            try {
              updateCourse(courseId, updates);
              collector.stop('submitted');
              await i.update({
                content: `Successfully updated details and meeting days for course **${updates.name || course.name}**! ✏️`,
                components: []
              });
            } catch (err) {
              console.error('Error updating course:', err);
              await i.reply({
                content: 'Failed to update course.',
                flags: ['Ephemeral'] as any
              });
            }
          }
        });

        collector.on('end', (collected, reason) => {
          if (reason !== 'submitted') {
            interaction.editReply({
              content: 'Course edit timed out.',
              components: []
            }).catch(console.error);
          }
        });
      } else {
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
            content: `Successfully updated details for course **${course.name}**! ✏️`
          });
        } catch (err) {
          console.error('Error updating course:', err);
          await interaction.reply({
            content: 'Failed to update course.',
            flags: ['Ephemeral'] as any
          });
        }
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
