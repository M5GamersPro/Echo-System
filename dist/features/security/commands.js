import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { addWhitelistEntry, getSecuritySettings, listWhitelistEntries, removeWhitelistEntry, updateSecuritySettings } from './service.js';
const manageServer = PermissionFlagsBits.ManageGuild;
const whitelist = {
    name: 'whitelist', category: 'security', description: 'Manage users or roles exempt from Echo security actions.',
    usage: 'whitelist <add|remove|list> [@user|@role]',
    async execute(context, args) {
        if (!context.message.member?.permissions.has(manageServer))
            return void await context.message.reply({ content: 'You need Manage Server to edit the security whitelist.', allowedMentions: { repliedUser: false } });
        const action = args[0]?.toLowerCase();
        if (action === 'list') {
            const rows = await listWhitelistEntries(context.message.guildId);
            const embed = new EmbedBuilder().setColor(0x2c92aa).setTitle('Security whitelist')
                .setDescription(rows.length ? rows.map(row => `${row.targetType === 'role' ? 'Role' : 'User'}: <@${row.targetId}>`).join('\n') : 'The whitelist is empty.');
            return void await context.message.reply({ embeds: [embed], allowedMentions: { parse: [], repliedUser: false } });
        }
        if (action !== 'add' && action !== 'remove')
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}whitelist <add|remove|list> [@user|@role]`, allowedMentions: { repliedUser: false } });
        const role = context.message.mentions.roles.first();
        const user = context.message.mentions.users.first();
        const targetType = role ? 'role' : 'user';
        const targetId = role?.id ?? user?.id ?? args[1]?.replace(/[<@!&>]/g, '');
        if (!targetId || !/^\d{17,20}$/.test(targetId))
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}whitelist ${action} @user-or-role`, allowedMentions: { repliedUser: false } });
        if (action === 'add') {
            await addWhitelistEntry(context.message.guildId, targetType, targetId, context.message.author.id);
            return void await context.message.reply({ content: `Added ${role ? `role <@&${targetId}>` : `user <@${targetId}>`} to the security whitelist.`, allowedMentions: { parse: [] } });
        }
        const removed = await removeWhitelistEntry(context.message.guildId, targetType, targetId);
        await context.message.reply({ content: removed ? 'Whitelist entry removed.' : 'That entry was not on the whitelist.', allowedMentions: { repliedUser: false } });
    },
};
const antiRaid = {
    name: 'antiraid', category: 'security', description: 'Configure join-burst detection.', usage: 'antiraid <on|off> [threshold] [window-seconds] [alert|timeout]',
    async execute(context, args) {
        if (!context.message.member?.permissions.has(manageServer))
            return void await context.message.reply({ content: 'You need Manage Server to configure anti-raid.', allowedMentions: { repliedUser: false } });
        const current = await getSecuritySettings(context.message.guildId);
        const mode = args[0]?.toLowerCase();
        if (mode !== 'on' && mode !== 'off')
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}antiraid <on|off> [threshold 2-50] [window 3-120s] [alert|timeout]`, allowedMentions: { repliedUser: false } });
        const threshold = args[1] === undefined ? current.antiRaidThreshold : Number(args[1]);
        const windowSeconds = args[2] === undefined ? current.antiRaidWindowSeconds : Number(args[2]);
        const action = args[3] === undefined ? current.antiRaidAction : args[3].toLowerCase();
        if (!Number.isInteger(threshold) || threshold < 2 || threshold > 50 || !Number.isInteger(windowSeconds) || windowSeconds < 3 || windowSeconds > 120 || !['alert', 'timeout'].includes(action)) {
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}antiraid <on|off> [threshold 2-50] [window 3-120s] [alert|timeout]`, allowedMentions: { repliedUser: false } });
        }
        await updateSecuritySettings(context.message.guildId, { antiRaidEnabled: mode === 'on', antiRaidThreshold: threshold, antiRaidWindowSeconds: windowSeconds, antiRaidAction: action });
        await context.message.reply({ content: `Anti-raid ${mode === 'on' ? 'enabled' : 'disabled'}: ${threshold} joins in ${windowSeconds}s; response: ${action}.`, allowedMentions: { repliedUser: false } });
    },
};
const antiNuke = {
    name: 'antinuke', category: 'security', description: 'Monitor destructive server audit-log actions.', usage: 'antinuke <on|off> [threshold] [window-seconds] [alert|strip]',
    async execute(context, args) {
        if (!context.message.member?.permissions.has(manageServer))
            return void await context.message.reply({ content: 'You need Manage Server to configure anti-nuke.', allowedMentions: { repliedUser: false } });
        const current = await getSecuritySettings(context.message.guildId);
        const mode = args[0]?.toLowerCase();
        if (mode !== 'on' && mode !== 'off')
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}antinuke <on|off> [threshold 2-20] [window 10-300s] [alert|strip]`, allowedMentions: { repliedUser: false } });
        const threshold = args[1] === undefined ? current.antiNukeThreshold : Number(args[1]);
        const windowSeconds = args[2] === undefined ? current.antiNukeWindowSeconds : Number(args[2]);
        const action = args[3] === undefined ? current.antiNukeAction : args[3].toLowerCase();
        if (!Number.isInteger(threshold) || threshold < 2 || threshold > 20 || !Number.isInteger(windowSeconds) || windowSeconds < 10 || windowSeconds > 300 || !['alert', 'strip'].includes(action)) {
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}antinuke <on|off> [threshold 2-20] [window 10-300s] [alert|strip]`, allowedMentions: { repliedUser: false } });
        }
        await updateSecuritySettings(context.message.guildId, { antiNukeEnabled: mode === 'on', antiNukeThreshold: threshold, antiNukeWindowSeconds: windowSeconds, antiNukeAction: action });
        await context.message.reply({ content: `Anti-nuke ${mode === 'on' ? 'enabled' : 'disabled'}: ${threshold} monitored actions in ${windowSeconds}s; response: ${action}.`, allowedMentions: { repliedUser: false } });
    },
};
export const securityCommands = [whitelist, antiRaid, antiNuke];
