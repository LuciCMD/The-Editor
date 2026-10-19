const v2 = require('../utils/componentsV2');
const watch = require('../utils/watch');

const OK_COLOR = 0xFF0000;
const ERROR_COLOR = 0xFF0000;

module.exports = {
    data: {
        name: 'unwatch',
        description: 'Stop watching a channel',
        options: [
            { name: 'channel', type: 7, description: 'The channel to stop watching', required: true }
        ]
    },

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        try {
            const removed = await watch.removeWatch(interaction.user.id, channel.id);
            if (!removed) {
                return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Channel Watch', body: `You weren't watching ${channel.toString()}.` }) });
            }
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: OK_COLOR, heading: 'Channel Watch Removed', body: `You've stopped watching ${channel.toString()}.` }) });
        } catch (error) {
            console.error('Error removing watched channel:', error);
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Channel Watch', body: 'An error occurred while removing the watched channel.' }) });
        }
    }
};
