import type { Guild } from 'discord.js';

export type EchoEmoji = 'core' | 'owner' | 'system' | 'moderation' | 'general' | 'admin' | 'premium' | 'giveaways' | 'greet' | 'tickets' | 'warning' | 'locked' | 'kick' | 'ban' | 'clean' | 'calculator' | 'ping' | 'coin';

const fallback: Record<EchoEmoji, string> = {
  core: '[ECHO]', owner: '[OWNER]', system: '[SYSTEM]', moderation: '[MOD]', general: '[INFO]',
  admin: '[ADMIN]', premium: '[PREMIUM]', giveaways: '[GIVEAWAY]', greet: '[GREET]',
  tickets: '[TICKET]', warning: '[WARN]', locked: '[TIMEOUT]', kick: '[KICK]', ban: '[BAN]',
  clean: '[CLEAN]', calculator: '[CALC]', ping: '[PING]', coin: '[ECHOSR]',
};

export function echoEmoji(guild: Guild | null | undefined, name: EchoEmoji): string {
  return guild?.emojis.cache.find(emoji => emoji.name === `echo_${name}`)?.toString() ?? fallback[name];
}

export function echoEmojiOption(guild: Guild | null | undefined, name: EchoEmoji) {
  const emoji = guild?.emojis.cache.find(item => item.name === `echo_${name}`);
  return emoji ? { id: emoji.id, name: emoji.name ?? undefined, animated: emoji.animated ?? undefined } : undefined;
}
