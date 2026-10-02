import 'dotenv/config';
function required(name) {
    const value = process.env[name]?.trim();
    if (!value)
        throw new Error(`Missing required environment variable: ${name}`);
    return value;
}
export const config = {
    token: required('DISCORD_TOKEN'),
    mongoUri: process.env.MONGODB_URI?.trim() || 'mongodb://127.0.0.1:27017',
    mongoDatabase: process.env.MONGODB_DATABASE?.trim() || 'echo_system',
    ownerIds: (process.env.BOT_OWNER_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean),
    defaultPrefix: process.env.DEFAULT_PREFIX?.trim() || '$',
};
