import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { commands, commandColors } from './commands.js';
import { echoEmoji, echoEmojiOption } from './emojis.js';
const categories = {
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
    nadeko: { label: 'Nadeko', title: 'Nadeko Commands', emoji: 'system', description: 'Browse the implemented command directory, including moderation, utilities, economy, tickets, and server tools.' },
};
export function helpEmbed(prefix, category, guild) {
    const embed = new EmbedBuilder().setColor(commandColors.brand);
    if (!category) {
        embed.setTitle(`${echoEmoji(guild, 'core')} Echo System • Help`)
            .setDescription(`Hello! I’m **Echo System**, a server bot for moderation, welcome messages, giveaways, and support tickets.\n\nCurrent prefix: \`${prefix}\`\nSelect a category below to explore my commands.`)
            .setThumbnail('https://mayor-cloud.com/i/7wsl/6ac0d2225ad1742d9c1bde1b.gif')
            .setFooter({ text: 'Requested by you' });
        return embed;
    }
    const selected = categories[category];
    const list = commands.filter(command => category === 'nadeko' || command.category === category);
    embed.setTitle(`${echoEmoji(guild, selected.emoji)} ${selected.title}`).setDescription(selected.description);
    if (list.length) {
        embed.addFields({ name: 'Commands', value: list.map(command => `• \`${prefix}${command.name}${command.usage ? ` ${command.usage.slice(command.name.length).trim()}` : ''}\`\n  ${command.description}`).join('\n\n').slice(0, 1_024) });
    }
    else if (category === 'premium') {
        embed.addFields({ name: 'Status', value: 'Premium commands are coming soon.' });
    }
    else {
        embed.addFields({ name: 'Commands', value: 'No commands are available in this category yet.' });
    }
    embed.setFooter({ text: 'Requested by you' });
    return embed;
}
export function helpMenu(requesterId, guild) {
    const menu = new StringSelectMenuBuilder().setCustomId(`echo:help:${requesterId}`)
        .setPlaceholder('اختر فئة لعرض الأوامر').addOptions(Object.entries(categories).map(([value, item]) => {
        const emoji = echoEmojiOption(guild, item.emoji);
        return { label: item.label, value, ...(emoji ? { emoji } : {}), description: item.description.slice(0, 100) };
    }));
    return new ActionRowBuilder().addComponents(menu);
}
