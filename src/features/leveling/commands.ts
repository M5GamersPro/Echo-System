import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import type { BotCommand } from '../../types.js';
import { echoEmoji } from '../../emojis.js';
import { PermissionFlagsBits } from 'discord.js';
import { updateGuildSettings } from '../../database.js';
import { renderRankCard } from '../canvas/cards.js';
import { getLevelLeaders, getOrCreateLevel, getUserRank, levelFromXp } from './service.js';

const rank: BotCommand = {
  name: 'rank', aliases: ['level', 'xp'], category: 'leveling',
  description: 'Show a member’s XP, level, and server rank.', usage: 'rank [@member]',
  async execute(context) {
    const user = context.message.mentions.users.first() ?? context.message.author;
    const stats = await getOrCreateLevel(context.message.guildId, user.id);
    const level = levelFromXp(stats.xp);
    const position = await getUserRank(context.message.guildId, stats.xp);
    const image = await renderRankCard(user, stats.xp, level, position);
    await context.message.channel.send({ files: [new AttachmentBuilder(image, { name: `echo-rank-${user.id}.png` })] });
  },
};

const topXp: BotCommand = {
  name: 'topxp', aliases: ['levels'], category: 'leveling', description: 'Show the server XP leaderboard.',
  async execute(context) {
    const leaders = await getLevelLeaders(context.message.guildId);
    const entries = await Promise.all(leaders.map(async (entry, index) => {
      const user = await context.message.client.users.fetch(entry.userId).catch(() => null);
      return `**${index + 1}.** ${user?.globalName ?? user?.username ?? `User ${entry.userId}`} — Level ${levelFromXp(entry.xp)} · ${entry.xp.toLocaleString()} XP`;
    }));
    const embed = new EmbedBuilder().setColor(0x2c92aa)
      .setTitle(`${echoEmoji(context.message.guild, 'system')} XP Leaderboard`)
      .setDescription(entries.length ? entries.join('\n') : 'No XP has been earned yet.');
    await context.message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  },
};

const setLevelChannel: BotCommand = {
  name: 'setlevelchannel', category: 'leveling',
  description: 'Choose where level-up notifications are sent, or disable them.',
  usage: 'setlevelchannel #channel|off',
  async execute(context, args) {
    if (!context.message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return void await context.message.reply({ content: 'You need Manage Server to configure leveling notifications.', allowedMentions: { repliedUser: false } });
    }
    const value = args[0]?.toLowerCase();
    if (!value) {
      const current = context.settings.levelChannelId ? `<#${context.settings.levelChannelId}>` : 'Current message channel';
      return void await context.message.reply({ content: `Level-up notification channel: ${current}`, allowedMentions: { repliedUser: false } });
    }
    if (value === 'off') {
      await updateGuildSettings(context.message.guildId, { levelChannelId: null });
      return void await context.message.reply({ content: 'Level-up notifications will be sent where the member earns the level.', allowedMentions: { repliedUser: false } });
    }
    const channelId = context.message.mentions.channels.first()?.id ?? value.replace(/[<#>]/g, '');
    const channel = await context.message.guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || !('send' in channel)) {
      return void await context.message.reply({ content: `Usage: ${context.settings.prefix}setlevelchannel #text-channel|off`, allowedMentions: { repliedUser: false } });
    }
    await updateGuildSettings(context.message.guildId, { levelChannelId: channel.id });
    await context.message.reply({ content: `Level-up notifications will be sent in ${channel}.`, allowedMentions: { repliedUser: false } });
  },
};

export const levelingCommands: BotCommand[] = [rank, topXp, setLevelChannel];
