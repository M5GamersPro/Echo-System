import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits,
  type Client, type GuildMember, type PermissionResolvable,
} from 'discord.js';
import { collections, updateGuildSettings } from './database.js';
import type { BotCommand, CommandContext, GiveawayRecord, TicketType } from './types.js';
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
import { isTicketType, TICKET_TYPES } from './types.js';

const colors = { brand: 0x7658e8, success: 0x39b982, error: 0xe05268 };
const answer = (context: CommandContext, content: string) => context.message.reply({ content, allowedMentions: { repliedUser: false } });

async function requirePermission(context: CommandContext, permission: PermissionResolvable): Promise<boolean> {
  if (context.message.member?.permissions.has(permission)) return true;
  await answer(context, 'You do not have permission to use that command.');
  return false;
}

async function findMember(context: CommandContext, input?: string): Promise<GuildMember | null> {
  if (!input) return context.message.mentions.members.first() ?? null;
  const mentioned = context.message.mentions.members.first();
  if (mentioned) return mentioned;
  const id = input.replace(/[<@!>]/g, '');
  return /^\d{17,20}$/.test(id) ? context.message.guild.members.fetch(id).catch(() => null) : null;
}

const modPermission = PermissionFlagsBits.ModerateMembers;
const adminPermission = PermissionFlagsBits.ManageGuild;

const warn: BotCommand = {
  name: 'warn', category: 'moderation', description: 'Warn a member and save the reason.', usage: 'warn @member <reason>',
  async execute(context, args) {
    if (!await requirePermission(context, modPermission)) return;
    const target = await findMember(context, args[0]);
    const reason = args.slice(1).join(' ').trim();
    if (!target || !reason) return void await answer(context, `Usage: ${context.settings.prefix}warn @member <reason>`);
    if (target.id === context.message.author.id) return void await answer(context, 'You cannot warn yourself.');
    const record = { id: randomUUID().slice(0, 8), guildId: context.message.guildId, userId: target.id, moderatorId: context.message.author.id, reason, createdAt: new Date() };
    await collections().warnings.insertOne(record);
    await answer(context, `${echoEmoji(context.message.guild, 'warning')} ${target} was warned. **Reason:** ${reason}\nWarning ID: \`${record.id}\``);
    await logGuildEvent(context.message.guild, 'moderation', `${echoEmoji(context.message.guild, 'warning')} <@${target.id}> was warned by <@${context.message.author.id}>: ${reason}`);
  },
};

const warns: BotCommand = {
  name: 'warns', category: 'moderation', description: 'View a member’s latest warnings.', usage: 'warns @member',
  async execute(context, args) {
    if (!await requirePermission(context, modPermission)) return;
    const target = await findMember(context, args[0]);
    if (!target) return void await answer(context, 'Mention a member whose warnings you want to view.');
    const rows = await collections().warnings.find({ guildId: context.message.guildId, userId: target.id }).sort({ createdAt: -1 }).limit(10).toArray();
    const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`Warnings for ${target.user.tag}`)
      .setDescription(rows.length ? rows.map(row => `\`${row.id}\` • <@${row.moderatorId}> • ${row.reason}`).join('\n') : 'No warnings found.')
      .setFooter({ text: 'Showing the latest 10 warnings' });
    await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  },
};

const removeWarn: BotCommand = {
  name: 'removewarn', category: 'moderation', description: 'Remove a warning by its ID.', usage: 'removewarn <warning-id>',
  async execute(context, args) {
    if (!await requirePermission(context, modPermission)) return;
    if (!args[0]) return void await answer(context, `Usage: ${context.settings.prefix}removewarn <warning-id>`);
    const result = await collections().warnings.deleteOne({ guildId: context.message.guildId, id: args[0] });
    await answer(context, result.deletedCount ? 'Warning removed.' : 'No warning with that ID was found.');
  },
};

const resetWarns: BotCommand = {
  name: 'resetwarns', category: 'moderation', description: 'Delete all warnings for a member.', usage: 'resetwarns @member',
  async execute(context, args) {
    if (!await requirePermission(context, PermissionFlagsBits.Administrator)) return;
    const target = await findMember(context, args[0]);
    if (!target) return void await answer(context, 'Mention a member whose warnings you want to clear.');
    const result = await collections().warnings.deleteMany({ guildId: context.message.guildId, userId: target.id });
    await answer(context, `Removed ${result.deletedCount} warning(s) for ${target}.`);
  },
};

