import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, } from 'discord.js';
import { collections } from '../../database.js';
const ownerPermissions = {
    ViewChannel: true,
    Connect: true,
    Speak: true,
    ManageChannels: true,
    MoveMembers: true,
    MuteMembers: true,
    DeafenMembers: true,
};
function panelRows(channelId, locked, hidden) {
    return [
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tempvoice:lock:${channelId}`).setLabel(locked ? 'Unlock room' : 'Lock room').setStyle(locked ? ButtonStyle.Success : ButtonStyle.Secondary), new ButtonBuilder().setCustomId(`tempvoice:hide:${channelId}`).setLabel(hidden ? 'Show room' : 'Hide room').setStyle(hidden ? ButtonStyle.Success : ButtonStyle.Secondary), new ButtonBuilder().setCustomId(`tempvoice:configure:${channelId}`).setLabel('Configure room').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`tempvoice:claim:${channelId}`).setLabel('Claim room').setStyle(ButtonStyle.Secondary)),
        new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`tempvoice:owner:${channelId}`).setPlaceholder('Transfer ownership to a room member').setMinValues(1).setMaxValues(1)),
        new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`tempvoice:allow:${channelId}`).setPlaceholder('Allow a user to join').setMinValues(1).setMaxValues(1)),
        new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`tempvoice:block:${channelId}`).setPlaceholder('Block a user from the room').setMinValues(1).setMaxValues(1)),
        new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`tempvoice:disconnect:${channelId}`).setPlaceholder('Disconnect a user from the room').setMinValues(1).setMaxValues(1)),
    ];
}
function panelEmbed(channel, ownerId) {
    const everyoneOverwrite = channel.permissionOverwrites.cache.get(channel.guild.id);
    const locked = everyoneOverwrite?.deny.has(PermissionFlagsBits.Connect) ?? false;
    const hidden = everyoneOverwrite?.deny.has(PermissionFlagsBits.ViewChannel) ?? false;
    return new EmbedBuilder()
        .setColor(0x7658e8)
        .setTitle('Temporary Voice Room Controls')
        .setDescription([
        `**Owner:** <@${ownerId}>`,
        `**Room:** ${channel}`,
        `**Privacy:** ${hidden ? 'Hidden' : 'Visible'} · ${locked ? 'Locked' : 'Open'}`,
        `**Members:** ${channel.members.size}${channel.userLimit ? `/${channel.userLimit}` : ''}`,
        '',
        'Use the buttons to manage privacy and settings. Use the selectors to transfer ownership, manage access, or disconnect a member.',
    ].join('\n'))
        .setTimestamp();
}
export async function sendTemporaryVoicePanel(channel, ownerId) {
    await channel.send({ embeds: [panelEmbed(channel, ownerId)], components: panelRows(channel.id, false, false) });
}
async function findOwnedRoom(channelId, guildId) {
    return collections().temporaryVoiceRooms.findOne({ _id: channelId, guildId });
}
async function isRoomManager(interaction, ownerId) {
    if (!interaction.guild)
        return false;
    if (ownerId === interaction.user.id)
        return true;
    const member = await interaction.guild.members.fetch(interaction.user.id);
    return member.permissions.has(PermissionFlagsBits.ManageChannels);
}
async function updatePanel(interaction, channel, ownerId) {
    const everyoneOverwrite = channel.permissionOverwrites.cache.get(channel.guild.id);
    const locked = everyoneOverwrite?.deny.has(PermissionFlagsBits.Connect) ?? false;
    const hidden = everyoneOverwrite?.deny.has(PermissionFlagsBits.ViewChannel) ?? false;
    await interaction.message.edit({ embeds: [panelEmbed(channel, ownerId)], components: panelRows(channel.id, locked, hidden) });
}
export async function handleTemporaryVoiceInteraction(interaction) {
    const prefix = 'tempvoice:';
    if (!interaction.customId.startsWith(prefix))
        return false;
    if (!interaction.guild || !interaction.guildId) {
        await interaction.reply({ content: 'Room controls only work in a server.', ephemeral: true });
        return true;
    }
    const [, action, channelId] = interaction.customId.split(':');
    if (!action || !channelId)
        return false;
    const room = await findOwnedRoom(channelId, interaction.guildId);
    if (!room) {
        await interaction.reply({ content: 'This temporary room no longer exists.', ephemeral: true });
        return true;
    }
    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel?.isVoiceBased() || !('permissionOverwrites' in channel)) {
        await interaction.reply({ content: 'The temporary room could not be found.', ephemeral: true });
        return true;
    }
    if (action === 'configure' && interaction.isButton()) {
        if (!await isRoomManager(interaction, room.ownerId)) {
            await interaction.reply({ content: 'Only the room owner or a channel manager can control this room.', ephemeral: true });
            return true;
        }
        const modal = new ModalBuilder()
            .setCustomId(`tempvoice:settings:${channelId}`)
            .setTitle('Configure temporary room');
        const name = new TextInputBuilder().setCustomId('name').setLabel('Room name').setStyle(TextInputStyle.Short)
            .setValue(channel.name).setMinLength(2).setMaxLength(100).setRequired(true);
        const limit = new TextInputBuilder().setCustomId('limit').setLabel('User limit (0 = unlimited)').setStyle(TextInputStyle.Short)
            .setValue(String(channel.userLimit)).setMaxLength(2).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(name), new ActionRowBuilder().addComponents(limit));
        await interaction.showModal(modal);
        return true;
    }
    if (!interaction.isButton() && !interaction.isUserSelectMenu() && !interaction.isModalSubmit())
        return false;
    if (interaction.isModalSubmit() && action !== 'settings')
        return false;
    if (interaction.isUserSelectMenu() && !['owner', 'allow', 'block', 'disconnect'].includes(action))
        return false;
    if (interaction.isButton() && !['lock', 'hide', 'claim'].includes(action))
        return false;
    if (!await isRoomManager(interaction, room.ownerId) && action !== 'claim') {
        await interaction.reply({ content: 'Only the room owner or a channel manager can control this room.', ephemeral: true });
        return true;
    }
    if (action === 'claim' && interaction.isButton()) {
        if (!channel.members.has(interaction.user.id)) {
            await interaction.reply({ content: 'Join the room before claiming it.', ephemeral: true });
            return true;
        }
        if (channel.members.has(room.ownerId)) {
            await interaction.reply({ content: 'The current owner is still in the room. Ask them to transfer ownership instead.', ephemeral: true });
            return true;
        }
        const result = await collections().temporaryVoiceRooms.updateOne({ _id: channelId, ownerId: room.ownerId }, { $set: { ownerId: interaction.user.id } });
        if (!result.modifiedCount) {
            await interaction.reply({ content: 'The room ownership changed. Try again.', ephemeral: true });
            return true;
        }
        await channel.permissionOverwrites.edit(interaction.user.id, ownerPermissions);
        await interaction.reply({ content: 'You claimed this room.', ephemeral: true });
        await updatePanel(interaction, channel, interaction.user.id);
        return true;
    }
    if (action === 'lock' && interaction.isButton()) {
        const overwrite = channel.permissionOverwrites.cache.get(interaction.guild.id);
        const locked = overwrite?.deny.has(PermissionFlagsBits.Connect) ?? false;
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: locked ? null : false });
        await interaction.reply({ content: locked ? 'Room unlocked.' : 'Room locked.', ephemeral: true });
        await updatePanel(interaction, channel, room.ownerId);
        return true;
    }
    if (action === 'hide' && interaction.isButton()) {
        const overwrite = channel.permissionOverwrites.cache.get(interaction.guild.id);
        const hidden = overwrite?.deny.has(PermissionFlagsBits.ViewChannel) ?? false;
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            ViewChannel: hidden ? null : false,
            Connect: hidden ? null : false,
        });
        await interaction.reply({ content: hidden ? 'Room is visible again.' : 'Room hidden.', ephemeral: true });
        await updatePanel(interaction, channel, room.ownerId);
        return true;
    }
    if (action === 'settings' && interaction.isModalSubmit()) {
        const name = interaction.fields.getTextInputValue('name').trim();
        const limitText = interaction.fields.getTextInputValue('limit').trim();
        const userLimit = Number(limitText);
        if (name.length < 2 || name.length > 100 || !/^\d{1,2}$/.test(limitText) || !Number.isInteger(userLimit) || userLimit < 0 || userLimit > 99) {
            await interaction.reply({ content: 'Use a 2–100 character room name and a whole-number user limit from 0 to 99.', ephemeral: true });
            return true;
        }
        await channel.edit({ name, userLimit, reason: 'Temporary room owner updated room settings' });
        await interaction.reply({ content: 'Room settings updated.', ephemeral: true });
        return true;
    }
    if (interaction.isUserSelectMenu()) {
        const targetId = interaction.values[0];
        if (!targetId) {
            await interaction.reply({ content: 'Select a user first.', ephemeral: true });
            return true;
        }
        if (action === 'owner') {
            if (targetId === room.ownerId) {
                await interaction.reply({ content: 'You already own this room.', ephemeral: true });
                return true;
            }
            if (!channel.members.has(targetId)) {
                await interaction.reply({ content: 'Ownership can only be transferred to someone currently in the room.', ephemeral: true });
                return true;
            }
            const result = await collections().temporaryVoiceRooms.updateOne({ _id: channelId, ownerId: room.ownerId }, { $set: { ownerId: targetId } });
            if (!result.modifiedCount) {
                await interaction.reply({ content: 'The room ownership changed. Try again.', ephemeral: true });
                return true;
            }
            await channel.permissionOverwrites.edit(room.ownerId, { ManageChannels: null, MoveMembers: null, MuteMembers: null, DeafenMembers: null });
            await channel.permissionOverwrites.edit(targetId, ownerPermissions);
            await interaction.reply({ content: `Room ownership transferred to <@${targetId}>.`, ephemeral: true });
            await updatePanel(interaction, channel, targetId);
            return true;
        }
        if (action === 'allow' || action === 'block') {
            const allowed = action === 'allow';
            await channel.permissionOverwrites.edit(targetId, {
                ViewChannel: allowed,
                Connect: allowed,
            });
            await interaction.reply({ content: allowed ? `<@${targetId}> can now view and join the room.` : `<@${targetId}> is blocked from the room.`, ephemeral: true });
            return true;
        }
        if (action === 'disconnect') {
            const target = await interaction.guild.members.fetch(targetId);
            if (target.voice.channelId !== channelId) {
                await interaction.reply({ content: 'That user is not currently in this room.', ephemeral: true });
                return true;
            }
            await target.voice.setChannel(null, 'Removed using temporary room controls');
            await interaction.reply({ content: `<@${targetId}> was disconnected from the room.`, ephemeral: true });
            return true;
        }
    }
    return false;
}
