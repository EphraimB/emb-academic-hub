import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { getCoursesBySemester, getAllSemesters } from '../../db/queries';

const coursesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('courses')
    .setDescription('List all semesters or search courses by semester')
    .addStringOption(option =>
      option.setName('semester')
        .setDescription('Semester name to list courses for')
        .setRequired(false)
    ),
  async execute(interaction) {
    const semesterName = interaction.options.getString('semester');

    // 1. If no semester name is provided, list all available semesters
    if (!semesterName) {
      const semesters = getAllSemesters();
      if (semesters.length === 0) {
        await interaction.reply({
          content: 'No semesters are registered in the database yet. Use `/task add` to add your first course and task!',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      const list = semesters.map(s => `• **${s.name}**`).join('\n');
      await interaction.reply({
        content: `### Registered Semesters:\n${list}\n\n*Type \`/courses [semester-name]\` to list courses inside a semester.*`
      });
      return;
    }

    // 2. Lookup semester by name
    const semesters = getAllSemesters();
    const matched = semesters.find(s => s.name.toLowerCase() === semesterName.toLowerCase());

    if (!matched) {
      await interaction.reply({
        content: `Semester **${semesterName}** was not found. Use \`/courses\` (without options) to list all available semesters.`,
        flags: ['Ephemeral'] as any
      });
      return;
    }

    // 3. Retrieve courses for the semester
    const courses = getCoursesBySemester(matched.id);
    if (courses.length === 0) {
      await interaction.reply({
        content: `No courses registered under semester **${matched.name}** yet.`
      });
      return;
    }

    // Format list of courses
    const list = courses.map(c => {
      let daysStr = 'N/A';
      try {
        const days = JSON.parse(c.meetingDays) as number[];
        daysStr = days.join(', ');
      } catch (err) {
        console.error('Error parsing meeting days JSON:', err);
      }

      // Convert minutes from midnight to HH:MM format
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
      content: `### Courses for **${matched.name}**:\n\n${list}`
    });
  },
};

export default coursesCommand;