const timeout: BotCommand = {
  name: 'timeout', aliases: ['prison'], category: 'moderation', description: 'Timeout a member for a duration.', usage: 'timeout @member <10m|2h|1d> <reason>',
  async execute(context, args) {
    if (!await requirePermission(context, modPermission)) return;
    const target = await findMember(context, args[0]);
    const duration = parseDuration(args[1] ?? '');
    if (!target || !duration || duration > 28 * 86_400_000) return void await answer(context, `Usage: ${context.settings.prefix}timeout @member <10m|2h|1d> <reason>`);
    if (!target.moderatable) return void await answer(context, 'I cannot timeout that member. Check role hierarchy and my permissions.');
    await target.timeout(duration, args.slice(2).join(' ') || 'No reason provided');
    await answer(context, `${echoEmoji(context.message.guild, 'locked')} ${target.user.tag} was timed out for ${args[1]}.`);
    await logGuildEvent(context.message.guild, 'moderation', `${echoEmoji(context.message.guild, 'locked')} <@${target.id}> was timed out by <@${context.message.author.id}> for ${args[1]}.`);
  },
};

const kick: BotCommand = {
  name: 'kick', category: 'moderation', description: 'Kick a member from the server.', usage: 'kick @member <reason>',
  async execute(context, args) {
    if (!await requirePermission(context, PermissionFlagsBits.KickMembers)) return;
    const target = await findMember(context, args[0]);
    if (!target) return void await answer(context, 'Mention a member to kick.');
    if (!target.kickable) return void await answer(context, 'I cannot kick that member. Check role hierarchy and my permissions.');
    await target.kick(args.slice(1).join(' ') || 'No reason provided');
    await answer(context, `${echoEmoji(context.message.guild, 'kick')} ${target.user.tag} was kicked.`);
    await logGuildEvent(context.message.guild, 'moderation', `${echoEmoji(context.message.guild, 'kick')} <@${target.id}> was kicked by <@${context.message.author.id}>.`);
  },
};

const ban: BotCommand = {
  name: 'ban', category: 'moderation', description: 'Ban a member from the server.', usage: 'ban @member <reason>',
  async execute(context, args) {
    if (!await requirePermission(context, PermissionFlagsBits.BanMembers)) return;
    const target = await findMember(context, args[0]);
    if (!target) return void await answer(context, 'Mention a member to ban.');
    if (!target.bannable) return void await answer(context, 'I cannot ban that member. Check role hierarchy and my permissions.');
    await target.ban({ reason: args.slice(1).join(' ') || 'No reason provided' });
    await answer(context, `${echoEmoji(context.message.guild, 'ban')} ${target.user.tag} was banned.`);
    await logGuildEvent(context.message.guild, 'moderation', `${echoEmoji(context.message.guild, 'ban')} <@${target.id}> was banned by <@${context.message.author.id}>.`);
  },
};

const unban: BotCommand = {
  name: 'unban', category: 'moderation', description: 'Unban a user by ID or mention.', usage: 'unban <user-id|mention> [reason]',
  async execute(context, args) {
    if (!await requirePermission(context, PermissionFlagsBits.BanMembers)) return;
    const id = args[0]?.replace(/[<@!>]/g, '');
    if (!id || !/^\d{17,20}$/.test(id)) {
      return void await answer(context, `Usage: ${context.settings.prefix}unban <user-id|mention> [reason]`);
    }

    const reason = args.slice(1).join(' ').trim() || 'No reason provided';
    try {
      await context.message.guild.bans.remove(id, reason);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 10026) {
        return void await answer(context, 'That user is not banned from this server.');
      }
      throw error;
    }

    await answer(context, `${echoEmoji(context.message.guild, 'ban')} User \`${id}\` was unbanned.`);
    await logGuildEvent(context.message.guild, 'moderation', `${echoEmoji(context.message.guild, 'ban')} <@${id}> was unbanned by <@${context.message.author.id}>. Reason: ${reason}`);
  },
};

