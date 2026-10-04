import { EmbedBuilder } from 'discord.js';
import { getGuildSettings } from '../../database.js';
export const logCategories = ['moderation', 'members', 'messages', 'security', 'giveaways', 'invites', 'tickets', 'transcripts'];
export const logCategoryLabels = {
    moderation: 'Moderation',
    members: 'Members',
    messages: 'Messages',
    security: 'Security',
    giveaways: 'Giveaways',
    invites: 'Invites',
    tickets: 'Tickets',
    transcripts: 'Ticket Transcripts',
};
export async function getLogChannelId(guild, category) {
    const settings = await getGuildSettings(guild.id);
    const configuredChannels = settings.logChannels ?? {};
    if (Object.hasOwn(configuredChannels, category))
        return configuredChannels[category] ?? null;
    if (category === 'tickets' && settings.ticketLogChannelId)
        return settings.ticketLogChannelId;
    if (category === 'transcripts' && settings.ticketTranscriptLogChannelId)
        return settings.ticketTranscriptLogChannelId;
    return settings.logChannelId;
}
export async function logGuildEvent(guild, category, content) {
    try {
        const settings = await getGuildSettings(guild.id);
        const configuredChannels = settings.logChannels ?? {};
        const channelId = await getLogChannelId(guild, category);
        if (!channelId) {
            if (Object.hasOwn(configuredChannels, category) || (category === 'tickets' && settings.ticketLogChannelId === null) || (category === 'transcripts' && settings.ticketTranscriptLogChannelId === null))
                return;
            console.info(`[Echo ${category} log ${guild.id}] ${content}`);
            return;
        }
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased() || !('send' in channel))
            return;
        const guildIcon = guild.iconURL();
        const embed = new EmbedBuilder()
            .setColor(0x7658e8)
            .setAuthor({ name: `${guild.name} • ${logCategoryLabels[category]} Logs`, ...(guildIcon ? { iconURL: guildIcon } : {}) })
            .setDescription(content.slice(0, 4_096))
            .setTimestamp();
        await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    }
    catch (error) {
        console.warn(`Could not write a log message for guild ${guild.id}:`, error);
    }
}
