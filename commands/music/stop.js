const v2 = require('../../utils/componentsV2');

const OK_COLOR = 0x1DB954;
const ERROR_COLOR = 0xFF0000;

function panel(interaction, color, body) {
    return v2.reply(interaction, {
        ephemeral: true,
        components: v2.infoPanel({ color, heading: 'Stop Music', body })
    });
}

module.exports = {
    data: {
        name: 'stop',
        description: 'Stops the music and leaves the voice channel.'
    },

    async execute(interaction, client) {
        const queue = client.distube.getQueue(interaction.guild);
        if (!queue || !queue.songs[0]) {
            return panel(interaction, ERROR_COLOR, 'There is no song currently playing to stop!');
        }

        try {
            queue.stop();
            return panel(interaction, OK_COLOR, 'Stopped the music and cleared the queue. ⏹️');
        } catch (error) {
            console.error('Error stopping music:', error);
            return panel(interaction, ERROR_COLOR, 'An error occurred while trying to stop the music.');
        }
    }
};
