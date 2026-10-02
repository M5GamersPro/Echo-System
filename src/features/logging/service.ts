import type { Guild } from 'discord.js';
import { getGuildSettings } from '../../database.js';

export async function logGuildEvent(guild: Guild, content: string): Promise<void> {
  try {
    const channelId = (await getGuildSettings(guild.id)).logChannelId;
    if (!channelId) {
      console.info(`[Echo log ${guild.id}] ${content}`);
      return;
    }
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || !('send' in channel)) return;
    await channel.send({ content: content.slice(0, 2_000), allowedMentions: { parse: [] } });
  } catch (error) {
    console.warn(`Could not write a log message for guild ${guild.id}:`, error);
  }
}
