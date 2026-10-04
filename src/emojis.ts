import type { Guild } from 'discord.js';

export type EchoEmoji = 'core' | 'owner' | 'system' | 'moderation' | 'general' | 'admin' | 'premium' | 'giveaways' | 'greet' | 'tickets' | 'warning' | 'locked' | 'kick' | 'ban' | 'clean' | 'calculator' | 'ping' | 'coin';

const fallback: Record<EchoEmoji, string> = {
  core: ':echo_core:', owner: ':echo_owner:', system: ':echo_system:', moderation: ':echo_moderation:', general: ':echo_general:',
  admin: ':echo_admin:', premium: ':echo_premium:', giveaways: ':echo_giveaways:', greet: ':echo_greet:',
  tickets: ':echo_tickets:', warning: ':echo_warning:', locked: ':echo_locked:', kick: ':echo_kick:', ban: ':echo_ban:',
  clean: ':echo_clean:', calculator: ':echo_calculator:', ping: ':echo_ping:', coin: ':echo_coin:',
};

export function echoEmoji(guild: Guild | null | undefined, name: EchoEmoji): string {
  return guild?.emojis.cache.find(emoji => emoji.name === `echo_${name}`)?.toString() ?? fallback[name];
}

export function echoEmojiOption(guild: Guild | null | undefined, name: EchoEmoji) {
  const emoji = guild?.emojis.cache.find(item => item.name === `echo_${name}`);
  return emoji ? { id: emoji.id, name: emoji.name ?? undefined, animated: emoji.animated ?? undefined } : undefined;
}
