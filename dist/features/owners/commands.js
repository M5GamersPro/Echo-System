import { EmbedBuilder } from 'discord.js';
import { isBotOwner, addBotOwner, listCommandAliases, removeCommandAlias, setCommandAlias } from './service.js';
async function ownerOnly(context) {
    if (await isBotOwner(context.message.author.id))
        return true;
    await context.message.reply({ content: 'This command is restricted to Echo System owners.', allowedMentions: { repliedUser: false } });
    return false;
}
const addOwner = {
    name: 'addowner', category: 'owner', description: 'Add a bot owner by mention or user ID.', usage: 'addowner @user',
    async execute(context, args) {
        if (!await ownerOnly(context))
            return;
        const target = context.message.mentions.users.first();
        const id = target?.id ?? args[0]?.replace(/[<@!>]/g, '');
        if (!id || !/^\d{17,20}$/.test(id))
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}addowner @user-or-id`, allowedMentions: { repliedUser: false } });
        await addBotOwner(id, context.message.author.id);
        await context.message.reply({ content: `Added <@${id}> as an Echo System owner.`, allowedMentions: { users: [id], repliedUser: false } });
    },
};
const alias = {
    name: 'alias', category: 'owner', description: 'Create a shortcut to a registered command in this server.', usage: 'alias <shortcut> <command>',
    async execute(context, args) {
        if (!await ownerOnly(context))
            return;
        const shortcut = args[0]?.toLowerCase();
        const commandName = args.slice(1).join(' ').trim().toLowerCase();
        if (!shortcut || !/^[a-z][a-z0-9_-]{0,15}$/.test(shortcut) || !commandName) {
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}alias <shortcut> <registered command>`, allowedMentions: { repliedUser: false } });
        }
        const { commandMap } = await import('../../commands.js');
        if (commandMap.has(shortcut))
            return void await context.message.reply({ content: 'Shortcuts cannot replace built-in commands.', allowedMentions: { repliedUser: false } });
        const target = commandMap.get(commandName);
        if (!target)
            return void await context.message.reply({ content: `No registered command named \`${commandName}\` was found.`, allowedMentions: { repliedUser: false } });
        await setCommandAlias(context.message.guildId, shortcut, target.name, context.message.author.id);
        await context.message.reply({ content: `Shortcut \`${shortcut}\` now runs \`${target.name}\` in this server. Built-in commands keep priority.`, allowedMentions: { repliedUser: false } });
    },
};
const unalias = {
    name: 'unalias', category: 'owner', description: 'Remove a server command shortcut.', usage: 'unalias <shortcut>',
    async execute(context, args) {
        if (!await ownerOnly(context))
            return;
        const shortcut = args[0]?.toLowerCase();
        if (!shortcut)
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}unalias <shortcut>`, allowedMentions: { repliedUser: false } });
        const removed = await removeCommandAlias(context.message.guildId, shortcut);
        await context.message.reply({ content: removed ? `Removed shortcut \`${shortcut}\`.` : `No shortcut named \`${shortcut}\` exists.`, allowedMentions: { repliedUser: false } });
    },
};
const aliases = {
    name: 'aliases', category: 'owner', description: 'List shortcuts configured in this server.',
    async execute(context) {
        if (!await ownerOnly(context))
            return;
        const rows = await listCommandAliases(context.message.guildId);
        const embed = new EmbedBuilder().setColor(0x2c92aa).setTitle('Server command shortcuts')
            .setDescription(rows.length ? rows.map(row => `\`${context.settings.prefix}${row.alias}\` → \`${row.commandName}\``).join('\n') : 'No shortcuts configured.');
        await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
export const ownerCommands = [addOwner, alias, unalias, aliases];
