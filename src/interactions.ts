import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits,
  type ButtonInteraction, type Interaction,
} from 'discord.js';
import { collections, getGuildSettings } from './database.js';
import { commandColors } from './commands.js';
import { helpEmbed, helpMenu } from './help.js';
import type { HelpCategory, TicketType } from './types.js';
import { echoEmoji, echoEmojiOption } from './emojis.js';
import { getLogChannelId, logGuildEvent, logCategoryLabels } from './features/logging/service.js';
import { handleTemporaryVoiceInteraction } from './features/voice/panel.js';

const categories = new Set<HelpCategory>(['owner', 'system', 'moderation', 'general', 'admin', 'premium', 'giveaways', 'greet', 'tickets', 'economy', 'activity', 'leveling', 'security', 'voice', 'nadeko']);

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if ((interaction.isButton() || interaction.isUserSelectMenu() || interaction.isModalSubmit()) &&
    await handleTemporaryVoiceInteraction(interaction)) return;

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
  if (interaction.customId.startsWith('giveaway:enter:') || interaction.customId.startsWith('giveaway:leave:')) {
    const entering = interaction.customId.startsWith('giveaway:enter:');
    const prefix = entering ? 'giveaway:enter:' : 'giveaway:leave:';
    const id = interaction.customId.slice(prefix.length);
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: 'Giveaway buttons only work in a server.', ephemeral: true });
      return;
    }
    const giveawayFilter = {
      id,
      guildId: interaction.guildId,
      status: 'active' as const,
      endsAt: { $gt: new Date() },
      ...(entering ? { entries: { $ne: interaction.user.id } } : { entries: interaction.user.id }),
    };
    const result = entering
      ? await collections().giveaways.updateOne(giveawayFilter, { $addToSet: { entries: interaction.user.id } })
      : await collections().giveaways.updateOne(giveawayFilter, [
        { $set: { entries: { $filter: { input: '$entries', as: 'entry', cond: { $ne: ['$$entry', interaction.user.id] } } } } },
      ]);
    if (result.modifiedCount) {
      const verb = entering ? 'entered' : 'left';
      await interaction.reply({ content: entering ? 'You are entered in the giveaway. Good luck!' : 'You left the giveaway.', ephemeral: true });
      await logGuildEvent(interaction.guild, 'giveaways', `Giveaway entry: <@${interaction.user.id}> ${verb} **${id}**.`);
      return;
    }
    const activeGiveaway = await collections().giveaways.findOne({
      id, guildId: interaction.guildId, status: 'active', endsAt: { $gt: new Date() },
    });
    await interaction.reply({
      content: !activeGiveaway
        ? 'This giveaway has ended or does not exist.'
        : entering
          ? 'You are already entered in this giveaway.'
          : 'You are not entered in this giveaway.',
      ephemeral: true,
    });
    return;
  }

  const ticketOpenMatch = interaction.customId.match(/^ticket:open:([1-5])$/);
  if (interaction.customId === 'ticket:open' || ticketOpenMatch) {
    await openTicket(interaction, (ticketOpenMatch?.[1] ?? '1') as TicketType);
  } else if (interaction.customId === 'ticket:claim') await claimTicket(interaction);
  else if (interaction.customId === 'ticket:unclaim') await unclaimTicket(interaction);
  else if (interaction.customId === 'ticket:close') await closeTicket(interaction);
}