const clear: BotCommand = {
  name: 'clear', category: 'admin', description: 'Delete recent messages from this channel.', usage: 'clear <1-100>',
  async execute(context, args) {
    if (!await requirePermission(context, PermissionFlagsBits.ManageMessages)) return;
    const count = Number(args[0]);
    if (!Number.isInteger(count) || count < 1 || count > 100) return void await answer(context, `Usage: ${context.settings.prefix}clear <1-100>`);
    if (!('bulkDelete' in context.message.channel)) return void await answer(context, 'This channel does not support bulk deletion.');
    const deleted = await context.message.channel.bulkDelete(count + 1, true);
    await context.message.channel.send(`${echoEmoji(context.message.guild, 'clean')} Deleted ${Math.max(0, deleted.size - 1)} message(s).`).then(message => setTimeout(() => message.delete().catch(() => undefined), 4_000));
  },
};

const say: BotCommand = {
  name: 'say', category: 'admin', description: 'Post a message as Echo System.', usage: 'say <message>',
  async execute(context, args) {
    if (!await requirePermission(context, PermissionFlagsBits.ManageMessages)) return;
    const content = args.join(' ').trim();
    if (!content || content.length > 2_000) return void await answer(context, `Usage: ${context.settings.prefix}say <message under 2000 characters>`);
    await context.message.channel.send({ content, allowedMentions: { parse: [] } });
  },
};

function channelPermissionCommand(name: 'lock' | 'unlock' | 'hide' | 'show'): BotCommand {
  const lock = name === 'lock'; const hide = name === 'hide';
  return {
    name, category: 'admin', description: `${lock || hide ? 'Restrict' : 'Restore'} channel access for everyone.`,
    async execute(context) {
      if (!await requirePermission(context, PermissionFlagsBits.ManageChannels)) return;
      const channel = context.message.channel;
      if (!('permissionOverwrites' in channel)) return void await answer(context, 'This command needs a standard text channel.');
      if (hide || name === 'show') {
        await channel.permissionOverwrites.edit(context.message.guild.roles.everyone, { ViewChannel: hide ? false : null });
      } else {
        await channel.permissionOverwrites.edit(context.message.guild.roles.everyone, { SendMessages: lock ? false : null });
      }
      await answer(context, `${channel} access updated.`);
    },
  };
}

const setPrefix: BotCommand = {
  name: 'setprefix', category: 'admin', description: 'Change the command prefix for this server.', usage: 'setprefix <new-prefix>',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const prefix = args[0];
    if (!prefix || prefix.length > 5 || /\s/.test(prefix)) return void await answer(context, `Usage: ${context.settings.prefix}setprefix <1-5 characters, no spaces>`);
    await updateGuildSettings(context.message.guildId, { prefix });
    await answer(context, `Command prefix changed to \`${prefix}\`. Try \`${prefix}help\`.`);
  },
};

const greet: BotCommand = {
  name: 'greet', category: 'greet', description: 'Set the channel for welcome messages.', usage: 'greet #channel',
  async execute(context) {
    if (!await requirePermission(context, adminPermission)) return;
    const channel = context.message.mentions.channels.first();
    if (!channel || !channel.isTextBased()) return void await answer(context, `Usage: ${context.settings.prefix}greet #channel`);
    await updateGuildSettings(context.message.guildId, { welcomeChannelId: channel.id });
    await answer(context, `Welcome messages will be sent in ${channel}.`);
  },
};

const greetMessage: BotCommand = {
  name: 'greetmsg', category: 'greet', description: 'Set the welcome text. Use {user}, {server}, and {memberCount}.', usage: 'greetmsg <message>',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const message = args.join(' ').trim();
    if (!message || message.length > 1_000) return void await answer(context, `Usage: ${context.settings.prefix}greetmsg <message under 1000 characters>`);
    await updateGuildSettings(context.message.guildId, { welcomeMessage: message });
    await answer(context, 'Welcome message updated.');
  },
};

