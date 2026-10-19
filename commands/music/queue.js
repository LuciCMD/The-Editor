const v2 = require('../../utils/componentsV2');

const INFO_COLOR = 0x1DB954;
const MAX_QUEUE_LIST = 20;

module.exports = {
    data: {
        name: 'queue',
        description: 'Displays the list of songs in the queue.'
    },

    async execute(interaction, client) {
        const queue = client.distube.getQueue(interaction.guild);

        if (!queue || !queue.songs[0]) {
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.infoPanel({
                    color: INFO_COLOR,
                    heading: 'Music Queue',
                    body: 'There are no songs in the queue right now!'
                })
            });
        }

        const list = queue.songs
            .slice(0, MAX_QUEUE_LIST)
            .map((song, i) => `${i === 0 ? '▶️' : `${i}.`} ${song.name} \`${song.formattedDuration}\``)
            .join('\n');
        const remaining = queue.songs.length - MAX_QUEUE_LIST;
        const more = remaining > 0 ? `\n…and ${remaining} more` : '';

        return v2.reply(interaction, {
            ephemeral: true,
            components: v2.infoPanel({ color: INFO_COLOR, heading: 'Music Queue', body: list + more })
        });
    }
};
