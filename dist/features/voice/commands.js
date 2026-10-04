import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { updateGuildSettings } from '../../database.js';
const tempVoice = {
    name: 'tempvoice', aliases: ['tempvc'], category: 'voice',
    description: 'Configure a join-to-create temporary voice room trigger.',
    usage: 'tempvoice setup #voice-channel [category]|status|off',
    async execute(context, args) {
        if (!context.message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return void await context.message.reply({ content: 'You need Manage Server to configure temporary voice rooms.', allowedMentions: { repliedUser: false } });
        }
        const action = args[0]?.toLowerCase();
        if (action === 'status' || !action) {
            const trigger = context.settings.tempVoiceTriggerChannelId
                ? `<#${context.settings.tempVoiceTriggerChannelId}>`
                : 'Disabled';
            const category = context.settings.tempVoiceCategoryId
                ? `<#${context.settings.tempVoiceCategoryId}>`
                : 'Same category as trigger';
            return void await context.message.reply({ content: `Temporary voice trigger: ${trigger}\nRoom category: ${category}`, allowedMentions: { repliedUser: false } });
        }
        if (action === 'off') {
            await updateGuildSettings(context.message.guildId, { tempVoiceTriggerChannelId: null, tempVoiceCategoryId: null });
            return void await context.message.reply({ content: 'Temporary voice rooms are disabled. Existing rooms will still be cleaned up when empty.', allowedMentions: { repliedUser: false } });
        }
        const offset = action === 'setup' || action === 'set' ? 1 : 0;
        const channelMentions = [...context.message.mentions.channels.values()];
        const triggerMention = channelMentions.find(channel => channel.type === ChannelType.GuildVoice);
        const triggerId = triggerMention?.id ?? args[offset]?.replace(/[<#>]/g, '');
        const trigger = triggerId ? await context.message.guild.channels.fetch(triggerId).catch(() => null) : null;
        if (!trigger || trigger.type !== ChannelType.GuildVoice) {
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}tempvoice setup #voice-channel [category]`, allowedMentions: { repliedUser: false } });
        }
        const categoryMention = channelMentions.find(channel => channel.type === ChannelType.GuildCategory);
        const categoryIdArg = args[offset + 1]?.replace(/[<#>]/g, '');
        const category = categoryMention ?? (categoryIdArg ? await context.message.guild.channels.fetch(categoryIdArg).catch(() => null) : null);
        if (category && category.type !== ChannelType.GuildCategory) {
            return void await context.message.reply({ content: 'The optional parent must be a server category.', allowedMentions: { repliedUser: false } });
        }
        await updateGuildSettings(context.message.guildId, {
            tempVoiceTriggerChannelId: trigger.id,
            tempVoiceCategoryId: category?.id ?? null,
        });
        await context.message.reply({
            content: `Temporary voice rooms are enabled. Members joining ${trigger} will get their own room${category ? ` under **${category.name}**` : ''}. I need **Manage Channels** and **Move Members** permissions.`,
            allowedMentions: { repliedUser: false },
        });
    },
};
export const voiceCommands = [tempVoice];
