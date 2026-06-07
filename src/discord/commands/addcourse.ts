import { SlashCommandBuilder } from 'discord.js';
import { randomUUID } from 'crypto';
import { Command } from '../types';
import { addSemester, addCourse, getAllSemesters } from '../../db/queries';

const addCourseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('addcourse')
    .setDescription('Add a new course to a semester')
    .addStringOption(option =>
      option.setName('semester')
        .setDescription('Semester name (e.g. Fall 2026)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Course name (e.g. Calculus 2)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('days')
        .setDescription('Meeting days as comma-separated numbers (e.g. 1,3,5 for MWF)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('start-time')
        .setDescription('Start time in minutes from midnight (e.g. 600 for 10:00 AM)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('end-time')
        .setDescription('End time in minutes from midnight (e.g. 690 for 11:30 AM)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('location')
        .setDescription('Building and Room number')
        .setRequired(false)
    ),
  async execute(interaction) {
    const semesterName = interaction.options.getString('semester', true);
    const courseName = interaction.options.getString('name', true);
    const daysString = interaction.options.getString('days', true);
    const startTime = interaction.options.getInteger('start-time', true);
    const endTime = interaction.options.getInteger('end-time', true);
    const location = interaction.options.getString('location') || null;

    // 1. Get or create Semester
    let semesterId = '';
    const existingSemesters = getAllSemesters();
    const matched = existingSemesters.find(s => s.name.toLowerCase() === semesterName.toLowerCase());
    
    if (matched) {
      semesterId = matched.id;
    } else {
      semesterId = randomUUID();
      addSemester(semesterId, semesterName);
    }

    // 2. Format meetingDays as JSON Array format
    const daysArray = daysString.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
    const meetingDaysJSON = JSON.stringify(daysArray);

    // 3. Add course to DB
    const courseId = randomUUID();
    try {
      addCourse({
        id: courseId,
        semesterId,
        name: courseName,
        meetingDays: meetingDaysJSON,
        startTime,
        endTime,
        location
      });

      await interaction.reply({
        content: `Successfully added course **${courseName}** under semester **${semesterName}**!\n• Location: \`${location || 'N/A'}\`\n• Schedule: Days \`${daysString}\`, \`${startTime}\` to \`${endTime}\` minutes from midnight.`,
        ephemeral: false
      });
    } catch (err) {
      console.error('Error adding course:', err);
      await interaction.reply({
        content: 'Failed to add the course. Please check your inputs and try again.',
        ephemeral: true
      });
    }
  },
};

export default addCourseCommand;
