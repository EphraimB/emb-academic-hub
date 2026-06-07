import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';

const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and latency!'),
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(
      `Pong! 🏓\n• **Bot Latency:** ${latency}ms\n• **API Latency:** ${Math.round(interaction.client.ws.ping)}ms`
    );
  },
};

export default pingCommand;