const greetDelete: BotCommand = {
  name: 'greetdel', category: 'greet', description: 'Set welcome-message auto-delete time in seconds (0 disables it).', usage: 'greetdel <0-60>',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const seconds = Number(args[0]);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 60) return void await answer(context, `Usage: ${context.settings.prefix}greetdel <0-60>`);
    await updateGuildSettings(context.message.guildId, { welcomeDeleteSeconds: seconds });
    await answer(context, seconds ? `Welcome messages will be removed after ${seconds} seconds.` : 'Welcome messages will stay in the channel.');
  },
};

const greetShow: BotCommand = {
  name: 'greetshow', category: 'greet', description: 'Show the current welcome-message settings.',
  async execute(context) {
    const channel = context.settings.welcomeChannelId ? `<#${context.settings.welcomeChannelId}>` : 'Not set';
    const embed = new EmbedBuilder().setColor(colors.brand).setTitle('Greeting settings')
      .addFields({ name: 'Channel', value: channel }, { name: 'Message', value: context.settings.welcomeMessage }, { name: 'Auto-delete', value: `${context.settings.welcomeDeleteSeconds}s` });
    await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  },
};

function createTicketPanel(context: CommandContext, ticketType: TicketType, arabic = false) {
  const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`${echoEmoji(context.message.guild, 'tickets')} Ticket System`)
    .setDescription(context.settings.ticketTypes?.[ticketType]?.panelMessage || context.settings.ticketPanelMessage || (arabic
      ? `اختر نوع التذكرة ${ticketType} لفتح تذكرة خاصة وسيساعدك فريقنا.`
      : `Choose ticket type ${ticketType} to open a private support ticket.`));
  const button = new ButtonBuilder()
    .setCustomId(`ticket:open:${ticketType}`)
    .setLabel(context.settings.ticketTypes?.[ticketType]?.buttonLabel || (arabic ? `تذكرة ${ticketType}` : `Open ticket ${ticketType}`))
    .setStyle(ButtonStyle.Primary);
  return { embed, button };
}

async function postTicketPanel(context: CommandContext, ticketType: TicketType, arabic = false): Promise<void> {
  const panel = createTicketPanel(context, ticketType, arabic);
  await context.message.channel.send({
    embeds: [panel.embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(panel.button)],
  });
}

const ticketPanel: BotCommand = {
  name: 'ticketpanel', category: 'tickets', description: 'Post separate ticket panels for all types or one selected type.', usage: 'ticketpanel [1|2|3|4|5]',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    if (args.length > 1 || (args[0] !== undefined && !isTicketType(args[0]))) {
      return void await answer(context, `Usage: ${context.settings.prefix}ticketpanel [1|2|3|4|5]`);
    }
    const panelTypes: readonly TicketType[] = args[0] !== undefined && isTicketType(args[0]) ? [args[0]] : TICKET_TYPES;
    for (const ticketType of panelTypes) await postTicketPanel(context, ticketType);
    await answer(context, panelTypes.length === 1 ? 'Ticket panel posted.' : 'Separate panels posted for all five ticket types.');
  },
};

const ticketTeam: BotCommand = {
  name: 'ticketteam', category: 'tickets', description: 'Post the Arabic support-team ticket panel.',
  async execute(context) {
    if (!await requirePermission(context, adminPermission)) return;
    for (const ticketType of TICKET_TYPES) await postTicketPanel(context, ticketType, true);
    await answer(context, 'Separate Arabic panels posted for all five ticket types.');
  },
};

const ticketSetup: BotCommand = {
  name: 'ticketsetup', category: 'tickets', description: 'Set all five ticket categories and post the ticket panel.', usage: 'ticketsetup #category1 #category2 #category3 #category4 #category5',
  async execute(context) {
    if (!await requirePermission(context, adminPermission)) return;
    const categories = [...context.message.mentions.channels.values()]
      .filter(channel => channel.type === 4);
    if (categories.length !== TICKET_TYPES.length || new Set(categories.map(category => category.id)).size !== TICKET_TYPES.length) {
      return void await answer(context, `Usage: ${context.settings.prefix}ticketsetup #category1 #category2 #category3 #category4 #category5 (use five different server categories)`);
    }
    const categorySettings = Object.fromEntries(
      TICKET_TYPES.map((ticketType, index) => [`ticketTypes.${ticketType}.categoryChannelId`, categories[index].id]),
    );
    await collections().guildSettings.updateOne(
      { guildId: context.message.guildId },
      {
        $set: {
          ...categorySettings,
          updatedAt: new Date(),
        },
        $setOnInsert: { guildId: context.message.guildId },
      },
      { upsert: true },
    );
    for (const ticketType of TICKET_TYPES) await postTicketPanel(context, ticketType);
    await answer(context, `Ticket categories configured and separate panels posted:\n${categories.map((category, index) => `${index + 1}. ${category}`).join('\n')}`);
  },
};

