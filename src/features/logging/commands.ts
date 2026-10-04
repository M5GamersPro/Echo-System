import { PermissionFlagsBits } from 'discord.js';
import type { BotCommand } from '../../types.js';
import { collections } from '../../database.js';
import { logCategories, logCategoryLabels } from './service.js';

const setLogs: BotCommand = {
  name: 'setlogs', category: 'admin', description: 'Set or disable a category-specific event-log channel.', usage: 'setlogs <category> #channel|off',
  async execute(context, args) {
    if (!context.message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) return void await context.message.reply({ content: 'You need Manage Server to configure logs.', allowedMentions: { repliedUser: false } });
    const category = args[0]?.toLowerCase();
    if (!category || !logCategories.includes(category as typeof logCategories[number])) {
      return void await context.message.reply({
        content: `Usage: ${context.settings.prefix}setlogs <${logCategories.join('|')}> #channel|off`,
        allowedMentions: { repliedUser: false },
      });
    }
    const logCategory = category as typeof logCategories[number];
    const channelArgument = args[1]?.toLowerCase();
    if (channelArgument === 'off') {
      await collections().guildSettings.updateOne(
        { guildId: context.message.guildId },
        { $set: { [`logChannels.${logCategory}`]: null, updatedAt: new Date() }, $setOnInsert: { guildId: context.message.guildId } },
        { upsert: true },
      );
      return void await context.message.reply({ content: `${logCategoryLabels[logCategory]} logging disabled.`, allowedMentions: { repliedUser: false } });
    }
    const channel = context.message.mentions.channels.first();
    if (!channel?.isTextBased() || !('send' in channel)) return void await context.message.reply({ content: `Usage: ${context.settings.prefix}setlogs ${logCategory} #text-channel|off`, allowedMentions: { repliedUser: false } });
    await collections().guildSettings.updateOne(
      { guildId: context.message.guildId },
      { $set: { [`logChannels.${logCategory}`]: channel.id, updatedAt: new Date() }, $setOnInsert: { guildId: context.message.guildId } },
      { upsert: true },
    );
    await context.message.reply({ content: `${logCategoryLabels[logCategory]} events will be logged in ${channel}.`, allowedMentions: { repliedUser: false } });
  },
};

const logs: BotCommand = {
  name: 'logs', category: 'admin', description: 'Show the configured event-log channels.',
  async execute(context) {
    if (!context.message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) return void await context.message.reply({ content: 'You need Manage Server to view log settings.', allowedMentions: { repliedUser: false } });
    const configuredChannels = context.settings.logChannels ?? {};
    const lines = logCategories.map(category => {
      const categoryFallback = category === 'tickets'
        ? context.settings.ticketLogChannelId
        : category === 'transcripts'
          ? context.settings.ticketTranscriptLogChannelId
          : null;
      const channelId = Object.hasOwn(configuredChannels, category)
        ? configuredChannels[category]
        : categoryFallback ?? context.settings.logChannelId;
      const status = channelId
        ? `<#${channelId}>`
        : Object.hasOwn(configuredChannels, category)
          ? 'Disabled'
          : 'Console';
      return `**${logCategoryLabels[category]}:** ${status}`;
    });
    await context.message.reply({ content: `Event log channels:\n${lines.join('\n')}`, allowedMentions: { repliedUser: false } });
  },
};

export const loggingCommands: BotCommand[] = [setLogs, logs];
