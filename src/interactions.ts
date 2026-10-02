import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits,
  type ButtonInteraction, type Interaction,
} from 'discord.js';
import { collections, getGuildSettings } from './database.js';
import { commandColors } from './commands.js';
import { helpEmbed, helpMenu } from './help.js';
import type { HelpCategory } from './types.js';
import { echoEmoji, echoEmojiOption } from './emojis.js';

const categories = new Set<HelpCategory>(['owner', 'system', 'moderation', 'general', 'admin', 'premium', 'giveaways', 'greet', 'tickets', 'economy', 'activity', 'leveling', 'security', 'voice']);

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('echo:help:')) {
    const requesterId = interaction.customId.split(':')[2];
    if (interaction.user.id !== requesterId) {
      await interaction.reply({ content: 'Only the person who opened this help menu can use it.', ephemeral: true });
      return;
    }
    const selected = interaction.values[0] as HelpCategory;
    if (!categories.has(selected)) return;
    const prefix = interaction.guildId ? (await getGuildSettings(interaction.guildId)).prefix : '$';
    await interaction.update({ embeds: [helpEmbed(prefix, selected, interaction.guild)], components: [helpMenu(requesterId, interaction.guild)] });
    return;
  }

  if (!interaction.isButton()) return;
  if (interaction.customId.startsWith('giveaway:enter:')) {
    const id = interaction.customId.slice('giveaway:enter:'.length);
    const result = await collections().giveaways.updateOne(
      { id, status: 'active', endsAt: { $gt: new Date() } }, { $addToSet: { entries: interaction.user.id } },
    );
    await interaction.reply({
      content: result.modifiedCount ? 'You are entered in the giveaway. Good luck!' : 'This giveaway has ended or you already entered.',
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === 'ticket:open') await openTicket(interaction);
  else if (interaction.customId === 'ticket:close') await closeTicket(interaction);
}

async function openTicket(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;
  await interaction.deferReply({ ephemeral: true });
  const settings = await getGuildSettings(interaction.guildId);
  const existing = await collections().tickets.findOne({ guildId: interaction.guildId, creatorId: interaction.user.id, status: 'open' });
  if (existing) {
    const existingChannel = await interaction.guild.channels.fetch(existing.channelId).catch(() => null);
    if (existingChannel) {
      await interaction.editReply(`You already have an open ticket: ${existingChannel}`);
      return;
    }
    await collections().tickets.updateOne({ id: existing.id }, { $set: { status: 'closed', closedAt: new Date() } });
  }

  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80) || 'member';
  const channel = await interaction.guild.channels.create({
    name: `ticket-${safeName}`,
    type: ChannelType.GuildText,
    parent: settings.ticketCategoryId ?? undefined,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ...(settings.supportRoleId ? [{ id: settings.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
    ],
  });
  const record = { id: `${interaction.guildId}-${channel.id}`, guildId: interaction.guildId, channelId: channel.id, creatorId: interaction.user.id, status: 'open' as const, createdAt: new Date(), closedAt: null };
  await collections().tickets.insertOne(record);
  const closeButton = new ButtonBuilder().setCustomId('ticket:close').setLabel('Close ticket').setStyle(ButtonStyle.Danger);
  const ticketEmoji = echoEmojiOption(interaction.guild, 'tickets');
  if (ticketEmoji) closeButton.setEmoji(ticketEmoji);
  const embed = new EmbedBuilder().setColor(commandColors.brand).setTitle(`${echoEmoji(interaction.guild, 'tickets')} Support ticket`)
    .setDescription(`Hello ${interaction.user}, please describe what you need help with. A staff member will be with you shortly.`)
    .setFooter({ text: `Ticket ID: ${record.id}` });
  await channel.send({ content: settings.supportRoleId ? `<@&${settings.supportRoleId}>` : undefined, embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton)], allowedMentions: { roles: settings.supportRoleId ? [settings.supportRoleId] : [] } });
  await interaction.editReply(`Your ticket is open: ${channel}`);
}

async function closeTicket(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild || !interaction.channelId || !interaction.channel || !('permissionOverwrites' in interaction.channel)) return;
  await interaction.deferReply({ ephemeral: true });
  const ticket = await collections().tickets.findOne({ guildId: interaction.guildId, channelId: interaction.channelId, status: 'open' });
  if (!ticket) return void await interaction.editReply('This channel is not an open ticket.');
  const settings = await getGuildSettings(interaction.guildId);
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isSupport = settings.supportRoleId ? member.roles.cache.has(settings.supportRoleId) : false;
  if (ticket.creatorId !== interaction.user.id && !member.permissions.has(PermissionFlagsBits.ManageChannels) && !isSupport) {
    return void await interaction.editReply('Only the ticket creator or support team can close this ticket.');
  }
  await collections().tickets.updateOne({ id: ticket.id, status: 'open' }, { $set: { status: 'closed', closedAt: new Date() } });
  await interaction.channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: false });
  await interaction.editReply('Ticket closed. Staff can still review the conversation.');
  if (settings.ticketLogChannelId) {
    const logChannel = await interaction.guild.channels.fetch(settings.ticketLogChannelId).catch(() => null);
    if (logChannel?.isTextBased() && 'send' in logChannel) await logChannel.send(`Ticket ${interaction.channel} was closed by ${interaction.user}.`);
  }
}