const ticketPanelText: BotCommand = {
  name: 'ticketpaneltext', category: 'tickets', description: 'Set shared or per-type ticket panel text.', usage: 'ticketpaneltext [1|2|3|4|5] <message|off>',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const ticketType = isTicketType(args[0]) ? args[0] : undefined;
    const message = args.slice(ticketType ? 1 : 0).join(' ').trim();
    if (!message || message.length > 1_000) {
      return void await answer(context, `Usage: ${context.settings.prefix}ticketpaneltext [1|2|3|4|5] <message under 1000 characters|off>`);
    }
    const value = message.toLowerCase() === 'off' ? null : message;
    if (ticketType) {
      await collections().guildSettings.updateOne(
        { guildId: context.message.guildId },
        { $set: { [`ticketTypes.${ticketType}.panelMessage`]: value, updatedAt: new Date() }, $setOnInsert: { guildId: context.message.guildId } },
        { upsert: true },
      );
      await answer(context, value
        ? `Panel text set for ticket type ${ticketType}. Repost its panel with \`${context.settings.prefix}ticketpanel ${ticketType}\` to apply it.`
        : `Panel text cleared for ticket type ${ticketType}. Repost its panel to apply the shared or default text.`);
      return;
    }
    await updateGuildSettings(context.message.guildId, { ticketPanelMessage: value });
    await answer(context, value
      ? 'Shared ticket panel text updated. Repost the panels to apply it where no type-specific text is set.'
      : 'Shared ticket panel text reset. Repost the panels to apply the default text where no type-specific text is set.');
  },
};

const ticketButtonText: BotCommand = {
  name: 'ticketbutton', category: 'tickets', description: 'Set the ticket panel button text for a type.', usage: 'ticketbutton <1|2|3|4|5> <text|off>',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const ticketType = args[0];
    const label = args.slice(1).join(' ').trim();
    if (!isTicketType(ticketType) || !label || (label.toLowerCase() !== 'off' && label.length > 80)) {
      return void await answer(context, `Usage: ${context.settings.prefix}ticketbutton <1|2|3|4|5> <text up to 80 characters|off>`);
    }
    const value = label.toLowerCase() === 'off' ? null : label;
    await collections().guildSettings.updateOne(
      { guildId: context.message.guildId },
      { $set: { [`ticketTypes.${ticketType}.buttonLabel`]: value, updatedAt: new Date() }, $setOnInsert: { guildId: context.message.guildId } },
      { upsert: true },
    );
    await answer(context, value
      ? `Ticket type ${ticketType} button text set to **${value}**. Post a new panel for the change to appear.`
      : `Ticket type ${ticketType} button text reset to its default. Post a new panel for the change to appear.`);
  },
};

const ticketRole: BotCommand = {
  name: 'ticketrole', category: 'tickets', description: 'Set or clear the support role for a ticket type.', usage: 'ticketrole <1|2|3|4|5> @role|off',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const ticketType = args[0];
    if (!isTicketType(ticketType)) {
      return void await answer(context, `Usage: ${context.settings.prefix}ticketrole <1|2|3|4|5> @role|off`);
    }
    if (args[1]?.toLowerCase() === 'off') {
      await collections().guildSettings.updateOne(
        { guildId: context.message.guildId },
        { $set: { [`ticketTypes.${ticketType}.supportRoleId`]: null, updatedAt: new Date() }, $setOnInsert: { guildId: context.message.guildId } },
        { upsert: true },
      );
      return void await answer(context, `Support role cleared for ticket type ${ticketType}.`);
    }
    const role = context.message.mentions.roles.first();
    if (!role) return void await answer(context, `Usage: ${context.settings.prefix}ticketrole <1|2|3|4|5> @role|off`);
    await collections().guildSettings.updateOne(
      { guildId: context.message.guildId },
      { $set: { [`ticketTypes.${ticketType}.supportRoleId`]: role.id, updatedAt: new Date() }, $setOnInsert: { guildId: context.message.guildId } },
      { upsert: true },
    );
    await answer(context, `Ticket type ${ticketType} support role set to ${role}.`);
  },
};

