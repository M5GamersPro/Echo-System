import { collections } from '../../database.js';
import type { LevelRecord } from '../../types.js';

const XP_COOLDOWN_MS = 60_000;
export const xpForNextLevel = (level: number) => (level + 1) ** 2 * 100;
export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(xp / 100));

export async function getOrCreateLevel(guildId: string, userId: string): Promise<LevelRecord> {
  const id = `${guildId}:${userId}`;
  await collections().levels.updateOne({ _id: id }, {
    $setOnInsert: { guildId, userId, xp: 0, lastXpAt: null, updatedAt: new Date() },
  }, { upsert: true });
  const level = await collections().levels.findOne({ _id: id });
  if (!level) throw new Error('Level record could not be loaded.');
  return level;
}

export async function awardMessageXp(guildId: string, userId: string): Promise<{ level: number; xp: number; leveledUp: boolean } | null> {
  const current = await getOrCreateLevel(guildId, userId);
  const now = new Date();
  if (current.lastXpAt && now.getTime() - current.lastXpAt.getTime() < XP_COOLDOWN_MS) return null;
  const amount = 15 + Math.floor(Math.random() * 11);
  const updated = await collections().levels.updateOne(
    { _id: current._id, lastXpAt: current.lastXpAt },
    { $inc: { xp: amount }, $set: { lastXpAt: now, updatedAt: now } },
  );
  if (!updated.modifiedCount) return null;
  const result = await collections().levels.findOne({ _id: current._id });
  if (!result) return null;
  const oldLevel = levelFromXp(current.xp);
  const level = levelFromXp(result.xp);
  return { level, xp: result.xp, leveledUp: level > oldLevel };
}

export async function getUserRank(guildId: string, xp: number): Promise<number> {
  return (await collections().levels.countDocuments({ guildId, xp: { $gt: xp } })) + 1;
}

export async function getLevelLeaders(guildId: string, limit = 10): Promise<LevelRecord[]> {
  return collections().levels.find({ guildId }).sort({ xp: -1, userId: 1 }).limit(limit).toArray();
}
