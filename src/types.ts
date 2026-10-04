import type { Message } from 'discord.js';
import type { Document } from 'mongodb';

export type HelpCategory = 'owner' | 'system' | 'moderation' | 'general' | 'admin' | 'premium' | 'giveaways' | 'greet' | 'tickets' | 'economy' | 'activity' | 'leveling' | 'security' | 'voice' | 'nadeko';
export type LogCategory = 'moderation' | 'members' | 'messages' | 'security' | 'giveaways' | 'invites' | 'tickets' | 'transcripts';
export type LogChannelSettings = Partial<Record<LogCategory, string | null>>;
export const TICKET_TYPES = ['1', '2', '3', '4', '5'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];
export const isTicketType = (value: string | undefined): value is TicketType =>
  TICKET_TYPES.some(ticketType => ticketType === value);
export interface TicketTypeSettings {
  categoryChannelId?: string | null;
  supportRoleId?: string | null;
  welcomeMessage?: string | null;
  imageUrl?: string | null;
  buttonLabel?: string | null;
  panelMessage?: string | null;
}
export type TicketTypesSettings = Partial<Record<TicketType, TicketTypeSettings>>;
export interface GuildSettings extends Document {
  guildId: string; prefix: string; welcomeChannelId: string | null; welcomeMessage: string;
  welcomeDeleteSeconds: number; ticketCategoryId: string | null; supportRoleId: string | null;
  ticketPanelMessage?: string | null;
  ticketLogChannelId: string | null; ticketTranscriptLogChannelId?: string | null;
  ticketTypes?: TicketTypesSettings; logChannelId: string | null; logChannels?: LogChannelSettings; levelChannelId: string | null;
  tempVoiceTriggerChannelId: string | null; tempVoiceCategoryId: string | null; updatedAt: Date;
}
export interface WarningRecord extends Document {
  id: string; guildId: string; userId: string; moderatorId: string; reason: string; createdAt: Date;
}
export interface TicketRecord extends Document {
  id: string; guildId: string; channelId: string; creatorId: string;
  status: 'open' | 'closed'; createdAt: Date; closedAt: Date | null;
  ticketType?: TicketType; claimedBy?: string;
}
export interface GiveawayRecord extends Document {
  id: string; guildId: string; channelId: string; messageId?: string; prize: string;
  winnerCount: number; endsAt: Date; entries: string[]; status: 'active' | 'ended'; winnerIds?: string[];
}
export interface WalletRecord extends Document {
  _id: string; guildId: string; userId: string; balance: number; dailyClaimedAt?: Date; updatedAt: Date;
}
export interface ActivityRecord extends Document {
  _id: string; guildId: string; userId: string; dayKey: string; textMessages: number; voiceSeconds: number; updatedAt: Date;
}
export interface LevelRecord extends Document {
  _id: string; guildId: string; userId: string; xp: number; lastXpAt: Date | null; updatedAt: Date;
}
export interface OwnerRecord extends Document { _id: string; userId: string; addedBy: string; createdAt: Date }
export interface CommandAliasRecord extends Document {
  _id: string; guildId: string; alias: string; commandName: string; createdBy: string; createdAt: Date;
}
export interface SecuritySettings extends Document {
  _id: string; guildId: string; antiRaidEnabled: boolean; antiRaidThreshold: number;
  antiRaidWindowSeconds: number; antiRaidAction: 'alert' | 'timeout';
  antiNukeEnabled: boolean; antiNukeThreshold: number; antiNukeWindowSeconds: number;
  antiNukeAction: 'alert' | 'strip'; updatedAt: Date;
}
export interface WhitelistEntry extends Document {
  _id: string; guildId: string; targetId: string; targetType: 'user' | 'role'; addedBy: string; createdAt: Date;
}
export interface TemporaryVoiceRoom extends Document {
  _id: string; guildId: string; ownerId: string; createdAt: Date;
}
export interface CommandContext { message: Message<true>; settings: GuildSettings }
export interface BotCommand {
  name: string; aliases?: string[]; category: HelpCategory; description: string; usage?: string;
  execute(context: CommandContext, args: string[]): Promise<void>;
}
