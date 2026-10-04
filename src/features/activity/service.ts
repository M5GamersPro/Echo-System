import type { VoiceState } from 'discord.js';
import type { Document } from 'mongodb';
import { collections } from '../../database.js';
import { egyptDayKey, egyptPeriodWindow, nextEgyptMidnight } from './time.js';

export type ActivityMetric = 'totalActivity' | 'textMessages' | 'voiceSeconds';
export interface ActivityLeader extends Document {
  _id: string;
  textMessages: number;
  voiceSeconds: number;
  voiceMinutes: number;
  totalActivity: number;
}
interface VoiceSession { guildId: string; userId: string; flushedAt: number }
const activeVoiceSessions = new Map<string, VoiceSession>();

async function incrementActivity(guildId: string, userId: string, key: string, field: 'textMessages' | 'voiceSeconds', amount: number): Promise<void> {
  if (amount <= 0) return;
  const id = `${guildId}:${userId}:${key}`;
  await collections().activity.updateOne({ _id: id }, {
    $setOnInsert: { guildId, userId, dayKey: key },
    $set: { updatedAt: new Date() },
    $inc: { [field]: amount },
  }, { upsert: true });
}

export async function recordTextMessage(guildId: string, userId: string, time = Date.now()): Promise<void> {
  await incrementActivity(guildId, userId, egyptDayKey(time), 'textMessages', 1);
}

async function recordVoiceInterval(guildId: string, userId: string, start: number, end: number): Promise<void> {
  let cursor = start;
  while (cursor < end) {
    const intervalEnd = Math.min(end, nextEgyptMidnight(cursor));
    const seconds = Math.floor((intervalEnd - cursor) / 1_000);
    if (seconds > 0) await incrementActivity(guildId, userId, egyptDayKey(cursor), 'voiceSeconds', seconds);
    cursor = intervalEnd;
  }
}

export async function handleVoiceStateChange(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot || oldState.channelId === newState.channelId) return;
  const sessionId = `${member.guild.id}:${member.id}`;
  const now = Date.now();
  const active = activeVoiceSessions.get(sessionId);
  if (active) {
    await recordVoiceInterval(active.guildId, active.userId, active.flushedAt, now);
    activeVoiceSessions.delete(sessionId);
  }
  if (newState.channelId) activeVoiceSessions.set(sessionId, { guildId: member.guild.id, userId: member.id, flushedAt: now });
}

export function trackCurrentVoiceState(state: VoiceState): void {
  const member = state.member;
  if (!member || member.user.bot || !state.channelId) return;
  const sessionId = `${member.guild.id}:${member.id}`;
  if (!activeVoiceSessions.has(sessionId)) {
    activeVoiceSessions.set(sessionId, { guildId: member.guild.id, userId: member.id, flushedAt: Date.now() });
  }
}

export async function flushVoiceSessions(now = Date.now()): Promise<void> {
  await Promise.all([...activeVoiceSessions.values()].map(async session => {
    await recordVoiceInterval(session.guildId, session.userId, session.flushedAt, now);
    session.flushedAt = now;
  }));
}

export async function getActivityLeaders(
  guildId: string,
  period: 'day' | 'week',
  metric: ActivityMetric,
  now = new Date(),
): Promise<ActivityLeader[]> {
  const { start, end } = egyptPeriodWindow(period, now.getTime());
  return collections().activity.aggregate<ActivityLeader>([
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

export function activityDayKey(time: number): string { return egyptDayKey(time); }
