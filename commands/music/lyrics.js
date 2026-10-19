const Genius = require('genius-lyrics');
const config = require('../../utils/config');
const v2 = require('../../utils/componentsV2');

const INFO_COLOR = 0x9B59B6;
const ERROR_COLOR = 0xFF0000;
const MAX_LYRICS_LENGTH = 3800; // keep within the V2 message text budget
const MAX_ATTEMPTS = 2;

let geniusClient = new Genius.Client(config.geniusToken);

const cleanSongName = (songName) =>
    songName
        .replace(/\[(Official Video|Lyric Video|Official Audio|Official Music Video|MV)\]/gi, '')
        .trim();

async function refreshGeniusToken() {
    try {
        const newToken = await geniusClient.getAccessToken();
        config.geniusToken = newToken;
        geniusClient = new Genius.Client(newToken);
        console.log('Genius access token refreshed successfully.');
        return true;
    } catch (error) {
        console.error('Error refreshing Genius access token:', error);
        return false;
    }
}

function reply(interaction, color, heading, body) {
    return v2.reply(interaction, {
        ephemeral: true,
        components: v2.infoPanel({ color, heading, body })
    });
}

module.exports = {
    data: {
        name: 'lyrics',
        description: 'Displays the lyrics of the currently playing song.'
    },

    async execute(interaction, client) {
        const queue = client.distube.getQueue(interaction.guild);
        if (!queue || !queue.songs[0]) {
            return reply(interaction, ERROR_COLOR, 'Lyrics', 'There is no song playing right now.');
        }

        const songName = queue.songs[0].name;
        const cleanedSongName = cleanSongName(songName);

        // Retry once on an expired token instead of recursing (Power of Ten rule 1).
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                const searches = await geniusClient.songs.search(cleanedSongName);
                if (searches.length === 0) {
                    return reply(interaction, ERROR_COLOR, 'Lyrics', `Sorry, I couldn't find the lyrics for "${songName}".`);
                }

                const song = searches[0];
                const lyrics = await song.lyrics(false);
                if (!lyrics) {
                    return reply(interaction, ERROR_COLOR, 'Lyrics', `Sorry, I couldn't fetch the lyrics for "${songName}".`);
                }

                if (lyrics.length > MAX_LYRICS_LENGTH) {
                    return reply(interaction, INFO_COLOR, `Lyrics for "${songName}"`,
                        `These lyrics are too long to display here. Read them at: ${song.url}`);
                }

                return reply(interaction, INFO_COLOR, `Lyrics for "${songName}"`, lyrics);
            } catch (error) {
                const expired = error.response && error.response.status === 401;
                if (expired && attempt < MAX_ATTEMPTS) {
                    console.log('Genius access token expired. Refreshing token...');
                    await refreshGeniusToken();
                    continue;
                }
                console.error(`Error fetching lyrics for "${songName}":`, error);
                return reply(interaction, ERROR_COLOR, 'Lyrics', `There was an error trying to fetch the lyrics for "${songName}".`);
            }
        }
    }
};
