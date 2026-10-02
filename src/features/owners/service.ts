import { config } from '../../config.js';
import { collections } from '../../database.js';

export async function isBotOwner(userId: string): Promise<boolean> {
  if (config.ownerIds.includes(userId)) return true;
  return Boolean(await collections().owners.findOne({ _id: userId }));
}

export async function addBotOwner(userId: string, addedBy: string): Promise<void> {
  await collections().owners.updateOne({ _id: userId }, {
    $setOnInsert: { userId, addedBy, createdAt: new Date() },
  }, { upsert: true });
}

export async function setCommandAlias(guildId: string, alias: string, commandName: string, createdBy: string): Promise<void> {
  const key = `${guildId}:${alias}`;
  await collections().aliases.updateOne({ _id: key }, {
    $set: { guildId, alias, commandName, createdBy },
    $setOnInsert: { createdAt: new Date() },
  }, { upsert: true });
}

export async function getCommandAlias(guildId: string, alias: string): Promise<string | null> {
  const stored = await collections().aliases.findOne({ _id: `${guildId}:${alias}` });
  return stored?.commandName ?? null;
}

export async function removeCommandAlias(guildId: string, alias: string): Promise<boolean> {
  const result = await collections().aliases.deleteOne({ _id: `${guildId}:${alias}` });
  return result.deletedCount > 0;
}

export async function listCommandAliases(guildId: string): Promise<Array<{ alias: string; commandName: string }>> {
  return collections().aliases.find({ guildId }).sort({ alias: 1 }).project<{ alias: string; commandName: string }>({ _id: 0, alias: 1, commandName: 1 }).toArray();
}
