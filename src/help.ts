import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { commands, commandColors } from './commands.js';
import type { HelpCategory } from './types.js';
import type { Guild } from 'discord.js';
import { echoEmoji, echoEmojiOption, type EchoEmoji } from './emojis.js';

const categories: Record<HelpCategory, { label: string; title: string; emoji: EchoEmoji; description: string }> = {
  owner: { label: 'Owner Commands', title: 'Owner Commands', emoji: 'owner', description: 'Commands reserved for configured bot owners.' },
  system: { label: 'System Commands', title: 'System Commands', emoji: 'system', description: 'Bot status and diagnostics.' },
  moderation: { label: 'Moderation', title: 'Moderation', emoji: 'moderation', description: 'Member moderation and warning tools.' },
  general: { label: 'General Commands', title: 'General Commands', emoji: 'general', description: 'Useful server and member commands.' },
  admin: { label: 'Admin Commands', title: 'Admin Commands', emoji: 'admin', description: 'Server administration and channel controls.' },
  premium: { label: 'Premium', title: 'Premium', emoji: 'premium', description: 'Premium features are not configured yet.' },
  giveaways: { label: 'Giveaways', title: 'Giveaways', emoji: 'giveaways', description: 'Create and manage server giveaways.' },
  greet: { label: 'Greet System', title: 'Greet System', emoji: 'greet', description: 'Configure join welcome messages.' },
  tickets: { label: 'Ticket System', title: 'Ticket System', emoji: 'tickets', description: 'Private support-ticket controls.' },
  economy: { label: 'EchoSR Economy', title: 'EchoSR Economy', emoji: 'coin', description: 'Earn and transfer EchoSR in this server.' },
  activity: { label: 'Activity Rankings', title: 'Activity Rankings', emoji: 'system', description: 'Daily Cairo-time and Monday-reset text and voice leaderboards.' },
  leveling: { label: 'Leveling', title: 'Leveling', emoji: 'general', description: 'Earn XP, view ranks, and configure level-up notifications.' },
  security: { label: 'Security', title: 'Security', emoji: 'moderation', description: 'Configure whitelists, anti-raid, and anti-nuke defenses.' },
  voice: { label: 'Temporary Voice', title: 'Temporary Voice', emoji: 'tickets', description: 'Create private voice rooms when members join the trigger channel.' },
};

export function helpEmbed(prefix: string, category?: HelpCategory, guild?: Guild | null): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(commandColors.brand);
  if (!category) {
    embed.setTitle(`${echoEmoji(guild, 'core')} Echo System • Help`)
      .setDescription(`Hello! I’m **Echo System**, a server bot created by <@1088354509677404201> for moderation, welcome messages, giveaways, and support tickets.\n\nCurrent prefix: \`${prefix}\`\nSelect a category below to explore my commands.`)
      .setThumbnail('https://cdn.discordapp.com/attachments/1543202071598342194/1555479394653573180/standard.gif?backend=b2&ex=6ac0ac93&is=6abf5b13&hm=1499188674af6fa1bc9db18b4a586662c2c29cc9052ca6d57374c2e09bb2e212&')
      .setFooter({ text: 'Requested by you' });
    return embed;
  }
  const selected = categories[category];
  const list = commands.filter(command => command.category === category);
  embed.setTitle(`${echoEmoji(guild, selected.emoji)} ${selected.title}`).setDescription(selected.description);
  if (list.length) {
    embed.addFields({ name: 'Commands', value: list.map(command => `• \`${prefix}${command.name}${command.usage ? ` ${command.usage.slice(command.name.length).trim()}` : ''}\`\n  ${command.description}`).join('\n\n').slice(0, 1_024) });
  } else if (category === 'premium') {
    embed.addFields({ name: 'Status', value: 'Premium commands are coming soon.' });
  } else {
    embed.addFields({ name: 'Commands', value: 'No commands are available in this category yet.' });
  }
  embed.setFooter({ text: 'Requested by you' });
  return embed;
}

export function helpMenu(requesterId: string, guild?: Guild | null): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder().setCustomId(`echo:help:${requesterId}`)
    .setPlaceholder('اختر فئة لعرض الأوامر').addOptions(
      (Object.entries(categories) as [HelpCategory, typeof categories[HelpCategory]][]).map(([value, item]) => {
        const emoji = echoEmojiOption(guild, item.emoji);
        return { label: item.label, value, ...(emoji ? { emoji } : {}), description: item.description.slice(0, 100) };
      }),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}
