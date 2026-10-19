const { getVoiceConnection } = require('@discordjs/voice');
const v2 = require('../../utils/componentsV2');

const OK_COLOR = 0x1DB954;
const ERROR_COLOR = 0xFF0000;

module.exports = {
    data: {
        name: 'leave',
        description: 'Makes the bot leave the current voice channel.'
    },

    async execute(interaction, client) {
        // Stop any active DisTube queue so playback state is cleared too.
        const queue = client.distube.getQueue(interaction.guild);
        if (queue) {
            try {
                queue.stop();
            } catch (error) {
                console.error('Error stopping queue on leave:', error);
            }
        }

        const connection = getVoiceConnection(interaction.guildId);
        if (!connection && !queue) {
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Leave Voice', body: "I'm not currently in a voice channel." })
            });
        }

        try {
            if (connection) {
                connection.destroy();
            }
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.infoPanel({ color: OK_COLOR, heading: 'Leave Voice', body: 'Left the voice channel.' })
            });
        } catch (error) {
            console.error('Error leaving voice channel:', error);
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Leave Voice', body: 'There was an error trying to leave the voice channel.' })
            });
        }
    }
};
