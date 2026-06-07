import { SlashCommandBuilder, AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { randomUUID } from 'crypto';
import { Command } from '../types';
import { 
  addSemester, 
  getAllSemesters, 
  getCurrentSemester, 
  setCurrentSemester, 
  setSemesterArchive, 
  updateSemesterName, 
  deleteSemester 
} from '../../db/queries';
import { db } from '../../db/init';

const semesterCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('semester')
    .setDescription('Manage academic semesters')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new semester')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Semester name (e.g. Fall 2026)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all registered semesters')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('switch')
        .setDescription('Switch the current active semester')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Select the semester to set as current')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('current')
        .setDescription('Show the current active semester')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Rename an existing semester')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Select the semester to rename')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option.setName('name')
            .setDescription('New semester name')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('archive')
        .setDescription('Archive or unarchive a semester')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Select the semester')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption(option =>
          option.setName('status')
            .setDescription('Archive status')
            .setRequired(true)
            .addChoices(
              { name: 'Archive 📁', value: 1 },
              { name: 'Unarchive 📂', value: 0 }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a semester and all associated data')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Select the semester to delete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    // ==========================================
    // SUBCOMMAND: /semester create
    // ==========================================
    if (subcommand === 'create') {
      const name = interaction.options.getString('name', true);
      const semesters = getAllSemesters();

      // If no semesters exist, automatically set as current active semester
      const isCurrent = semesters.length === 0 ? 1 : 0;
      const id = randomUUID();

      try {
        addSemester(id, name, isCurrent);
        let msg = `Successfully created semester **${name}**!`;
        if (isCurrent === 1) {
          msg += ` It has been automatically set as the current active semester.`;
        }
        await interaction.reply({ content: msg });
      } catch (err) {
        console.error('Error creating semester:', err);
        await interaction.reply({
          content: 'Failed to create semester.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /semester list
    // ==========================================
    if (subcommand === 'list') {
      const semesters = getAllSemesters();
      if (semesters.length === 0) {
        await interaction.reply({
          content: 'No semesters registered in the database yet. Use \`/semester create\` to add one.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      const list = semesters.map(s => {
        let label = `• **${s.name}**`;
        if (s.isCurrent === 1) label += ' `[Current]`';
        if (s.isArchived === 1) label += ' `[Archived]`';
        return label;
      }).join('\n');

      await interaction.reply({
        content: `### Registered Semesters:\n\n${list}`
      });
      return;
    }

    // ==========================================
    // SUBCOMMAND: /semester switch
    // ==========================================
    if (subcommand === 'switch') {
      const semesterId = interaction.options.getString('id', true);

      // Verify semester exists
      const semester = db.prepare('SELECT name FROM semesters WHERE id = ?').get(semesterId) as { name: string } | undefined;
      if (!semester) {
        await interaction.reply({
          content: 'Error: Selected semester was not found.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      try {
        setCurrentSemester(semesterId);
        await interaction.reply({
          content: `Successfully switched active semester to **${semester.name}**! 🔄`
        });
      } catch (err) {
        console.error('Error switching semester:', err);
        await interaction.reply({
          content: 'Failed to switch active semester.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /semester current
    // ==========================================
    if (subcommand === 'current') {
      const current = getCurrentSemester();
      if (!current) {
        await interaction.reply({
          content: 'No semester is currently active. Use \`/semester switch\` to activate one.',
          flags: ['Ephemeral'] as any
        });
      } else {
        await interaction.reply({
          content: `Currently active semester: **${current.name}** 🎓`
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /semester edit
    // ==========================================
    if (subcommand === 'edit') {
      const semesterId = interaction.options.getString('id', true);
      const newName = interaction.options.getString('name', true);

      // Verify semester exists
      const semester = db.prepare('SELECT name FROM semesters WHERE id = ?').get(semesterId) as { name: string } | undefined;
      if (!semester) {
        await interaction.reply({
          content: 'Error: Selected semester was not found.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      try {
        updateSemesterName(semesterId, newName);
        await interaction.reply({
          content: `Successfully renamed semester **${semester.name}** to **${newName}**! ✏9;`
        });
      } catch (err) {
        console.error('Error renaming semester:', err);
        await interaction.reply({
          content: 'Failed to rename semester.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /semester archive
    // ==========================================
    if (subcommand === 'archive') {
      const semesterId = interaction.options.getString('id', true);
      const status = interaction.options.getInteger('status', true);

      // Verify semester exists
      const semester = db.prepare('SELECT name FROM semesters WHERE id = ?').get(semesterId) as { name: string } | undefined;
      if (!semester) {
        await interaction.reply({
          content: 'Error: Selected semester was not found.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      try {
        setSemesterArchive(semesterId, status);
        const statusText = status === 1 ? 'Archived 📁' : 'Unarchived 📂';
        await interaction.reply({
          content: `Successfully marked semester **${semester.name}** as **${statusText}**!`
        });
      } catch (err) {
        console.error('Error archiving semester:', err);
        await interaction.reply({
          content: 'Failed to update semester archive status.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }

    // ==========================================
    // SUBCOMMAND: /semester delete
    // ==========================================
    if (subcommand === 'delete') {
      const semesterId = interaction.options.getString('id', true);

      // Verify semester exists
      const semester = db.prepare('SELECT name FROM semesters WHERE id = ?').get(semesterId) as { name: string } | undefined;
      if (!semester) {
        await interaction.reply({
          content: 'Error: Selected semester was not found.',
          flags: ['Ephemeral'] as any
        });
        return;
      }

      try {
        deleteSemester(semesterId);
        await interaction.reply({
          content: `Successfully deleted semester **${semester.name}** and all associated courses, assignments, and tasks! 🗑️`
        });
      } catch (err) {
        console.error('Error deleting semester:', err);
        await interaction.reply({
          content: 'Failed to delete semester.',
          flags: ['Ephemeral'] as any
        });
      }
      return;
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();

    try {
      const semesters = getAllSemesters();
      const filtered = semesters
        .filter(s => s.name.toLowerCase().includes(focusedValue.toLowerCase()))
        .map(s => {
          let label = s.name;
          if (s.isCurrent === 1) label += ' [Current]';
          if (s.isArchived === 1) label += ' [Archived]';
          const displayName = label.length > 100 ? label.substring(0, 97) + '...' : label;
          return {
            name: displayName,
            value: s.id
          };
        })
        .slice(0, 25);

      await interaction.respond(filtered);
    } catch (err) {
      console.error('Error autocomplete semesters:', err);
      await interaction.respond([]);
    }
  }
};

export default semesterCommand;
