import { collections } from '../../database.js';
import { egyptDayKey, egyptPeriodWindow, nextEgyptMidnight } from './time.js';
const activeVoiceSessions = new Map();
async function incrementActivity(guildId, userId, key, field, amount) {
    if (amount <= 0)
        return;
    const id = `${guildId}:${userId}:${key}`;
    await collections().activity.updateOne({ _id: id }, {
        $setOnInsert: { guildId, userId, dayKey: key },
        $set: { updatedAt: new Date() },
        $inc: { [field]: amount },
    }, { upsert: true });
}
export async function recordTextMessage(guildId, userId, time = Date.now()) {
    await incrementActivity(guildId, userId, egyptDayKey(time), 'textMessages', 1);
}
async function recordVoiceInterval(guildId, userId, start, end) {
    let cursor = start;
    while (cursor < end) {
        const intervalEnd = Math.min(end, nextEgyptMidnight(cursor));
        const seconds = Math.floor((intervalEnd - cursor) / 1_000);
        if (seconds > 0)
            await incrementActivity(guildId, userId, egyptDayKey(cursor), 'voiceSeconds', seconds);
        cursor = intervalEnd;
    }
}
export async function handleVoiceStateChange(oldState, newState) {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot || oldState.channelId === newState.channelId)
        return;
    const sessionId = `${member.guild.id}:${member.id}`;
    const now = Date.now();
    const active = activeVoiceSessions.get(sessionId);
    if (active) {
        await recordVoiceInterval(active.guildId, active.userId, active.flushedAt, now);
        activeVoiceSessions.delete(sessionId);
    }
    if (newState.channelId)
        activeVoiceSessions.set(sessionId, { guildId: member.guild.id, userId: member.id, flushedAt: now });
}
export function trackCurrentVoiceState(state) {
    const member = state.member;
    if (!member || member.user.bot || !state.channelId)
        return;
    const sessionId = `${member.guild.id}:${member.id}`;
    if (!activeVoiceSessions.has(sessionId)) {
        activeVoiceSessions.set(sessionId, { guildId: member.guild.id, userId: member.id, flushedAt: Date.now() });
    }
}
export async function flushVoiceSessions(now = Date.now()) {
    await Promise.all([...activeVoiceSessions.values()].map(async (session) => {
        await recordVoiceInterval(session.guildId, session.userId, session.flushedAt, now);
        session.flushedAt = now;
    }));
}
export async function getActivityLeaders(guildId, period, metric, now = new Date()) {
    const { start, end } = egyptPeriodWindow(period, now.getTime());
    return collections().activity.aggregate([
        { $match: { guildId, dayKey: { $gte: start, $lte: end } } },
        { $group: { _id: '$userId', textMessages: { $sum: '$textMessages' }, voiceSeconds: { $sum: '$voiceSeconds' } } },
        { $addFields: {
                voiceMinutes: { $floor: { $divide: ['$voiceSeconds', 60] } },
                totalActivity: { $add: ['$textMessages', { $floor: { $divide: ['$voiceSeconds', 60] } }] },
            } },
        { $sort: { [metric]: -1, _id: 1 } },
        { $limit: 10 },
    ]).toArray();
}
export function activityDayKey(time) { return egyptDayKey(time); }
