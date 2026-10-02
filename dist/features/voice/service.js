import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { collections, getGuildSettings } from '../../database.js';
export async function handleTemporaryVoiceState(oldState, newState) {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot)
        return;
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const room = await collections().temporaryVoiceRooms.findOne({ _id: oldState.channelId });
        if (room && oldState.channel?.members.size === 0)
            await deleteTemporaryRoom(oldState.guild, oldState.channelId);
    }
    if (!newState.channelId)
        return;
    const settings = await getGuildSettings(member.guild.id);
    if (!settings.tempVoiceTriggerChannelId || newState.channelId !== settings.tempVoiceTriggerChannelId)
        return;
    const safeName = member.displayName.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 78) || 'Member';
    const createdRoom = await member.guild.channels.create({
        name: `Echo | ${safeName}`,
        type: ChannelType.GuildVoice,
        parent: settings.tempVoiceCategoryId ?? undefined,
        permissionOverwrites: [
            { id: member.guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
            { id: member.id, allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.Connect,
                    PermissionFlagsBits.Speak,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.MoveMembers,
                    PermissionFlagsBits.MuteMembers,
                    PermissionFlagsBits.DeafenMembers,
                ] },
            { id: member.client.user.id, allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.Connect,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.MoveMembers,
                ] },
        ],
        reason: `Temporary voice room created for ${member.user.tag}`,
    });
    await collections().temporaryVoiceRooms.insertOne({
        _id: createdRoom.id,
        guildId: member.guild.id,
        ownerId: member.id,
        createdAt: new Date(),
    });
    try {
        await member.voice.setChannel(createdRoom, 'Joined the temporary voice trigger channel');
    }
    catch (error) {
        await deleteTemporaryRoom(member.guild, createdRoom.id);
        throw error;
    }
}
async function deleteTemporaryRoom(guild, channelId) {
    const room = await collections().temporaryVoiceRooms.findOne({ _id: channelId, guildId: guild.id });
    if (!room)
        return;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel?.isVoiceBased() && channel.members.size > 0)
        return;
    await channel?.delete('Temporary voice room is empty').catch(() => undefined);
    await collections().temporaryVoiceRooms.deleteOne({ _id: channelId });
}
export async function cleanupTemporaryVoiceRooms(client) {
    const rooms = await collections().temporaryVoiceRooms.find().toArray();
    for (const room of rooms) {
        const guild = client.guilds.cache.get(room.guildId);
        if (!guild) {
            await collections().temporaryVoiceRooms.deleteOne({ _id: room._id });
            continue;
        }
        const channel = await guild.channels.fetch(room._id).catch(() => null);
        if (channel?.isVoiceBased() && channel.members.size > 0)
            continue;
        if (channel)
            await channel.delete('Cleaning up an empty temporary voice room').catch(() => undefined);
        await collections().temporaryVoiceRooms.deleteOne({ _id: room._id });
    }
}
