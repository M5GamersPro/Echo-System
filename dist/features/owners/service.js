import { config } from '../../config.js';
import { collections } from '../../database.js';
export async function isBotOwner(userId) {
    if (config.ownerIds.includes(userId))
        return true;
    return Boolean(await collections().owners.findOne({ _id: userId }));
}
export async function addBotOwner(userId, addedBy) {
    await collections().owners.updateOne({ _id: userId }, {
        $setOnInsert: { userId, addedBy, createdAt: new Date() },
    }, { upsert: true });
}
export async function setCommandAlias(guildId, alias, commandName, createdBy) {
    const key = `${guildId}:${alias}`;
    await collections().aliases.updateOne({ _id: key }, {
        $set: { guildId, alias, commandName, createdBy },
        $setOnInsert: { createdAt: new Date() },
    }, { upsert: true });
}
export async function getCommandAlias(guildId, alias) {
    const stored = await collections().aliases.findOne({ _id: `${guildId}:${alias}` });
    return stored?.commandName ?? null;
}
export async function removeCommandAlias(guildId, alias) {
    const result = await collections().aliases.deleteOne({ _id: `${guildId}:${alias}` });
    return result.deletedCount > 0;
}
export async function listCommandAliases(guildId) {
    return collections().aliases.find({ guildId }).sort({ alias: 1 }).project({ _id: 0, alias: 1, commandName: 1 }).toArray();
}
