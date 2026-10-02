const fallback = {
    core: '[ECHO]', owner: '[OWNER]', system: '[SYSTEM]', moderation: '[MOD]', general: '[INFO]',
    admin: '[ADMIN]', premium: '[PREMIUM]', giveaways: '[GIVEAWAY]', greet: '[GREET]',
    tickets: '[TICKET]', warning: '[WARN]', locked: '[TIMEOUT]', kick: '[KICK]', ban: '[BAN]',
    clean: '[CLEAN]', calculator: '[CALC]', ping: '[PING]', coin: '[ECHOSR]',
};
export function echoEmoji(guild, name) {
    return guild?.emojis.cache.find(emoji => emoji.name === `echo_${name}`)?.toString() ?? fallback[name];
}
export function echoEmojiOption(guild, name) {
    const emoji = guild?.emojis.cache.find(item => item.name === `echo_${name}`);
    return emoji ? { id: emoji.id, name: emoji.name ?? undefined, animated: emoji.animated ?? undefined } : undefined;
}