async function openTicket(interaction: ButtonInteraction, ticketType: TicketType): Promise<void> {
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
  const typeSettings = settings.ticketTypes?.[ticketType];
  const parentId = typeSettings?.categoryChannelId ?? (ticketType === '1' ? settings.ticketCategoryId : null);
  const supportRoleId = typeSettings && Object.hasOwn(typeSettings, 'supportRoleId')
    ? typeSettings.supportRoleId
    : settings.supportRoleId;
  const channel = await interaction.guild.channels.create({
    name: `ticket-${safeName}`,
    type: ChannelType.GuildText,
    parent: parentId ?? undefined,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ...(supportRoleId ? [{ id: supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
    ],
  });
  const record = { id: `${interaction.guildId}-${channel.id}`, guildId: interaction.guildId, channelId: channel.id, creatorId: interaction.user.id, status: 'open' as const, createdAt: new Date(), closedAt: null, ticketType };
  await collections().tickets.insertOne(record);
  const closeButton = new ButtonBuilder().setCustomId('ticket:close').setLabel('Close ticket').setStyle(ButtonStyle.Danger);
  const claimButton = new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim ticket').setStyle(ButtonStyle.Success);
  const unclaimButton = new ButtonBuilder().setCustomId('ticket:unclaim').setLabel('Unclaim ticket').setStyle(ButtonStyle.Secondary);
  const ticketEmoji = echoEmojiOption(interaction.guild, 'tickets');
  if (ticketEmoji) {
    closeButton.setEmoji(ticketEmoji);
    claimButton.setEmoji(ticketEmoji);
  }
  const welcomeMessage = (typeSettings?.welcomeMessage || 'Hello {user}, please describe what you need help with. A staff member will be with you shortly.')
    .replaceAll('{user}', `${interaction.user}`)
    .replaceAll('{server}', interaction.guild.name)
    .replaceAll('{category}', ticketType);
  const embed = new EmbedBuilder().setColor(commandColors.brand).setTitle(`${echoEmoji(interaction.guild, 'tickets')} Support ticket • Type ${ticketType}`)
    .setDescription(welcomeMessage)
    .setFooter({ text: `Ticket ID: ${record.id}` });
  if (typeSettings?.imageUrl) embed.setImage(typeSettings.imageUrl);
  await channel.send({
    content: supportRoleId ? `<@&${supportRoleId}>` : undefined,
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton, unclaimButton, closeButton)],
    allowedMentions: { roles: supportRoleId ? [supportRoleId] : [], users: [interaction.user.id] },
  });
  await interaction.editReply(`Your ticket is open: ${channel}`);
  await logGuildEvent(interaction.guild, 'tickets', `Ticket opened by <@${interaction.user.id}>: ${channel}, type **${ticketType}**.`);
}

async function getTicketStaffStatus(interaction: ButtonInteraction): Promise<{ isStaff: boolean; isManager: boolean }> {
  if (!interaction.guild || !interaction.guildId) return { isStaff: false, isManager: false };
  const [settings, member] = await Promise.all([
    getGuildSettings(interaction.guildId),
    interaction.guild.members.fetch(interaction.user.id),
  ]);
  const isManager = member.permissions.has(PermissionFlagsBits.ManageChannels);
  const ticket = await collections().tickets.findOne({ guildId: interaction.guildId, channelId: interaction.channelId });
  const typeSettings = ticket ? settings.ticketTypes?.[ticket.ticketType ?? '1'] : undefined;
  const supportRoleId = typeSettings && Object.hasOwn(typeSettings, 'supportRoleId')
    ? typeSettings.supportRoleId
    : settings.supportRoleId;
  return { isStaff: isManager || Boolean(supportRoleId && member.roles.cache.has(supportRoleId)), isManager };
}

async function claimTicket(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;
  await interaction.deferReply({ ephemeral: true });
  const ticket = await collections().tickets.findOne({ guildId: interaction.guildId, channelId: interaction.channelId, status: 'open' });
  if (!ticket) return void await interaction.editReply('This channel is not an open ticket.');
  const { isStaff } = await getTicketStaffStatus(interaction);
  if (!isStaff) return void await interaction.editReply('Only support staff can claim tickets.');
  const claimed = await collections().tickets.updateOne(
    { id: ticket.id, status: 'open', claimedBy: { $exists: false } },
    { $set: { claimedBy: interaction.user.id } },
  );
  if (!claimed.modifiedCount) return void await interaction.editReply(ticket.claimedBy ? `This ticket is already claimed by <@${ticket.claimedBy}>.` : 'This ticket is no longer open.');
  await interaction.editReply('You claimed this ticket.');
  await logGuildEvent(interaction.guild, 'tickets', `Ticket ${interaction.channel} was claimed by <@${interaction.user.id}>.`);
}