const ticketCategory: BotCommand = {
  name: 'ticketcategory', category: 'tickets', description: 'Set a ticket type’s parent category.', usage: 'ticketcategory <1|2|3|4|5> <category-id>',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const explicitType = isTicketType(args[0]) ? args[0] : undefined;
    const ticketType: TicketType = explicitType ?? '1';
    const channelId = (explicitType ? args[1] : args[0])?.replace(/[<#>]/g, '');
    const category = context.message.mentions.channels.first() ?? context.message.guild.channels.cache.get(channelId ?? '');
    if (!category || category.type !== 4) return void await answer(context, `Usage: ${context.settings.prefix}ticketcategory <1|2|3|4|5> <category-id>`);
    await collections().guildSettings.updateOne(
      { guildId: context.message.guildId },
      { $set: { [`ticketTypes.${ticketType}.categoryChannelId`]: category.id, updatedAt: new Date() }, $setOnInsert: { guildId: context.message.guildId } },
      { upsert: true },
    );
    await answer(context, `Ticket type ${ticketType} will be created under **${category.name}**.`);
  },
};

const ticketWelcome: BotCommand = {
  name: 'ticketwelcome', category: 'tickets', description: 'Set the opening message for a ticket type.', usage: 'ticketwelcome <1|2|3|4|5> <message|off>',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const ticketType = args[0];
    const message = args.slice(1).join(' ').trim();
    if (!isTicketType(ticketType) || !message || message.length > 1_500) {
      return void await answer(context, `Usage: ${context.settings.prefix}ticketwelcome <1|2|3|4|5> <message under 1500 characters|off>`);
    }
    const value = message.toLowerCase() === 'off' ? null : message;
    await collections().guildSettings.updateOne(
      { guildId: context.message.guildId },
      { $set: { [`ticketTypes.${ticketType}.welcomeMessage`]: value, updatedAt: new Date() }, $setOnInsert: { guildId: context.message.guildId } },
      { upsert: true },
    );
    await answer(context, value ? `Opening message set for ticket type ${ticketType}.` : `Custom opening message cleared for ticket type ${ticketType}.`);
  },
};

