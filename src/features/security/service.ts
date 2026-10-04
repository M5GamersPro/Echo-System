import { AuditLogEvent, PermissionFlagsBits, type Guild, type GuildAuditLogsEntry, type GuildMember } from 'discord.js';
import { collections } from '../../database.js';
import type { SecuritySettings } from '../../types.js';
import { isBotOwner } from '../owners/service.js';
import { logGuildEvent } from '../logging/service.js';

const defaults = {
  antiRaidEnabled: false,
  antiRaidThreshold: 8,
  antiRaidWindowSeconds: 10,
  antiRaidAction: 'alert' as const,
  antiNukeEnabled: false,
  antiNukeThreshold: 3,
  antiNukeWindowSeconds: 20,
  antiNukeAction: 'alert' as const,
};
const recentJoins = new Map<string, number[]>();
const lastRaidAlert = new Map<string, number>();
const recentNukeActions = new Map<string, number[]>();
const lastNukeResponse = new Map<string, number>();
const monitoredActions = new Set<AuditLogEvent>([
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.RoleDelete,
  AuditLogEvent.WebhookCreate,
  AuditLogEvent.WebhookUpdate,
  AuditLogEvent.WebhookDelete,
  AuditLogEvent.MemberBanAdd,
  AuditLogEvent.MemberKick,
  AuditLogEvent.RoleCreate,
]);

export async function getSecuritySettings(guildId: string): Promise<SecuritySettings> {
  const id = guildId;
  await collections().security.updateOne({ _id: id }, {
    $setOnInsert: { _id: id, guildId, ...defaults, updatedAt: new Date() },
  }, { upsert: true });
  const settings = await collections().security.findOne({ _id: id });
  if (!settings) throw new Error('Server security settings could not be loaded.');
  return settings;
}

export async function updateSecuritySettings(
  guildId: string,
  patch: Partial<Omit<SecuritySettings, '_id' | 'guildId'>>,
): Promise<SecuritySettings> {
  await collections().security.updateOne({ _id: guildId }, {
    $set: { ...patch, updatedAt: new Date() },
    $setOnInsert: { _id: guildId, guildId, ...defaults },
  }, { upsert: true });
  return getSecuritySettings(guildId);
}

export async function addWhitelistEntry(guildId: string, targetType: 'user' | 'role', targetId: string, addedBy: string): Promise<void> {
  const id = `${guildId}:${targetType}:${targetId}`;
  await collections().whitelist.updateOne({ _id: id }, {
    $setOnInsert: { _id: id, guildId, targetType, targetId, addedBy, createdAt: new Date() },
  }, { upsert: true });
}

export async function removeWhitelistEntry(guildId: string, targetType: 'user' | 'role', targetId: string): Promise<boolean> {
  const result = await collections().whitelist.deleteOne({ _id: `${guildId}:${targetType}:${targetId}` });
  return result.deletedCount > 0;
}

export async function listWhitelistEntries(guildId: string) {
  return collections().whitelist.find({ guildId }).sort({ targetType: 1, targetId: 1 }).toArray();
}

export async function isWhitelisted(guildId: string, userId: string, roleIds: string[] = []): Promise<boolean> {
  const conditions: Array<Record<string, unknown>> = [{ targetType: 'user', targetId: userId }];
  if (roleIds.length) conditions.push({ targetType: 'role', targetId: { $in: roleIds } });
  return Boolean(await collections().whitelist.findOne({ guildId, $or: conditions }));
}

export async function handleRaidJoin(member: GuildMember): Promise<void> {
  if (member.user.bot || await isBotOwner(member.id)) return;
  const settings = await getSecuritySettings(member.guild.id);
  if (!settings.antiRaidEnabled || await isWhitelisted(member.guild.id, member.id, [...member.roles.cache.keys()])) return;

  const now = Date.now();
  const joins = (recentJoins.get(member.guild.id) ?? []).filter(time => now - time <= settings.antiRaidWindowSeconds * 1_000);
  joins.push(now);
  recentJoins.set(member.guild.id, joins);
  if (joins.length < settings.antiRaidThreshold) return;

  if (settings.antiRaidAction === 'timeout' && member.moderatable) {
    await member.timeout(10 * 60 * 1_000, 'Echo anti-raid: join burst detected').catch(error => {
      console.warn(`Could not timeout raid joiner ${member.id}:`, error);
    });
  }
  const lastAlert = lastRaidAlert.get(member.guild.id) ?? 0;
  if (now - lastAlert >= 30_000) {
    lastRaidAlert.set(member.guild.id, now);
    await logGuildEvent(member.guild, 'security', `Anti-raid detected **${joins.length} joins** in ${settings.antiRaidWindowSeconds}s. Response: **${settings.antiRaidAction}**. Latest member: <@${member.id}>.`);
  }
}

export async function handleNukeAudit(guild: Guild, entry: GuildAuditLogsEntry): Promise<void> {
  if (!monitoredActions.has(entry.action)) return;
  const executorId = entry.executorId;
  const actionLabel = AuditLogEvent[entry.action] ?? 'Server change';
  if (!executorId) {
    await logGuildEvent(guild, 'security', `Security audit: **${actionLabel}** occurred; the responsible user could not be identified.`);
    return;
  }
  await logGuildEvent(guild, 'security', `Security audit: **${actionLabel}** by <@${executorId}>.`);
  if (executorId === guild.client.user.id || await isBotOwner(executorId)) return;

  const member = await guild.members.fetch(executorId).catch(() => null);
  const roles = member ? [...member.roles.cache.keys()] : [];
  if (await isWhitelisted(guild.id, executorId, roles)) return;
  const settings = await getSecuritySettings(guild.id);
  if (!settings.antiNukeEnabled) return;

  const now = Date.now();
  const key = `${guild.id}:${executorId}`;
  const actions = (recentNukeActions.get(key) ?? []).filter(time => now - time <= settings.antiNukeWindowSeconds * 1_000);
  actions.push(now);
  recentNukeActions.set(key, actions);
  if (actions.length < settings.antiNukeThreshold) return;

  const lastResponse = lastNukeResponse.get(key) ?? 0;
  if (now - lastResponse < 60_000) return;
  lastNukeResponse.set(key, now);
  let removedRoleCount = 0;
  if (settings.antiNukeAction === 'strip' && member) removedRoleCount = await stripDangerousRoles(member);
  await logGuildEvent(guild, 'security', `Anti-nuke threshold reached for <@${executorId}>: ${actions.length} monitored changes in ${settings.antiNukeWindowSeconds}s. Response: **${settings.antiNukeAction}**${removedRoleCount ? `; removed ${removedRoleCount} privileged role(s)` : ''}.`);
}

async function stripDangerousRoles(member: GuildMember): Promise<number> {
  const dangerousPermissions = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
  ];
  const roles = member.roles.cache.filter(role => role.editable && role.permissions.any(dangerousPermissions));
  if (!roles.size) return 0;
  await member.roles.remove(roles, 'Echo anti-nuke: privileged roles removed after a destructive-action burst');
  return roles.size;
}