async function unclaimTicket(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;
  await interaction.deferReply({ ephemeral: true });
  const ticket = await collections().tickets.findOne({ guildId: interaction.guildId, channelId: interaction.channelId, status: 'open' });
  if (!ticket) return void await interaction.editReply('This channel is not an open ticket.');
  const { isStaff, isManager } = await getTicketStaffStatus(interaction);
  if (!isStaff) return void await interaction.editReply('Only support staff can unclaim tickets.');
  if (!ticket.claimedBy) return void await interaction.editReply('This ticket is not claimed.');
  if (ticket.claimedBy !== interaction.user.id && !isManager) {
    return void await interaction.editReply('Only the staff member who claimed this ticket or a channel manager can unclaim it.');
  }
  const unclaimed = await collections().tickets.updateOne(
    { id: ticket.id, status: 'open', claimedBy: ticket.claimedBy },
    { $unset: { claimedBy: '' } },
  );
  if (!unclaimed.modifiedCount) return void await interaction.editReply('The ticket claim changed before it could be removed. Try again.');
  await interaction.editReply('Ticket unclaimed.');
  await logGuildEvent(interaction.guild, 'tickets', `Ticket ${interaction.channel} was unclaimed by <@${interaction.user.id}> (previously claimed by <@${ticket.claimedBy}>).`);
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
  const closed = await collections().tickets.updateOne({ id: ticket.id, status: 'open' }, { $set: { status: 'closed', closedAt: new Date() } });
  if (!closed.modifiedCount) return void await interaction.editReply('This ticket has already been closed.');
  await interaction.channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: false });
  await interaction.editReply('Ticket closed. Staff can still review the conversation.');
  await logGuildEvent(interaction.guild, 'tickets', `Ticket ${interaction.channel} was closed by <@${interaction.user.id}>. Created by <@${ticket.creatorId}>; type **${ticket.ticketType ?? '1'}**.`);
  try {
    const sent = await sendTicketTranscript(interaction, ticket.id);
    if (!sent) {
      await interaction.followUp({ content: 'Ticket closed. No transcript channel is configured; use `setlogs transcripts #channel` to enable transcript delivery.', ephemeral: true });
    }
  } catch (error) {
    console.error(`Could not send transcript for ticket ${ticket.id}:`, error);
    await interaction.followUp({ content: 'The ticket was closed, but I could not send its transcript. Check my channel and attachment permissions.', ephemeral: true });
  }
}

async function sendTicketTranscript(interaction: ButtonInteraction, ticketId: string): Promise<boolean> {
  if (!interaction.guild || !interaction.channel || !('messages' in interaction.channel)) return false;
  const destinationId = await getLogChannelId(interaction.guild, 'transcripts');
  if (!destinationId) {
    console.info(`[Echo ticket transcript ${interaction.guildId}] Ticket ${ticketId} closed without a transcript destination configured.`);
    return false;
  }
  const destination = await interaction.guild.channels.fetch(destinationId);
  if (!destination?.isTextBased() || !('send' in destination)) {
    throw new Error(`Configured ticket transcript destination ${destinationId} is not a text channel.`);
  }

  const messages = [];
  let before: string | undefined;
  let truncated = false;
  for (let page = 0; page < 10; page += 1) {
    const batch = await interaction.channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    messages.push(...batch.values());
    if (batch.size < 100) break;
    before = batch.last()?.id;
    if (page === 9) truncated = true;
  }
  const transcript = messages.reverse().map(message => {
    const timestamp = message.createdAt.toISOString();
    const attachments = message.attachments.map(attachment => `\n[Attachment: ${attachment.name ?? attachment.url}] ${attachment.url}`).join('');
    return `[${timestamp}] ${message.author.tag}: ${message.content || '[no text]'}${attachments}`;
  }).join('\n\n');
  const transcriptTruncated = transcript.length > 1_000_000;
  const boundedTranscript = transcriptTruncated ? `${transcript.slice(0, 1_000_000)}\n\n[Transcript content truncated at 1 MB]` : transcript;
  const body = `Ticket transcript: ${ticketId}\nChannel: ${interaction.channelId}\nClosed by: ${interaction.user.tag}\nMessages: ${messages.length}${truncated ? ' (limited to latest 1,000 messages)' : ''}${transcriptTruncated ? ' (content capped at 1 MB)' : ''}\n\n${boundedTranscript}`;
  const attachment = new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: `ticket-${ticketId}-transcript.txt` });
  const embed = new EmbedBuilder().setColor(commandColors.brand).setTitle(`${echoEmoji(interaction.guild, 'tickets')} Ticket transcript`)
    .setDescription(`Ticket <#${interaction.channelId}> closed by <@${interaction.user.id}>. ${messages.length} message(s)${truncated ? '; limited to latest 1,000 messages' : ''}${transcriptTruncated ? '; content capped at 1 MB' : ''}.`)
    .setTimestamp();
  await destination.send({ embeds: [embed], files: [attachment], allowedMentions: { parse: [] } });
  return true;
}
