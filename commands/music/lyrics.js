const { EmbedBuilder } = require('@discordjs/builders');
const Genius = require('genius-lyrics');
const config = require('../../config.json');
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
    } catch (error) {
        console.error('Error refreshing Genius access token:', error);
    }
}

module.exports = {
    data: {
        name: 'lyrics',
        description: 'Displays the lyrics of the currently playing song.',
    },

    async execute(interaction, client) {
        const queue = client.distube.getQueue(interaction.guild);
        if (!queue || !queue.songs[0]) {
            return interaction.reply('There is no song playing right now.');
        }

        const songName = queue.songs[0].name;
        const cleanedSongName = cleanSongName(songName);

        try {
            const songs = await geniusClient.songs.search(cleanedSongName);
            const song = songs[0];

            if (!song) {
                return interaction.reply(`Sorry, I couldn't find the song "${songName}".`);
            }

            const lyrics = await song.lyrics();

            if (!lyrics) {
                return interaction.reply(`Sorry, I couldn't fetch the lyrics for "${songName}".`);
            }

            const chunks = lyrics.match(/[\s\S]{1,4096}/g);

            for (const chunk of chunks) {
                await interaction.reply({ content: chunk });
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                // Access token expired, refresh the token and retry
                console.log('Genius access token expired. Refreshing token...');
                await refreshGeniusToken();
                return this.execute(interaction, client);
            } else {
                console.error(`Error fetching lyrics for "${songName}":`, error);
                return interaction.reply(`There was an error trying to fetch the lyrics for "${songName}".`);
            }
        }
    },
};