import { ChatInputCommandInteraction, SlashCommandBuilder, ClientEvents, Collection } from 'discord.js';

export interface Command {
  data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> | SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
}

export interface Event {
  name: keyof ClientEvents;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
  }
}
