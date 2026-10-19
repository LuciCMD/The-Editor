// Handles channel-watch component interactions (customId prefix "watch"):
//   watch:add                 -> channel select menu picked a channel
//   watch:remove:<channelId>  -> unwatch button
//   watch:togglebots:<id>     -> toggle ignore-bots button

const v2 = require('../utils/componentsV2');
const watch = require('../utils/watch');

const OK_COLOR = 0x00FF00;
const ERROR_COLOR = 0xFF0000;

function reply(interaction, color, heading, body, extraComponents) {
    const base = v2.infoPanel({ color, heading, body });
    if (extraComponents && extraComponents.length) {
        for (const c of extraComponents) {
            base.addActionRowComponents(c);
        }
    }
    return v2.reply(interaction, { ephemeral: true, components: base });
}

async function handleAdd(interaction) {
    const channelId = interaction.values && interaction.values[0];
    const channel = channelId ? interaction.guild.channels.cache.get(channelId) : null;
    if (!channel) {
        return reply(interaction, ERROR_COLOR, 'Channel Watch', 'Could not resolve that channel.');
    }
    const refusal = watch.watchRefusal(interaction.member, channel);
    if (refusal) {
        return reply(interaction, ERROR_COLOR, 'Channel Watch', refusal);
    }
    try {
        await watch.addWatch(interaction.user.id, channel, interaction.guild.name, false);
        const toggle = v2.buttonRow(v2.button({
            id: `watch:togglebots:${channel.id}`,
            label: 'Toggle bot messages',
            emoji: '🤖'
        }));
        return reply(interaction, OK_COLOR, 'Channel Watch',
            `You're now watching ${channel.toString()}.\n🤖 Bot messages: **included**`, [toggle]);
    } catch (error) {
        console.error('Error adding watch from select:', error);
        return reply(interaction, ERROR_COLOR, 'Channel Watch', 'An error occurred while adding the watched channel.');
    }
}

async function handleRemove(interaction, channelId) {
    try {
        const removed = await watch.removeWatch(interaction.user.id, channelId);
        const body = removed ? `Stopped watching <#${channelId}>.` : "You weren't watching that channel.";
        return reply(interaction, removed ? OK_COLOR : ERROR_COLOR, 'Channel Watch', body);
    } catch (error) {
        console.error('Error removing watch:', error);
        return reply(interaction, ERROR_COLOR, 'Channel Watch', 'An error occurred while removing the watched channel.');
    }
}

async function handleToggleBots(interaction, channelId) {
    try {
        const result = await watch.toggleIgnoreBots(interaction.user.id, channelId);
        if (result === null) {
            return reply(interaction, ERROR_COLOR, 'Channel Watch', "You're not watching that channel.");
        }
        return reply(interaction, OK_COLOR, 'Channel Watch',
            `🤖 Bot messages for <#${channelId}> are now **${result ? 'ignored' : 'included'}**.`);
    } catch (error) {
        console.error('Error toggling ignore_bots:', error);
        return reply(interaction, ERROR_COLOR, 'Channel Watch', 'An error occurred while updating the setting.');
    }
}

module.exports = {
    id: 'watch',
    async execute(interaction) {
        const parts = (interaction.customId || '').split(':');
        const action = parts[1];

        if (action === 'add') {
            return handleAdd(interaction);
        }
        if (action === 'remove') {
            return handleRemove(interaction, parts[2]);
        }
        if (action === 'togglebots') {
            return handleToggleBots(interaction, parts[2]);
        }
    }
};
