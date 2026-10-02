import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, } from 'discord.js';
import { collections, updateGuildSettings } from './database.js';
import { calculate, parseDuration } from './utils.js';
import { deletedMessages } from './state.js';
import { echoEmoji, echoEmojiOption } from './emojis.js';
import { economyCommands } from './features/economy/commands.js';
import { activityCommands } from './features/activity/commands.js';
import { levelingCommands } from './features/leveling/commands.js';
import { canvasCommands } from './features/canvas/commands.js';
import { ownerCommands } from './features/owners/commands.js';
import { isBotOwner } from './features/owners/service.js';
import { securityCommands } from './features/security/commands.js';
import { loggingCommands } from './features/logging/commands.js';
import { voiceCommands } from './features/voice/commands.js';
import { logGuildEvent } from './features/logging/service.js';
const colors = { brand: 0x7658e8, success: 0x39b982, error: 0xe05268 };
const answer = (context, content) => context.message.reply({ content, allowedMentions: { repliedUser: false } });
async function requirePermission(context, permission) {
    if (context.message.member?.permissions.has(permission))
        return true;
    await answer(context, 'You do not have permission to use that command.');
    return false;
}
async function findMember(context, input) {
    if (!input)
        return context.message.mentions.members.first() ?? null;
    const mentioned = context.message.mentions.members.first();
    if (mentioned)
        return mentioned;
    const id = input.replace(/[<@!>]/g, '');
    return /^\d{17,20}$/.test(id) ? context.message.guild.members.fetch(id).catch(() => null) : null;
}
const modPermission = PermissionFlagsBits.ModerateMembers;
const adminPermission = PermissionFlagsBits.ManageGuild;
const warn = {
    name: 'warn', category: 'moderation', description: 'Warn a member and save the reason.', usage: 'warn @member <reason>',
    async execute(context, args) {
        if (!await requirePermission(context, modPermission))
            return;
        const target = await findMember(context, args[0]);
        const reason = args.slice(1).join(' ').trim();
        if (!target || !reason)
            return void await answer(context, `Usage: ${context.settings.prefix}warn @member <reason>`);
        if (target.id === context.message.author.id)
            return void await answer(context, 'You cannot warn yourself.');
        const record = { id: randomUUID().slice(0, 8), guildId: context.message.guildId, userId: target.id, moderatorId: context.message.author.id, reason, createdAt: new Date() };
        await collections().warnings.insertOne(record);
        await answer(context, `${echoEmoji(context.message.guild, 'warning')} ${target} was warned. **Reason:** ${reason}\nWarning ID: \`${record.id}\``);
        await logGuildEvent(context.message.guild, `${echoEmoji(context.message.guild, 'warning')} <@${target.id}> was warned by <@${context.message.author.id}>: ${reason}`);
    },
};
const warns = {
    name: 'warns', category: 'moderation', description: 'View a member’s latest warnings.', usage: 'warns @member',
    async execute(context, args) {
        if (!await requirePermission(context, modPermission))
            return;
        const target = await findMember(context, args[0]);
        if (!target)
            return void await answer(context, 'Mention a member whose warnings you want to view.');
        const rows = await collections().warnings.find({ guildId: context.message.guildId, userId: target.id }).sort({ createdAt: -1 }).limit(10).toArray();
        const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`Warnings for ${target.user.tag}`)
            .setDescription(rows.length ? rows.map(row => `\`${row.id}\` • <@${row.moderatorId}> • ${row.reason}`).join('\n') : 'No warnings found.')
            .setFooter({ text: 'Showing the latest 10 warnings' });
        await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
const removeWarn = {
    name: 'removewarn', category: 'moderation', description: 'Remove a warning by its ID.', usage: 'removewarn <warning-id>',
    async execute(context, args) {
        if (!await requirePermission(context, modPermission))
            return;
        if (!args[0])
            return void await answer(context, `Usage: ${context.settings.prefix}removewarn <warning-id>`);
        const result = await collections().warnings.deleteOne({ guildId: context.message.guildId, id: args[0] });
        await answer(context, result.deletedCount ? 'Warning removed.' : 'No warning with that ID was found.');
    },
};
const resetWarns = {
    name: 'resetwarns', category: 'moderation', description: 'Delete all warnings for a member.', usage: 'resetwarns @member',
    async execute(context, args) {
        if (!await requirePermission(context, PermissionFlagsBits.Administrator))
            return;
        const target = await findMember(context, args[0]);
        if (!target)
            return void await answer(context, 'Mention a member whose warnings you want to clear.');
        const result = await collections().warnings.deleteMany({ guildId: context.message.guildId, userId: target.id });
        await answer(context, `Removed ${result.deletedCount} warning(s) for ${target}.`);
    },
};
const timeout = {
    name: 'timeout', aliases: ['prison'], category: 'moderation', description: 'Timeout a member for a duration.', usage: 'timeout @member <10m|2h|1d> <reason>',
    async execute(context, args) {
        if (!await requirePermission(context, modPermission))
            return;
        const target = await findMember(context, args[0]);
        const duration = parseDuration(args[1] ?? '');
        if (!target || !duration || duration > 28 * 86_400_000)
            return void await answer(context, `Usage: ${context.settings.prefix}timeout @member <10m|2h|1d> <reason>`);
        if (!target.moderatable)
            return void await answer(context, 'I cannot timeout that member. Check role hierarchy and my permissions.');
        await target.timeout(duration, args.slice(2).join(' ') || 'No reason provided');
        await answer(context, `${echoEmoji(context.message.guild, 'locked')} ${target.user.tag} was timed out for ${args[1]}.`);
        await logGuildEvent(context.message.guild, `${echoEmoji(context.message.guild, 'locked')} <@${target.id}> was timed out by <@${context.message.author.id}> for ${args[1]}.`);
    },
};
const kick = {
    name: 'kick', category: 'moderation', description: 'Kick a member from the server.', usage: 'kick @member <reason>',
    async execute(context, args) {
        if (!await requirePermission(context, PermissionFlagsBits.KickMembers))
            return;
        const target = await findMember(context, args[0]);
        if (!target)
            return void await answer(context, 'Mention a member to kick.');
        if (!target.kickable)
            return void await answer(context, 'I cannot kick that member. Check role hierarchy and my permissions.');
        await target.kick(args.slice(1).join(' ') || 'No reason provided');
        await answer(context, `${echoEmoji(context.message.guild, 'kick')} ${target.user.tag} was kicked.`);
        await logGuildEvent(context.message.guild, `${echoEmoji(context.message.guild, 'kick')} <@${target.id}> was kicked by <@${context.message.author.id}>.`);
    },
};
const ban = {
    name: 'ban', category: 'moderation', description: 'Ban a member from the server.', usage: 'ban @member <reason>',
    async execute(context, args) {
        if (!await requirePermission(context, PermissionFlagsBits.BanMembers))
            return;
        const target = await findMember(context, args[0]);
        if (!target)
            return void await answer(context, 'Mention a member to ban.');
        if (!target.bannable)
            return void await answer(context, 'I cannot ban that member. Check role hierarchy and my permissions.');
        await target.ban({ reason: args.slice(1).join(' ') || 'No reason provided' });
        await answer(context, `${echoEmoji(context.message.guild, 'ban')} ${target.user.tag} was banned.`);
        await logGuildEvent(context.message.guild, `${echoEmoji(context.message.guild, 'ban')} <@${target.id}> was banned by <@${context.message.author.id}>.`);
    },
};
const clear = {
    name: 'clear', category: 'admin', description: 'Delete recent messages from this channel.', usage: 'clear <1-100>',
    async execute(context, args) {
        if (!await requirePermission(context, PermissionFlagsBits.ManageMessages))
            return;
        const count = Number(args[0]);
        if (!Number.isInteger(count) || count < 1 || count > 100)
            return void await answer(context, `Usage: ${context.settings.prefix}clear <1-100>`);
        if (!('bulkDelete' in context.message.channel))
            return void await answer(context, 'This channel does not support bulk deletion.');
        const deleted = await context.message.channel.bulkDelete(count + 1, true);
        await context.message.channel.send(`${echoEmoji(context.message.guild, 'clean')} Deleted ${Math.max(0, deleted.size - 1)} message(s).`).then(message => setTimeout(() => message.delete().catch(() => undefined), 4_000));
    },
};
const say = {
    name: 'say', category: 'admin', description: 'Post a message as Echo System.', usage: 'say <message>',
    async execute(context, args) {
        if (!await requirePermission(context, PermissionFlagsBits.ManageMessages))
            return;
        const content = args.join(' ').trim();
        if (!content || content.length > 2_000)
            return void await answer(context, `Usage: ${context.settings.prefix}say <message under 2000 characters>`);
        await context.message.channel.send({ content, allowedMentions: { parse: [] } });
    },
};
function channelPermissionCommand(name) {
    const lock = name === 'lock';
    const hide = name === 'hide';
    return {
        name, category: 'admin', description: `${lock || hide ? 'Restrict' : 'Restore'} channel access for everyone.`,
        async execute(context) {
            if (!await requirePermission(context, PermissionFlagsBits.ManageChannels))
                return;
            const channel = context.message.channel;
            if (!('permissionOverwrites' in channel))
                return void await answer(context, 'This command needs a standard text channel.');
            if (hide || name === 'show') {
                await channel.permissionOverwrites.edit(context.message.guild.roles.everyone, { ViewChannel: hide ? false : null });
            }
            else {
                await channel.permissionOverwrites.edit(context.message.guild.roles.everyone, { SendMessages: lock ? false : null });
            }
            await answer(context, `${channel} access updated.`);
        },
    };
}
const setPrefix = {
    name: 'setprefix', category: 'admin', description: 'Change the command prefix for this server.', usage: 'setprefix <new-prefix>',
    async execute(context, args) {
        if (!await requirePermission(context, adminPermission))
            return;
        const prefix = args[0];
        if (!prefix || prefix.length > 5 || /\s/.test(prefix))
            return void await answer(context, `Usage: ${context.settings.prefix}setprefix <1-5 characters, no spaces>`);
        await updateGuildSettings(context.message.guildId, { prefix });
        await answer(context, `Command prefix changed to \`${prefix}\`. Try \`${prefix}help\`.`);
    },
};
const greet = {
    name: 'greet', category: 'greet', description: 'Set the channel for welcome messages.', usage: 'greet #channel',
    async execute(context) {
        if (!await requirePermission(context, adminPermission))
            return;
        const channel = context.message.mentions.channels.first();
        if (!channel || !channel.isTextBased())
            return void await answer(context, `Usage: ${context.settings.prefix}greet #channel`);
        await updateGuildSettings(context.message.guildId, { welcomeChannelId: channel.id });
        await answer(context, `Welcome messages will be sent in ${channel}.`);
    },
};
const greetMessage = {
    name: 'greetmsg', category: 'greet', description: 'Set the welcome text. Use {user}, {server}, and {memberCount}.', usage: 'greetmsg <message>',
    async execute(context, args) {
        if (!await requirePermission(context, adminPermission))
            return;
        const message = args.join(' ').trim();
        if (!message || message.length > 1_000)
            return void await answer(context, `Usage: ${context.settings.prefix}greetmsg <message under 1000 characters>`);
        await updateGuildSettings(context.message.guildId, { welcomeMessage: message });
        await answer(context, 'Welcome message updated.');
    },
};
const greetDelete = {
    name: 'greetdel', category: 'greet', description: 'Set welcome-message auto-delete time in seconds (0 disables it).', usage: 'greetdel <0-60>',
    async execute(context, args) {
        if (!await requirePermission(context, adminPermission))
            return;
        const seconds = Number(args[0]);
        if (!Number.isInteger(seconds) || seconds < 0 || seconds > 60)
            return void await answer(context, `Usage: ${context.settings.prefix}greetdel <0-60>`);
        await updateGuildSettings(context.message.guildId, { welcomeDeleteSeconds: seconds });
        await answer(context, seconds ? `Welcome messages will be removed after ${seconds} seconds.` : 'Welcome messages will stay in the channel.');
    },
};
const greetShow = {
    name: 'greetshow', category: 'greet', description: 'Show the current welcome-message settings.',
    async execute(context) {
        const channel = context.settings.welcomeChannelId ? `<#${context.settings.welcomeChannelId}>` : 'Not set';
        const embed = new EmbedBuilder().setColor(colors.brand).setTitle('Greeting settings')
            .addFields({ name: 'Channel', value: channel }, { name: 'Message', value: context.settings.welcomeMessage }, { name: 'Auto-delete', value: `${context.settings.welcomeDeleteSeconds}s` });
        await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
const ticketPanel = {
    name: 'ticketpanel', category: 'tickets', description: 'Post a support-ticket panel in this channel.',
    async execute(context) {
        if (!await requirePermission(context, adminPermission))
            return;
        const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`${echoEmoji(context.message.guild, 'tickets')} Ticket System`)
            .setDescription('Need help? Open a private ticket and our team will assist you.');
        const button = new ButtonBuilder().setCustomId('ticket:open').setLabel('Open a ticket').setStyle(ButtonStyle.Primary);
        await context.message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
        await answer(context, 'Ticket panel posted.');
    },
};
const ticketTeam = {
    name: 'ticketteam', category: 'tickets', description: 'Post the Arabic support-team ticket panel.',
    async execute(context) {
        if (!await requirePermission(context, adminPermission))
            return;
        const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`${echoEmoji(context.message.guild, 'tickets')} Ticket System`)
            .setDescription('تقديم ادارةEcho تبغى تقدم ادارة؟ افتح تذكرة خاصة وسيساعدك فريقنا.');
        const button = new ButtonBuilder().setCustomId('ticket:open').setLabel('افتح تيكت').setStyle(ButtonStyle.Primary);
        await context.message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
        await answer(context, 'Ticket panel posted.');
    },
};
const ticketRole = {
    name: 'ticketrole', category: 'tickets', description: 'Set the support role allowed to view tickets.', usage: 'ticketrole @role',
    async execute(context) {
        if (!await requirePermission(context, adminPermission))
            return;
        const role = context.message.mentions.roles.first();
        if (!role)
            return void await answer(context, `Usage: ${context.settings.prefix}ticketrole @role`);
        await updateGuildSettings(context.message.guildId, { supportRoleId: role.id });
        await answer(context, `Ticket support role set to ${role}.`);
    },
};
const ticketCategory = {
    name: 'ticketcategory', category: 'tickets', description: 'Set the category where new tickets are created.', usage: 'ticketcategory <category-id>',
    async execute(context, args) {
        if (!await requirePermission(context, adminPermission))
            return;
        const category = context.message.mentions.channels.first() ?? context.message.guild.channels.cache.get(args[0] ?? '');
        if (!category || category.type !== 4)
            return void await answer(context, `Usage: ${context.settings.prefix}ticketcategory <category-id>`);
        await updateGuildSettings(context.message.guildId, { ticketCategoryId: category.id });
        await answer(context, `New tickets will be created under **${category.name}**.`);
    },
};
const giveaway = {
    name: 'giveaway', category: 'giveaways', description: 'Start a button-entry giveaway.', usage: 'giveaway <duration> <winners> <prize>',
    async execute(context, args) {
        if (!await requirePermission(context, adminPermission))
            return;
        const duration = parseDuration(args[0] ?? '');
        const winnerCount = Number(args[1]);
        const prize = args.slice(2).join(' ').trim();
        if (!duration || duration > 30 * 86_400_000 || !Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20 || !prize) {
            return void await answer(context, `Usage: ${context.settings.prefix}giveaway <10m|2h|1d> <1-20 winners> <prize>`);
        }
        const id = randomUUID();
        const endsAt = new Date(Date.now() + duration);
        const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`${echoEmoji(context.message.guild, 'giveaways')} Giveaway`)
            .setDescription(`**Prize:** ${prize}\n**Winners:** ${winnerCount}\n**Ends:** <t:${Math.floor(endsAt.getTime() / 1_000)}:R>\n\nPress the button to enter.`)
            .setFooter({ text: `Giveaway ID: ${id}` });
        const button = new ButtonBuilder().setCustomId(`giveaway:enter:${id}`).setLabel('Enter giveaway').setStyle(ButtonStyle.Success);
        const buttonEmoji = echoEmojiOption(context.message.guild, 'giveaways');
        if (buttonEmoji)
            button.setEmoji(buttonEmoji);
        const posted = await context.message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
        await collections().giveaways.insertOne({ id, guildId: context.message.guildId, channelId: context.message.channelId, messageId: posted.id, prize, winnerCount, endsAt, entries: [], status: 'active' });
        await answer(context, `Giveaway created. ID: \`${id}\``);
    },
};
const endGiveaway = {
    name: 'endgiveaway', aliases: ['gend'], category: 'giveaways', description: 'End an active giveaway early.', usage: 'endgiveaway <giveaway-id>',
    async execute(context, args) {
        if (!await requirePermission(context, adminPermission))
            return;
        const giveawayRecord = await collections().giveaways.findOne({ guildId: context.message.guildId, id: args[0], status: 'active' });
        if (!giveawayRecord)
            return void await answer(context, `Usage: ${context.settings.prefix}endgiveaway <active-giveaway-id>`);
        const changed = await finishGiveaway(context.message.client, giveawayRecord);
        if (!changed)
            return void await answer(context, 'That giveaway has already ended.');
        await answer(context, 'Giveaway ended.');
    },
};
export async function finishGiveaway(client, record) {
    const pool = [...record.entries];
    for (let index = pool.length - 1; index > 0; index -= 1) {
        const other = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[other]] = [pool[other], pool[index]];
    }
    const winners = pool.slice(0, record.winnerCount);
    const updated = await collections().giveaways.updateOne({ id: record.id, status: 'active' }, { $set: { status: 'ended', winnerIds: winners } });
    if (!updated.modifiedCount)
        return false;
    const channel = await client.channels.fetch(record.channelId).catch(() => null);
    if (!channel?.isTextBased() || !('send' in channel))
        return true;
    if (record.messageId) {
        const original = await channel.messages.fetch(record.messageId).catch(() => null);
        if (original) {
            const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`${echoEmoji(client.guilds.cache.get(record.guildId), 'giveaways')} Giveaway ended`)
                .setDescription(`**Prize:** ${record.prize}\n**Winners:** ${winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'No entries'}`);
            await original.edit({ embeds: [embed], components: [] }).catch(() => undefined);
        }
    }
    const text = winners.length ? `${echoEmoji(client.guilds.cache.get(record.guildId), 'giveaways')} Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${record.prize}**.` : `No one entered the giveaway for **${record.prize}**.`;
    await channel.send({ content: text, allowedMentions: { users: winners } }).catch(() => undefined);
    return true;
}
const avatar = {
    name: 'avatar', category: 'general', description: 'Show a member’s avatar.', usage: 'avatar [@member]',
    async execute(context) {
        const user = context.message.mentions.users.first() ?? context.message.author;
        const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`${user.username}’s avatar`).setImage(user.displayAvatarURL({ size: 1_024 }));
        await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
const roles = {
    name: 'roles', category: 'general', description: 'List the server roles.',
    async execute(context) {
        const roleList = context.message.guild.roles.cache.filter(role => role.id !== context.message.guildId).sort((a, b) => b.position - a.position).first(25);
        const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`Roles in ${context.message.guild.name}`)
            .setDescription(roleList.length ? roleList.map(role => `${role} — ${role.members.size} member(s)`).join('\n') : 'No roles found.');
        await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
const server = {
    name: 'server', category: 'general', description: 'Show server details.',
    async execute(context) {
        const guild = context.message.guild;
        const embed = new EmbedBuilder().setColor(colors.brand).setTitle(guild.name).setThumbnail(guild.iconURL())
            .addFields({ name: 'Members', value: String(guild.memberCount), inline: true }, { name: 'Channels', value: String(guild.channels.cache.size), inline: true }, { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1_000)}:D>`, inline: true });
        await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
const calc = {
    name: 'calc', category: 'general', description: 'Calculate a basic arithmetic expression.', usage: 'calc (12 + 8) / 2',
    async execute(context, args) {
        try {
            await answer(context, `${echoEmoji(context.message.guild, 'calculator')} **${calculate(args.join(' '))}**`);
        }
        catch (error) {
            await answer(context, error instanceof Error ? error.message : 'Invalid expression.');
        }
    },
};
const snipe = {
    name: 'snipe', category: 'general', description: 'Show the latest deleted message in this channel.',
    async execute(context) {
        const deleted = deletedMessages.get(context.message.channelId);
        if (!deleted)
            return void await answer(context, 'There is no recent deleted message in this channel.');
        const embed = new EmbedBuilder().setColor(colors.brand).setAuthor({ name: deleted.authorTag }).setDescription(deleted.content || '*No text content*').setTimestamp(deleted.deletedAt);
        await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
const ping = {
    name: 'ping', category: 'system', description: 'Check the bot response and gateway latency.',
    async execute(context) { await answer(context, `${echoEmoji(context.message.guild, 'ping')} Pong! Gateway: ${context.message.client.ws.ping}ms`); },
};
const uptime = {
    name: 'uptime', category: 'system', description: 'Show how long Echo System has been online.',
    async execute(context) {
        const seconds = Math.floor(process.uptime());
        const days = Math.floor(seconds / 86_400);
        const hours = Math.floor(seconds % 86_400 / 3_600);
        const minutes = Math.floor(seconds % 3_600 / 60);
        await answer(context, `Online for **${days}d ${hours}h ${minutes}m**.`);
    },
};
const setName = {
    name: 'setname', category: 'owner', description: 'Change the bot account display name.', usage: 'setname <new name>',
    async execute(context, args) {
        if (!await isBotOwner(context.message.author.id))
            return void await answer(context, 'This is an owner-only command.');
        const name = args.join(' ').trim();
        if (!name || name.length > 32)
            return void await answer(context, `Usage: ${context.settings.prefix}setname <1-32 characters>`);
        await context.message.client.user?.setUsername(name);
        await answer(context, `Bot name changed to **${name}**.`);
    },
};
const setStatus = {
    name: 'setstatus', category: 'owner', description: 'Change the bot activity shown in its profile.', usage: 'setstatus <activity>',
    async execute(context, args) {
        if (!await isBotOwner(context.message.author.id))
            return void await answer(context, 'This is an owner-only command.');
        const activity = args.join(' ').trim();
        if (!activity || activity.length > 128)
            return void await answer(context, `Usage: ${context.settings.prefix}setstatus <activity>`);
        context.message.client.user?.setActivity(activity);
        await answer(context, `Activity set to **${activity}**.`);
    },
};
export const commands = [
    warn, warns, removeWarn, resetWarns, timeout, kick, ban,
    clear, say, channelPermissionCommand('lock'), channelPermissionCommand('unlock'), channelPermissionCommand('hide'), channelPermissionCommand('show'), setPrefix,
    greet, greetMessage, greetDelete, greetShow,
    ticketPanel, ticketTeam, ticketRole, ticketCategory,
    giveaway, endGiveaway,
    avatar, roles, server, calc, snipe,
    ping, uptime, setName, setStatus,
    ...ownerCommands,
    ...economyCommands,
    ...activityCommands,
    ...levelingCommands,
    ...canvasCommands,
    ...securityCommands,
    ...loggingCommands,
    ...voiceCommands,
];
export const commandMap = new Map(commands.flatMap(command => [command.name, ...(command.aliases ?? [])].map(name => [name, command])));
export const commandColors = colors;
