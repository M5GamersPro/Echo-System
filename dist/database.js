import { MongoClient, MongoServerError } from 'mongodb';
import { config } from './config.js';
const defaults = {
    prefix: config.defaultPrefix, welcomeChannelId: null, welcomeMessage: 'Welcome {user} to **{server}**!',
    welcomeDeleteSeconds: 0, ticketCategoryId: null, supportRoleId: null, ticketLogChannelId: null,
    logChannelId: null, levelChannelId: null, tempVoiceTriggerChannelId: null, tempVoiceCategoryId: null,
};
let client;
let db;
export async function connectDatabase() {
    client = new MongoClient(config.mongoUri);
    await client.connect();
    db = client.db(config.mongoDatabase);
    try {
        await db.collection('guildSettings').findOne({ guildId: '__echo_system_permission_check__' });
    }
    catch (error) {
        if (error instanceof MongoServerError && (error.code === 13 || error.code === 8000)) {
            throw new Error(`MongoDB connected, but this user cannot read the ${config.mongoDatabase} database. Grant the user the built-in readWrite role for this database in MongoDB Atlas.`);
        }
        throw error;
    }
    const indexResults = await Promise.allSettled([
        db.collection('guildSettings').createIndex({ guildId: 1 }, { unique: true }),
        db.collection('warnings').createIndex({ guildId: 1, userId: 1, createdAt: -1 }),
        db.collection('tickets').createIndex({ id: 1 }, { unique: true }),
        db.collection('tickets').createIndex({ guildId: 1, creatorId: 1, status: 1 }),
        db.collection('giveaways').createIndex({ id: 1 }, { unique: true }),
        db.collection('giveaways').createIndex({ messageId: 1 }, { unique: true, sparse: true }),
        db.collection('giveaways').createIndex({ status: 1, endsAt: 1 }),
        db.collection('wallets').createIndex({ guildId: 1, userId: 1 }, { unique: true }),
        db.collection('activity').createIndex({ guildId: 1, dayKey: 1, userId: 1 }, { unique: true }),
        db.collection('activity').createIndex({ guildId: 1, dayKey: 1 }),
        db.collection('levels').createIndex({ guildId: 1, userId: 1 }, { unique: true }),
        db.collection('levels').createIndex({ guildId: 1, xp: -1 }),
        db.collection('commandAliases').createIndex({ guildId: 1, alias: 1 }, { unique: true }),
        db.collection('securityWhitelist').createIndex({ guildId: 1, targetType: 1, targetId: 1 }, { unique: true }),
        db.collection('temporaryVoiceRooms').createIndex({ guildId: 1, ownerId: 1 }),
    ]);
    const indexErrors = indexResults.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
    const permissionErrors = indexErrors.filter(error => error instanceof MongoServerError && (error.code === 13 || error.code === 8000));
    const fatalError = indexErrors.find(error => !permissionErrors.includes(error));
    if (fatalError)
        throw fatalError;
    if (permissionErrors.length) {
        console.warn('MongoDB connected, but this database user cannot create indexes. The bot will continue without any missing indexes.');
    }
}
function database() {
    if (!db)
        throw new Error('MongoDB is not connected');
    return db;
}
export const collections = () => ({
    guildSettings: database().collection('guildSettings'),
    warnings: database().collection('warnings'),
    tickets: database().collection('tickets'),
    giveaways: database().collection('giveaways'),
    wallets: database().collection('wallets'),
    activity: database().collection('activity'),
    levels: database().collection('levels'),
    owners: database().collection('owners'),
    aliases: database().collection('commandAliases'),
    security: database().collection('guildSecurity'),
    whitelist: database().collection('securityWhitelist'),
    temporaryVoiceRooms: database().collection('temporaryVoiceRooms'),
});
export async function getGuildSettings(guildId) {
    const stored = await collections().guildSettings.findOne({ guildId });
    return { guildId, ...defaults, updatedAt: new Date(), ...stored };
}
export async function updateGuildSettings(guildId, patch) {
    await collections().guildSettings.updateOne({ guildId }, { $set: { ...patch, updatedAt: new Date() }, $setOnInsert: { guildId } }, { upsert: true });
    return getGuildSettings(guildId);
}
export async function disconnectDatabase() {
    await client?.close();
    client = undefined;
    db = undefined;
}
