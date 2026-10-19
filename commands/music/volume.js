const v2 = require('../../utils/componentsV2');
const volumeStore = require('../../utils/volumeStore');

const OK_COLOR = 0x1DB954;
const ERROR_COLOR = 0xFF0000;

module.exports = {
    data: {
        name: 'volume',
        description: 'Get or set the stream volume.',
        options: [
            {
                name: 'value',
                type: 4, // INTEGER
                description: 'The volume value you want to set (0-150).',
                required: false
            }
        ]
    },

    async execute(interaction, client) {
        const guildId = interaction.guild.id;
        const volumeValue = interaction.options.getInteger('value');

        if (volumeValue === null || typeof volumeValue === 'undefined') {
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.infoPanel({
                    color: OK_COLOR,
                    heading: 'Volume',
                    body: `The current volume is **${volumeStore.get(guildId)}%**.`
                })
            });
        }

        if (volumeValue < volumeStore.MIN_VOLUME || volumeValue > volumeStore.MAX_VOLUME) {
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.infoPanel({
                    color: ERROR_COLOR,
                    heading: 'Volume',
                    body: `Please choose a value between ${volumeStore.MIN_VOLUME} and ${volumeStore.MAX_VOLUME}.`
                })
            });
        }

        const queue = client.distube.getQueue(interaction.guild);
        const saved = volumeStore.set(guildId, volumeValue);
        if (queue) {
            try {
                queue.setVolume(saved);
            } catch (error) {
                console.error('Error setting volume:', error);
            }
        }

        return v2.reply(interaction, {
            ephemeral: true,
            components: v2.infoPanel({
                color: OK_COLOR,
                heading: 'Volume',
                body: `Volume set to **${saved}%**${queue ? '' : ' (will apply on next play)'}.`
            })
        });
    }
};
