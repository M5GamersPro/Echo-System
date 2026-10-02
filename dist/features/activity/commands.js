import { AttachmentBuilder } from 'discord.js';
import { renderLeaderboardCard } from '../canvas/cards.js';
import { getActivityLeaders } from './service.js';
function rankingCommand(name, aliases, period, metric) {
    const label = metric === 'totalActivity' ? 'Activity' : metric === 'textMessages' ? 'Text' : 'Voice';
    const periodLabel = period === 'day' ? 'Day' : 'Week';
    return {
        name,
        aliases,
        category: 'activity',
        description: `Show the ${period.toLowerCase()} ${label.toLowerCase()} leaderboard.`,
        async execute(context) {
            const rows = await getActivityLeaders(context.message.guildId, period, metric);
            const identities = await Promise.all(rows.map(async (row) => {
                const user = await context.message.client.users.fetch(row._id).catch(() => null);
                return { id: row._id, name: user?.globalName ?? user?.username ?? `User ${row._id}` };
            }));
            const card = await renderLeaderboardCard(`${periodLabel} ${label} Leaderboard`, rows, identities, metric);
            await context.message.channel.send({ files: [new AttachmentBuilder(card, { name: `echo-${period}-${label.toLowerCase()}.png` })] });
        },
    };
}
export const activityCommands = [
    rankingCommand('topday', ['tday', 'top day'], 'day', 'totalActivity'),
    rankingCommand('topweek', ['tweek', 'top week'], 'week', 'totalActivity'),
    rankingCommand('topdaytext', ['tday text', 'top day text'], 'day', 'textMessages'),
    rankingCommand('topdayvoice', ['tday voice', 'top day voice'], 'day', 'voiceSeconds'),
    rankingCommand('topweektext', ['tweek text', 'top week text'], 'week', 'textMessages'),
    rankingCommand('topweekvoice', ['tweek voice', 'top week voice'], 'week', 'voiceSeconds'),
];
