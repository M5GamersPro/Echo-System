import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { collections, connectDatabase, disconnectDatabase, getGuildSettings } from './database.js';
import { commandMap, finishGiveaway } from './commands.js';
import { helpEmbed, helpMenu } from './help.js';
import { handleInteraction } from './interactions.js';
import { deletedMessages } from './state.js';
import { flushVoiceSessions, handleVoiceStateChange, recordTextMessage, trackCurrentVoiceState } from './features/activity/service.js';
import { awardMessageXp } from './features/leveling/service.js';
import { echoEmoji } from './emojis.js';
import { getCommandAlias } from './features/owners/service.js';
import { handleNukeAudit, handleRaidJoin } from './features/security/service.js';
import { logGuildEvent } from './features/logging/service.js';
import { cleanupTemporaryVoiceRooms, handleTemporaryVoiceState } from './features/voice/service.js';
const client = new Client({ intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.MessageContent,
    ] });
let giveawayTimer;
let voiceActivityTimer;
client.once(Events.ClientReady, readyClient => {
    console.log(`Echo System is online as ${readyClient.user.tag}`);
    void cleanupTemporaryVoiceRooms(readyClient).catch(error => console.error('Temporary voice cleanup failed:', error));
    for (const guild of readyClient.guilds.cache.values()) {
        for (const voiceState of guild.voiceStates.cache.values())
            trackCurrentVoiceState(voiceState);
    }
});
client.on(Events.MessageCreate, async (message) => {
    if (!message.inGuild() || message.author.bot)
        return;
    try {
        const settings = await getGuildSettings(message.guildId);
        await recordTextMessage(message.guildId, message.author.id);
        const levelUpdate = await awardMessageXp(message.guildId, message.author.id);
        if (levelUpdate?.leveledUp) {
            const destination = settings.levelChannelId
                ? await message.guild.channels.fetch(settings.levelChannelId).catch(() => null)
                : message.channel;
            if (destination?.isTextBased() && 'send' in destination) {
                await destination.send({
                    content: `${echoEmoji(message.guild, 'general')} ${message.author} reached **level ${levelUpdate.level}**!`,
                    allowedMentions: { users: [message.author.id] },
                }).catch(error => console.error('Level-up notification failed:', error));
            }
        }
        if (!message.content.startsWith(settings.prefix))
            return;
        const input = message.content.slice(settings.prefix.length).trim();
        if (!input)
            return;
        const [name, ...args] = input.split(/\s+/);
        if (name.toLowerCase() === 'help') {
            await message.reply({
                embeds: [helpEmbed(settings.prefix, undefined, message.guild)],
                components: [helpMenu(message.author.id, message.guild)],
                allowedMentions: { repliedUser: false },
            });
            return;
        }
        const candidates = [
            { key: `${name} ${args[0]} ${args[1]}`.toLowerCase(), args: args.slice(2) },
            { key: `${name} ${args[0]}`.toLowerCase(), args: args.slice(1) },
            { key: name.toLowerCase(), args },
        ];
        for (const candidate of candidates) {
            const directCommand = commandMap.get(candidate.key);
            if (directCommand) {
                await directCommand.execute({ message, settings }, candidate.args);
                return;
            }
            const targetName = await getCommandAlias(message.guildId, candidate.key);
            const aliasedCommand = targetName ? commandMap.get(targetName) : undefined;
            if (aliasedCommand) {
                await aliasedCommand.execute({ message, settings }, candidate.args);
                return;
            }
        }
    }
    catch (error) {
        console.error('Message command failed:', error);
        await message.reply({ content: 'That command failed. Check my permissions or try again.', allowedMentions: { repliedUser: false } }).catch(() => undefined);
    }
});
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
        await handleVoiceStateChange(oldState, newState);
    }
    catch (error) {
        console.error('Voice activity tracking failed:', error);
    }
    try {
        await handleTemporaryVoiceState(oldState, newState);
    }
    catch (error) {
        console.error('Temporary voice handler failed:', error);
    }
});
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        await handleInteraction(interaction);
    }
    catch (error) {
        console.error('Interaction failed:', error);
        if (interaction.isRepliable()) {
            const response = { content: 'Something went wrong. Please try again.', ephemeral: true };
            if (interaction.deferred || interaction.replied)
                await interaction.followUp(response).catch(() => undefined);
            else
                await interaction.reply(response).catch(() => undefined);
        }
    }
});
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        const settings = await getGuildSettings(member.guild.id);
        if (!settings.welcomeChannelId)
            return;
        const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
        if (!channel?.isTextBased() || !('send' in channel))
            return;
        const content = settings.welcomeMessage
            .replaceAll('{user}', `<@${member.id}>`)
            .replaceAll('{server}', member.guild.name)
            .replaceAll('{memberCount}', String(member.guild.memberCount));
        const sent = await channel.send({ content, allowedMentions: { users: [member.id] } });
        if (settings.welcomeDeleteSeconds > 0) {
            setTimeout(() => sent.delete().catch(() => undefined), settings.welcomeDeleteSeconds * 1_000).unref();
        }
    }
    catch (error) {
        console.error('Welcome message failed:', error);
    }
});
client.on(Events.GuildMemberAdd, member => {
    void handleRaidJoin(member).catch(error => console.error('Anti-raid join handler failed:', error));
    void logGuildEvent(member.guild, 'members', `Member joined: <@${member.id}> (${member.user.tag}).`);
});
client.on(Events.GuildMemberRemove, member => {
    void logGuildEvent(member.guild, 'members', `Member left: <@${member.id}> (${member.user.tag}).`);
});
client.on(Events.InviteCreate, invite => {
    const guild = invite.guild ? client.guilds.cache.get(invite.guild.id) : null;
    if (!guild)
        return;
    const channel = invite.channelId ? `<#${invite.channelId}>` : 'Unknown channel';
    const creator = invite.inviter ? `<@${invite.inviter.id}> (${invite.inviter.tag})` : 'Unknown user';
    const maxUses = invite.maxUses === 0 ? 'Unlimited' : String(invite.maxUses);
    const maxAge = invite.maxAge === null || invite.maxAge === 0 ? 'Never expires' : `${Math.floor(invite.maxAge / 3_600)} hour(s)`;
    void logGuildEvent(guild, 'invites', `Invite created: [discord.gg/${invite.code}](https://discord.gg/${invite.code}) by ${creator} in ${channel}. Max uses: **${maxUses}**; expires: **${maxAge}**${invite.temporary ? '; temporary membership' : ''}.`);
});
client.on(Events.GuildAuditLogEntryCreate, (entry, guild) => {
    void handleNukeAudit(guild, entry).catch(error => console.error('Anti-nuke audit handler failed:', error));
});
client.on(Events.MessageDelete, message => {
    if (!message.author || message.author.bot || !message.guildId || !message.content)
        return;
    deletedMessages.set(message.channelId, {
        authorTag: message.author.tag,
        authorId: message.author.id,
        content: message.content.slice(0, 3_500),
        deletedAt: new Date(),
    });
    if (message.guild) {
        const excerpt = message.content.replace(/\s+/g, ' ').slice(0, 300);
        void logGuildEvent(message.guild, 'messages', `Message deleted in <#${message.channelId}> by <@${message.author.id}>: ${excerpt || '[no text]'}`);
    }
    if (deletedMessages.size > 500)
        deletedMessages.delete(deletedMessages.keys().next().value);
});
async function settleGiveaways() {
    const due = await collections().giveaways.find({ status: 'active', endsAt: { $lte: new Date() } }).toArray();
    for (const giveaway of due) {
        try {
            await finishGiveaway(client, giveaway);
        }
        catch (error) {
            console.error(`Could not finish giveaway ${giveaway.id}:`, error);
        }
    }
}
async function start() {
    await connectDatabase();
    giveawayTimer = setInterval(() => { void settleGiveaways().catch(error => console.error('Giveaway check failed:', error)); }, 15_000);
    voiceActivityTimer = setInterval(() => { void flushVoiceSessions().catch(error => console.error('Voice activity flush failed:', error)); }, 60_000);
    await client.login(config.token);
}
async function shutdown() {
    if (giveawayTimer)
        clearInterval(giveawayTimer);
    if (voiceActivityTimer)
        clearInterval(voiceActivityTimer);
    await flushVoiceSessions().catch(error => console.error('Final voice activity flush failed:', error));
    client.destroy();
    await disconnectDatabase();
    process.exit(0);
}
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
void start().catch(async (error) => {
    console.error('Echo System could not start:', error);
    await disconnectDatabase();
    process.exitCode = 1;
});
