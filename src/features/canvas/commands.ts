import { AttachmentBuilder } from 'discord.js';
import type { BotCommand } from '../../types.js';
import { renderIdCard, renderServerIdCard } from './cards.js';

const userIdCard: BotCommand = {
  name: 'id', aliases: ['whois'], category: 'general',
  description: 'Create an Echo Canvas ID card for a member.', usage: 'id [@member]',
  async execute(context) {
    const user = context.message.mentions.users.first() ?? context.message.author;
    const member = context.message.guild.members.cache.get(user.id);
    const card = await renderIdCard({
      displayName: member?.displayName ?? user.globalName ?? user.username,
      username: user.username,
      id: user.id,
      avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
      createdAt: user.createdAt,
      joinedAt: member?.joinedAt,
      guildName: context.message.guild.name,
    });
    await context.message.channel.send({ files: [new AttachmentBuilder(card, { name: `echo-id-${user.id}.png` })] });
  },
};

const serverIdCard: BotCommand = {
  name: 'serverid', aliases: ['guildid', 'server id'], category: 'general',
  description: 'Create an Echo Canvas ID card for this server.',
  async execute(context) {
    const card = await renderServerIdCard(context.message.guild);
    await context.message.channel.send({ files: [new AttachmentBuilder(card, { name: `echo-server-${context.message.guildId}.png` })] });
  },
};

export const canvasCommands: BotCommand[] = [userIdCard, serverIdCard];