const ticketImage: BotCommand = {
  name: 'ticketimage', category: 'tickets', description: 'Set the opening image for a ticket type.', usage: 'ticketimage <1|2|3|4|5> <image-url|off>',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const ticketType = args[0];
    const input = args[1]?.trim();
    if (!isTicketType(ticketType) || !input) {
      return void await answer(context, `Usage: ${context.settings.prefix}ticketimage <1|2|3|4|5> <image-url|off>`);
    }
    if (input.toLowerCase() !== 'off') {
      let url: URL;
      try { url = new URL(input); }
      catch { return void await answer(context, 'Provide a valid HTTPS image URL or use `off`.'); }
      if (url.protocol !== 'https:' || input.length > 2_000) {
        return void await answer(context, 'Provide a valid HTTPS image URL under 2000 characters or use `off`.');
      }
    }
    const value = input.toLowerCase() === 'off' ? null : input;
    await collections().guildSettings.updateOne(
      { guildId: context.message.guildId },
      { $set: { [`ticketTypes.${ticketType}.imageUrl`]: value, updatedAt: new Date() }, $setOnInsert: { guildId: context.message.guildId } },
      { upsert: true },
    );
    await answer(context, value ? `Opening image set for ticket type ${ticketType}.` : `Opening image cleared for ticket type ${ticketType}.`);
  },
};
const giveaway: BotCommand = {
  name: 'giveaway', category: 'giveaways', description: 'Start a button-entry giveaway.', usage: 'giveaway <duration> <winners> <prize>',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const duration = parseDuration(args[0] ?? ''); const winnerCount = Number(args[1]); const prize = args.slice(2).join(' ').trim();
    if (!duration || duration > 30 * 86_400_000 || !Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20 || !prize) {
      return void await answer(context, `Usage: ${context.settings.prefix}giveaway <10m|2h|1d> <1-20 winners> <prize>`);
    }
    const id = randomUUID(); const endsAt = new Date(Date.now() + duration);
    const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`${echoEmoji(context.message.guild, 'giveaways')} Giveaway`)
      .setDescription(`**Prize:** ${prize}\n**Winners:** ${winnerCount}\n**Ends:** <t:${Math.floor(endsAt.getTime() / 1_000)}:R>\n\nPress the button to enter.`)
      .setFooter({ text: `Giveaway ID: ${id}` });
    const enterButton = new ButtonBuilder().setCustomId(`giveaway:enter:${id}`).setLabel('Enter giveaway').setStyle(ButtonStyle.Success);
    const leaveButton = new ButtonBuilder().setCustomId(`giveaway:leave:${id}`).setLabel('Leave giveaway').setStyle(ButtonStyle.Secondary);
    const buttonEmoji = echoEmojiOption(context.message.guild, 'giveaways');
    if (buttonEmoji) enterButton.setEmoji(buttonEmoji);
    const posted = await context.message.channel.send({ embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(enterButton, leaveButton)] });
    await collections().giveaways.insertOne({ id, guildId: context.message.guildId, channelId: context.message.channelId, messageId: posted.id, prize, winnerCount, endsAt, entries: [], status: 'active' });
    await answer(context, `Giveaway created. ID: \`${id}\``);
    await logGuildEvent(context.message.guild, 'giveaways', `Giveaway created: **${prize}**; ${winnerCount} winner(s); ends <t:${Math.floor(endsAt.getTime() / 1_000)}:F>. ID: \`${id}\`.`);
  },
};

const endGiveaway: BotCommand = {
  name: 'endgiveaway', aliases: ['gend'], category: 'giveaways', description: 'End an active giveaway early.', usage: 'endgiveaway <giveaway-id>',
  async execute(context, args) {
    if (!await requirePermission(context, adminPermission)) return;
    const giveawayRecord = await collections().giveaways.findOne({ guildId: context.message.guildId, id: args[0], status: 'active' });
    if (!giveawayRecord) return void await answer(context, `Usage: ${context.settings.prefix}endgiveaway <active-giveaway-id>`);
    const changed = await finishGiveaway(context.message.client, giveawayRecord);
    if (!changed) return void await answer(context, 'That giveaway has already ended.');
    await answer(context, 'Giveaway ended.');
  },
};

export async function finishGiveaway(client: Client, record: GiveawayRecord): Promise<boolean> {
  const pool = [...record.entries];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[other]] = [pool[other], pool[index]];
  }
  const winners = pool.slice(0, record.winnerCount);
  const updated = await collections().giveaways.updateOne(
    { id: record.id, status: 'active' }, { $set: { status: 'ended', winnerIds: winners } },
  );
  if (!updated.modifiedCount) return false;
  const guild = client.guilds.cache.get(record.guildId);
  if (guild) {
    await logGuildEvent(guild, 'giveaways', `Giveaway ended: **${record.prize}**; ${record.entries.length} entrant(s); ${winners.length ? `winner(s): ${winners.map(id => `<@${id}>`).join(', ')}` : 'no entries'}. ID: \`${record.id}\`.`);
  }
  const channel = await client.channels.fetch(record.channelId).catch(() => null);
  if (!channel?.isTextBased() || !('send' in channel)) return true;
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

const avatar: BotCommand = {
  name: 'avatar', category: 'general', description: 'Show a member’s avatar.', usage: 'avatar [@member]',
  async execute(context) {
    const user = context.message.mentions.users.first() ?? context.message.author;
    const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`${user.username}’s avatar`).setImage(user.displayAvatarURL({ size: 1_024 }));
    await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  },
};

const roles: BotCommand = {
  name: 'roles', category: 'general', description: 'List the server roles.',
  async execute(context) {
    const roleList = context.message.guild.roles.cache.filter(role => role.id !== context.message.guildId).sort((a, b) => b.position - a.position).first(25);
    const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`Roles in ${context.message.guild.name}`)
      .setDescription(roleList.length ? roleList.map(role => `${role} — ${role.members.size} member(s)`).join('\n') : 'No roles found.');
    await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  },
};

