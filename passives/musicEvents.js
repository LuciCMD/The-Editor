// DisTube event wiring + the interactive "now playing" control panel.
//
// This is NOT an auto-loaded client passive (it has no `name`); app.js calls
// register(client) explicitly after DisTube is constructed. It listens to DisTube
// events and maintains one control-panel message per guild.

const { ButtonStyle } = require('discord.js');
const v2 = require('../utils/componentsV2');
const volumeStore = require('../utils/volumeStore');

// guildId -> the panel Message currently shown for that guild.
const panels = new Map();

const PLAYING_COLOR = 0x1DB954;
const PAUSED_COLOR = 0xE67E22;
const ERROR_COLOR = 0xFF0000;
const MAX_QUEUE_PREVIEW = 5;

function buildNowPlayingPanel(queue) {
    if (!queue || !queue.songs || queue.songs.length === 0) {
        throw new Error('buildNowPlayingPanel requires a queue with songs');
    }
    const song = queue.songs[0];
    const paused = queue.paused;

    const lines = [
        `## ${paused ? '⏸️ Paused' : '🎵 Now Playing'}`,
        `**[${song.name || 'Unknown'}](${song.url || 'https://discord.com'})**`,
        `\`${song.formattedDuration}\`${song.uploader && song.uploader.name ? ` • ${song.uploader.name}` : ''}`,
        `🔊 Volume: **${queue.volume}%**`
    ];

    if (queue.songs.length > 1) {
        const preview = queue.songs
            .slice(1, 1 + MAX_QUEUE_PREVIEW)
            .map((s, i) => `${i + 1}. ${s.name}`)
            .join('\n');
        const remaining = queue.songs.length - 1 - MAX_QUEUE_PREVIEW;
        const more = remaining > 0 ? `\n…and ${remaining} more` : '';
        lines.push('', '**Up Next**', preview + more);
    }

    const heading = lines.join('\n');
    const components = [];
    if (song.thumbnail) {
        components.push(v2.section({ texts: [heading], thumbnail: song.thumbnail }));
    } else {
        components.push(v2.textDisplay(heading));
    }
    components.push(v2.separator());
    components.push(v2.buttonRow(
        v2.button({ id: 'music:playpause', emoji: paused ? '▶️' : '⏸️', label: paused ? 'Resume' : 'Pause', style: ButtonStyle.Primary }),
        v2.button({ id: 'music:skip', emoji: '⏭️', label: 'Skip' }),
        v2.button({ id: 'music:stop', emoji: '⏹️', label: 'Stop', style: ButtonStyle.Danger })
    ));
    components.push(v2.buttonRow(
        v2.button({ id: 'music:voldown', emoji: '🔉', label: 'Vol -' }),
        v2.button({ id: 'music:volup', emoji: '🔊', label: 'Vol +' }),
        v2.button({ id: 'music:queue', emoji: '📜', label: 'Queue' })
    ));

    return v2.container({ color: paused ? PAUSED_COLOR : PLAYING_COLOR, components });
}

// Post a fresh panel or edit the existing one in place.
async function refreshPanel(queue) {
    if (!queue || !queue.textChannel) {
        return;
    }
    const payload = v2.buildPayload({ components: buildNowPlayingPanel(queue) });
    const existing = panels.get(queue.id);
    if (existing) {
        try {
            await existing.edit(payload);
            return;
        } catch (error) {
            // Panel message was deleted; fall through and post a new one.
            panels.delete(queue.id);
        }
    }
    try {
        const message = await queue.textChannel.send(payload);
        panels.set(queue.id, message);
    } catch (error) {
        console.error('Failed to post music panel:', error.message);
    }
}

async function removePanel(guildId) {
    const message = panels.get(guildId);
    panels.delete(guildId);
    if (message) {
        await message.delete().catch(() => {});
    }
}

function applySavedVolume(queue) {
    const saved = volumeStore.get(queue.id);
    if (typeof saved === 'number' && queue.volume !== saved) {
        try {
            queue.setVolume(saved);
        } catch (error) {
            console.error('Failed to apply saved volume:', error.message);
        }
    }
}

function register(client) {
    if (!client || !client.distube) {
        throw new Error('register requires a client with DisTube initialized');
    }
    const dt = client.distube;

    dt.on('playSong', (queue) => {
        applySavedVolume(queue);
        refreshPanel(queue).catch(err => console.error('panel(playSong):', err.message));
    });
    dt.on('addSong', (queue) => {
        refreshPanel(queue).catch(err => console.error('panel(addSong):', err.message));
    });
    dt.on('addList', (queue) => {
        refreshPanel(queue).catch(err => console.error('panel(addList):', err.message));
    });
    dt.on('finish', (queue) => {
        removePanel(queue.id).catch(() => {});
    });
    dt.on('disconnect', (queue) => {
        removePanel(queue.id).catch(() => {});
    });
    dt.on('empty', (queue) => {
        removePanel(queue.id).catch(() => {});
    });
    dt.on('deleteQueue', (queue) => {
        removePanel(queue.id).catch(() => {});
    });
    dt.on('error', (error, queue) => {
        console.error('DisTube error:', error && error.message ? error.message : error);
        if (queue && queue.textChannel) {
            v2.send(queue.textChannel, {
                components: v2.infoPanel({
                    color: ERROR_COLOR,
                    heading: 'Music Error',
                    body: 'Something went wrong while playing that track. It may be unavailable or region-locked.'
                })
            }).catch(() => {});
        }
    });

    console.log('Music event handlers registered.');
}

module.exports = { register, refreshPanel, removePanel, buildNowPlayingPanel };
