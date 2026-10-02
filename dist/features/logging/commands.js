import { PermissionFlagsBits } from 'discord.js';
import { updateGuildSettings } from '../../database.js';
const setLogs = {
    name: 'setlogs', category: 'admin', description: 'Set or disable this server’s event-log channel.', usage: 'setlogs #channel|off',
    async execute(context, args) {
        if (!context.message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
            return void await context.message.reply({ content: 'You need Manage Server to configure logs.', allowedMentions: { repliedUser: false } });
        if (args[0]?.toLowerCase() === 'off') {
            await updateGuildSettings(context.message.guildId, { logChannelId: null });
            return void await context.message.reply({ content: 'Server event logging disabled.', allowedMentions: { repliedUser: false } });
        }
        const channel = context.message.mentions.channels.first();
        if (!channel?.isTextBased() || !('send' in channel))
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}setlogs #text-channel|off`, allowedMentions: { repliedUser: false } });
        await updateGuildSettings(context.message.guildId, { logChannelId: channel.id });
        await context.message.reply({ content: `Server events will be logged in ${channel}.`, allowedMentions: { repliedUser: false } });
    },
};
const logs = {
    name: 'logs', category: 'admin', description: 'Show the configured event-log channel.',
    async execute(context) {
        if (!context.message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
            return void await context.message.reply({ content: 'You need Manage Server to view log settings.', allowedMentions: { repliedUser: false } });
        const channel = context.settings.logChannelId ? `<#${context.settings.logChannelId}>` : 'Disabled';
        await context.message.reply({ content: `Event log channel: ${channel}`, allowedMentions: { repliedUser: false } });
    },
};
export const loggingCommands = [setLogs, logs];
