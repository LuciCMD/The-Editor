// Handles button clicks on the now-playing control panel (customId prefix "music").

const v2 = require('../utils/componentsV2');
const volumeStore = require('../utils/volumeStore');
const musicEvents = require('../passives/musicEvents');

const VOLUME_STEP = 10;
const ERROR_COLOR = 0xFF0000;
const INFO_COLOR = 0x1DB954;
const MAX_QUEUE_LIST = 20;

function errorReply(interaction, body) {
    return v2.reply(interaction, {
        ephemeral: true,
        components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Music', body })
    });
}

async function showQueue(interaction, queue) {
    const list = queue.songs
        .slice(0, MAX_QUEUE_LIST)
        .map((s, i) => `${i === 0 ? '▶️' : `${i}.`} ${s.name} \`${s.formattedDuration}\``)
        .join('\n');
    const remaining = queue.songs.length - MAX_QUEUE_LIST;
    const more = remaining > 0 ? `\n…and ${remaining} more` : '';
    return v2.reply(interaction, {
        ephemeral: true,
        components: v2.infoPanel({ color: INFO_COLOR, heading: 'Music Queue', body: list + more })
    });
}

module.exports = {
    id: 'music',
    async execute(interaction, client) {
        const action = (interaction.customId || '').split(':')[1];
        const queue = client.distube.getQueue(interaction.guildId);

        if (!queue || queue.songs.length === 0) {
            return errorReply(interaction, 'Nothing is playing right now.');
        }

        // Require the user to share the bot's voice channel before controlling it.
        const userChannel = interaction.member && interaction.member.voice
            ? interaction.member.voice.channel
            : null;
        if (!userChannel || !queue.voiceChannel || userChannel.id !== queue.voiceChannel.id) {
            return errorReply(interaction, 'You must be in the same voice channel to control playback.');
        }

        if (action === 'queue') {
            return showQueue(interaction, queue);
        }

        // Actions that end playback: ack silently and let DisTube events remove
        // the panel. Actions that keep playing: refresh the panel in place.
        try {
            switch (action) {
                case 'playpause':
                    if (queue.paused) {
                        queue.resume();
                    } else {
                        queue.pause();
                    }
                    return v2.update(interaction, { components: musicEvents.buildNowPlayingPanel(queue) });

                case 'voldown':
                case 'volup': {
                    const delta = action === 'volup' ? VOLUME_STEP : -VOLUME_STEP;
                    const next = volumeStore.set(queue.id, queue.volume + delta);
                    queue.setVolume(next);
                    return v2.update(interaction, { components: musicEvents.buildNowPlayingPanel(queue) });
                }

                case 'skip':
                    await interaction.deferUpdate();
                    if (queue.songs.length > 1) {
                        await queue.skip(); // playSong event refreshes the panel
                    } else {
                        queue.stop(); // finish/disconnect event removes the panel
                    }
                    return;

                case 'stop':
                    await interaction.deferUpdate();
                    queue.stop();
                    return;

                default:
                    return errorReply(interaction, 'Unknown action.');
            }
        } catch (error) {
            console.error(`Music control "${action}" failed:`, error.message);
            if (!interaction.replied && !interaction.deferred) {
                return errorReply(interaction, 'That control failed. Please try again.');
            }
        }
    }
};
