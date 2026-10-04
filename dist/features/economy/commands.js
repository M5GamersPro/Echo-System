import { PermissionFlagsBits } from 'discord.js';
import { collections } from '../../database.js';
import { echoEmoji } from '../../emojis.js';
const PROBOT_CREDITS_PER_ECHOSR = 40_000;
const DAILY_REWARD = 1;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1_000;
const number = new Intl.NumberFormat('en-US');
function walletId(guildId, userId) {
    return `${guildId}:${userId}`;
}
async function getOrCreateWallet(guildId, userId) {
    const id = walletId(guildId, userId);
    const wallets = collections().wallets;
    await wallets.updateOne({ _id: id }, {
        $setOnInsert: { guildId, userId, balance: 0, updatedAt: new Date() },
    }, { upsert: true });
    const wallet = await wallets.findOne({ _id: id });
    if (!wallet)
        throw new Error('Wallet could not be loaded after creation.');
    return wallet;
}
function echoAmount(amount) {
    return `${number.format(amount)} EchoSR`;
}
const balance = {
    name: 'balance', aliases: ['bal', 'wallet', 'money'], category: 'economy',
    description: 'Show your EchoSR balance or another member’s balance.', usage: 'balance [@member]',
    async execute(context) {
        const target = context.message.mentions.users.first() ?? context.message.author;
        const wallet = await getOrCreateWallet(context.message.guildId, target.id);
        const creditValue = wallet.balance * PROBOT_CREDITS_PER_ECHOSR;
        await context.message.reply({
            content: `${echoEmoji(context.message.guild, 'coin')} **${target.username}** has **${echoAmount(wallet.balance)}**\nReference value: ${number.format(creditValue)} ProBot credits`,
            allowedMentions: { repliedUser: false },
        });
    },
};
const daily = {
    name: 'daily', category: 'economy', description: 'Claim 1 EchoSR once every 24 hours.',
    async execute(context) {
        const guildId = context.message.guildId;
        const userId = context.message.author.id;
        const wallet = await getOrCreateWallet(guildId, userId);
        const now = new Date();
        const result = await collections().wallets.updateOne({
            _id: wallet._id,
            $or: [{ dailyClaimedAt: { $exists: false } }, { dailyClaimedAt: { $lte: new Date(now.getTime() - DAILY_COOLDOWN_MS) } }],
        }, { $inc: { balance: DAILY_REWARD }, $set: { dailyClaimedAt: now, updatedAt: now } });
        if (!result.modifiedCount) {
            const refreshed = await collections().wallets.findOne({ _id: wallet._id });
            const nextAt = new Date((refreshed?.dailyClaimedAt?.getTime() ?? now.getTime()) + DAILY_COOLDOWN_MS);
            return void await context.message.reply({ content: `Your next daily EchoSR is ready <t:${Math.ceil(nextAt.getTime() / 1_000)}:R>.`, allowedMentions: { repliedUser: false } });
        }
        const updated = await collections().wallets.findOne({ _id: wallet._id });
        await context.message.reply({
            content: `${echoEmoji(context.message.guild, 'coin')} You claimed **${echoAmount(DAILY_REWARD)}**. Balance: **${echoAmount(updated?.balance ?? DAILY_REWARD)}**.`,
            allowedMentions: { repliedUser: false },
        });
    },
};
const pay = {
    name: 'pay', aliases: ['give'], category: 'economy', description: 'Send EchoSR to another member.', usage: 'pay @member <amount>',
    async execute(context, args) {
        const recipient = context.message.mentions.users.first();
        const amount = Number(args.find(arg => /^\d+$/.test(arg)));
        if (!recipient || recipient.bot || recipient.id === context.message.author.id || !Number.isSafeInteger(amount) || amount < 1) {
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}pay @member <positive whole amount>`, allowedMentions: { repliedUser: false } });
        }
        const sender = await getOrCreateWallet(context.message.guildId, context.message.author.id);
        const target = await getOrCreateWallet(context.message.guildId, recipient.id);
        const withdrawn = await collections().wallets.updateOne({ _id: sender._id, balance: { $gte: amount } }, { $inc: { balance: -amount }, $set: { updatedAt: new Date() } });
        if (!withdrawn.modifiedCount)
            return void await context.message.reply({ content: 'You do not have enough EchoSR for that transfer.', allowedMentions: { repliedUser: false } });
        try {
            await collections().wallets.updateOne({ _id: target._id }, { $inc: { balance: amount }, $set: { updatedAt: new Date() } });
        }
        catch (error) {
            await collections().wallets.updateOne({ _id: sender._id }, { $inc: { balance: amount }, $set: { updatedAt: new Date() } }).catch(() => undefined);
            throw error;
        }
        await context.message.reply({
            content: `${echoEmoji(context.message.guild, 'coin')} Sent **${echoAmount(amount)}** to ${recipient}.`,
            allowedMentions: { users: [recipient.id], repliedUser: false },
        });
    },
};
const convert = {
    name: 'convert', aliases: ['rate'], category: 'economy', description: 'Show the reference value of EchoSR in ProBot credits.', usage: 'convert [EchoSR amount]',
    async execute(context, args) {
        const amount = args[0] === undefined ? 1 : Number(args[0]);
        if (!Number.isSafeInteger(amount) || amount < 1)
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}convert [positive whole EchoSR amount]`, allowedMentions: { repliedUser: false } });
        const credits = amount * PROBOT_CREDITS_PER_ECHOSR;
        await context.message.reply({
            content: `**${echoAmount(amount)}** = **${number.format(credits)} ProBot credits** at the configured reference rate. This is not a ProBot credit transfer.`,
            allowedMentions: { repliedUser: false },
        });
    },
};
const economyAdmin = {
    name: 'add echosr', category: 'economy', description: 'Add EchoSR to a member wallet (Manage Server required).', usage: 'add echosr @member <amount>',
    async execute(context, args) {
        if (!context.message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return void await context.message.reply({ content: 'You need Manage Server to use this command.', allowedMentions: { repliedUser: false } });
        }
        const recipient = context.message.mentions.users.first();
        const amount = Number(args.find(arg => /^\d+$/.test(arg)));
        if (!recipient || !Number.isSafeInteger(amount) || amount < 1)
            return void await context.message.reply({ content: `Usage: ${context.settings.prefix}add echosr @member <positive whole amount>`, allowedMentions: { repliedUser: false } });
        const wallet = await getOrCreateWallet(context.message.guildId, recipient.id);
        await collections().wallets.updateOne({ _id: wallet._id }, { $inc: { balance: amount }, $set: { updatedAt: new Date() } });
        const updated = await collections().wallets.findOne({ _id: wallet._id });
        await context.message.reply({ content: `Added **${echoAmount(amount)}** to ${recipient}. New balance: **${echoAmount(updated?.balance ?? amount)}**.`, allowedMentions: { users: [recipient.id], repliedUser: false } });
    },
};
export const economyCommands = [balance, daily, pay, convert, economyAdmin];
