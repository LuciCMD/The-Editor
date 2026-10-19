const v2 = require('../../utils/componentsV2');

const OK_COLOR = 0x1DB954;
const ERROR_COLOR = 0xFF0000;

function panel(interaction, color, body) {
    return v2.reply(interaction, {
        ephemeral: true,
        components: v2.infoPanel({ color, heading: 'Skip Music', body })
    });
}

module.exports = {
    data: {
        name: 'skip',
        description: 'Skips the currently playing song.'
    },

    async execute(interaction, client) {
        const queue = client.distube.getQueue(interaction.guild);
        if (!queue || !queue.songs[0]) {
            return panel(interaction, ERROR_COLOR, 'There is no song currently playing to skip!');
        }

        try {
            if (queue.songs.length > 1) {
                await queue.skip();
                return panel(interaction, OK_COLOR, 'Skipped to the next song. ⏭️');
            }
            queue.stop();
            return panel(interaction, OK_COLOR, 'No song up next — stopped playback.');
        } catch (error) {
            console.error('Error skipping song:', error);
            return panel(interaction, ERROR_COLOR, 'An error occurred while trying to skip.');
        }
    }
};
