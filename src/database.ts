import { MongoClient, MongoServerError, type Db } from 'mongodb';
import { config } from './config.js';
import type { ActivityRecord, CommandAliasRecord, GiveawayRecord, GuildSettings, LevelRecord, OwnerRecord, SecuritySettings, TemporaryVoiceRoom, TicketRecord, WalletRecord, WarningRecord, WhitelistEntry } from './types.js';

const defaults = {
  prefix: config.defaultPrefix, welcomeChannelId: null, welcomeMessage: 'Welcome {user} to **{server}**!',
  welcomeDeleteSeconds: 0, ticketCategoryId: null, supportRoleId: null, ticketPanelMessage: null, ticketLogChannelId: null, ticketTranscriptLogChannelId: null,
  logChannelId: null, levelChannelId: null, tempVoiceTriggerChannelId: null, tempVoiceCategoryId: null,
};
let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectDatabase(): Promise<void> {
  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db(config.mongoDatabase);
  try {
    await db.collection<GuildSettings>('guildSettings').findOne({ guildId: '__echo_system_permission_check__' });
  } catch (error) {
    if (error instanceof MongoServerError && (error.code === 13 || error.code === 8000)) {
      throw new Error(`MongoDB connected, but this user cannot read the ${config.mongoDatabase} database. Grant the user the built-in readWrite role for this database in MongoDB Atlas.`);
    }
    throw error;
  }
  const indexResults = await Promise.allSettled([
    db.collection<GuildSettings>('guildSettings').createIndex({ guildId: 1 }, { unique: true }),
    db.collection<WarningRecord>('warnings').createIndex({ guildId: 1, userId: 1, createdAt: -1 }),
    db.collection<TicketRecord>('tickets').createIndex({ id: 1 }, { unique: true }),
    db.collection<TicketRecord>('tickets').createIndex({ guildId: 1, creatorId: 1, status: 1 }),
    db.collection<GiveawayRecord>('giveaways').createIndex({ id: 1 }, { unique: true }),
    db.collection<GiveawayRecord>('giveaways').createIndex({ messageId: 1 }, { unique: true, sparse: true }),
    db.collection<GiveawayRecord>('giveaways').createIndex({ status: 1, endsAt: 1 }),
    db.collection<WalletRecord>('wallets').createIndex({ guildId: 1, userId: 1 }, { unique: true }),
    db.collection<ActivityRecord>('activity').createIndex({ guildId: 1, dayKey: 1, userId: 1 }, { unique: true }),
    db.collection<ActivityRecord>('activity').createIndex({ guildId: 1, dayKey: 1 }),
    db.collection<LevelRecord>('levels').createIndex({ guildId: 1, userId: 1 }, { unique: true }),
    db.collection<LevelRecord>('levels').createIndex({ guildId: 1, xp: -1 }),
    db.collection<CommandAliasRecord>('commandAliases').createIndex({ guildId: 1, alias: 1 }, { unique: true }),
    db.collection<WhitelistEntry>('securityWhitelist').createIndex({ guildId: 1, targetType: 1, targetId: 1 }, { unique: true }),
    db.collection<TemporaryVoiceRoom>('temporaryVoiceRooms').createIndex({ guildId: 1, ownerId: 1 }),
  ]);
  const indexErrors = indexResults.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
  const permissionErrors = indexErrors.filter(error =>
    error instanceof MongoServerError && (error.code === 13 || error.code === 8000),
  );
  const fatalError = indexErrors.find(error => !permissionErrors.includes(error));
  if (fatalError) throw fatalError;
  if (permissionErrors.length) {
    console.warn('MongoDB connected, but this database user cannot create indexes. The bot will continue without any missing indexes.');
  }
}
function database(): Db {
  if (!db) throw new Error('MongoDB is not connected');
  return db;
}
export const collections = () => ({
  guildSettings: database().collection<GuildSettings>('guildSettings'),
  warnings: database().collection<WarningRecord>('warnings'),
  tickets: database().collection<TicketRecord>('tickets'),
  giveaways: database().collection<GiveawayRecord>('giveaways'),
  wallets: database().collection<WalletRecord>('wallets'),
  activity: database().collection<ActivityRecord>('activity'),
  levels: database().collection<LevelRecord>('levels'),
  owners: database().collection<OwnerRecord>('owners'),
  aliases: database().collection<CommandAliasRecord>('commandAliases'),
  security: database().collection<SecuritySettings>('guildSecurity'),
  whitelist: database().collection<WhitelistEntry>('securityWhitelist'),
  temporaryVoiceRooms: database().collection<TemporaryVoiceRoom>('temporaryVoiceRooms'),
});
export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  const stored = await collections().guildSettings.findOne({ guildId });
  return { guildId, ...defaults, updatedAt: new Date(), ...stored } as GuildSettings;
}
export async function updateGuildSettings(guildId: string, patch: Partial<Omit<GuildSettings, 'guildId'>>): Promise<GuildSettings> {
  await collections().guildSettings.updateOne(
    { guildId }, { $set: { ...patch, updatedAt: new Date() }, $setOnInsert: { guildId } }, { upsert: true },
  );
  return getGuildSettings(guildId);
}
export async function disconnectDatabase(): Promise<void> {
  await client?.close();
  client = undefined;
  db = undefined;
}