const server: BotCommand = {
  name: 'server', category: 'general', description: 'Show server details.',
  async execute(context) {
    const guild = context.message.guild;
    const embed = new EmbedBuilder().setColor(colors.brand).setTitle(guild.name).setThumbnail(guild.iconURL())
      .addFields({ name: 'Members', value: String(guild.memberCount), inline: true }, { name: 'Channels', value: String(guild.channels.cache.size), inline: true }, { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1_000)}:D>`, inline: true });
    await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  },
};

const calc: BotCommand = {
  name: 'calc', category: 'general', description: 'Calculate a basic arithmetic expression.', usage: 'calc (12 + 8) / 2',
  async execute(context, args) {
    try { await answer(context, `${echoEmoji(context.message.guild, 'calculator')} **${calculate(args.join(' '))}**`); }
    catch (error) { await answer(context, error instanceof Error ? error.message : 'Invalid expression.'); }
  },
};

const snipe: BotCommand = {
  name: 'snipe', category: 'general', description: 'Show the latest deleted message in this channel.',
  async execute(context) {
    const deleted = deletedMessages.get(context.message.channelId);
    if (!deleted) return void await answer(context, 'There is no recent deleted message in this channel.');
    const embed = new EmbedBuilder().setColor(colors.brand).setAuthor({ name: deleted.authorTag }).setDescription(deleted.content || '*No text content*').setTimestamp(deleted.deletedAt);
    await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  },
};

const ping: BotCommand = {
  name: 'ping', category: 'system', description: 'Check the bot response and gateway latency.',
  async execute(context) { await answer(context, `${echoEmoji(context.message.guild, 'ping')} Pong! Gateway: ${context.message.client.ws.ping}ms`); },
};

const uptime: BotCommand = {
  name: 'uptime', category: 'system', description: 'Show how long Echo System has been online.',
  async execute(context) {
    const seconds = Math.floor(process.uptime()); const days = Math.floor(seconds / 86_400); const hours = Math.floor(seconds % 86_400 / 3_600); const minutes = Math.floor(seconds % 3_600 / 60);
    await answer(context, `Online for **${days}d ${hours}h ${minutes}m**.`);
  },
};

const setName: BotCommand = {
  name: 'setname', category: 'owner', description: 'Change the bot account display name.', usage: 'setname <new name>',
  async execute(context, args) {
    if (!await isBotOwner(context.message.author.id)) return void await answer(context, 'This is an owner-only command.');
    const name = args.join(' ').trim();
    if (!name || name.length > 32) return void await answer(context, `Usage: ${context.settings.prefix}setname <1-32 characters>`);
    await context.message.client.user?.setUsername(name);
    await answer(context, `Bot name changed to **${name}**.`);
  },
};

const setStatus: BotCommand = {
  name: 'setstatus', category: 'owner', description: 'Change the bot activity shown in its profile.', usage: 'setstatus <activity>',
  async execute(context, args) {
    if (!await isBotOwner(context.message.author.id)) return void await answer(context, 'This is an owner-only command.');
    const activity = args.join(' ').trim();
    if (!activity || activity.length > 128) return void await answer(context, `Usage: ${context.settings.prefix}setstatus <activity>`);
    context.message.client.user?.setActivity(activity);
    await answer(context, `Activity set to **${activity}**.`);
  },
};

export const commands: BotCommand[] = [
  warn, warns, removeWarn, resetWarns, timeout, kick, ban, unban,
  clear, say, channelPermissionCommand('lock'), channelPermissionCommand('unlock'), channelPermissionCommand('hide'), channelPermissionCommand('show'), setPrefix,
  greet, greetMessage, greetDelete, greetShow,
  ticketPanel, ticketTeam, ticketSetup, ticketPanelText, ticketButtonText, ticketRole, ticketCategory, ticketWelcome, ticketImage,
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

export const commandMap = new Map(commands.flatMap(command => [command.name, ...(command.aliases ?? [])].map(name => [name, command] as const)));
export const commandColors = colors;
