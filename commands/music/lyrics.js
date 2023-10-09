const { EmbedBuilder } = require('@discordjs/builders');
const Genius = require('genius-lyrics');
const TOKEN = '';
const Client = new Genius.Client(TOKEN);

function cleanSongName(songName) {
    return songName
        .replace(/\[Official Video\]/gi, '')
        .replace(/\[Lyric Video\]/gi, '')
        .replace(/\[Official Audio\]/gi, '')
        .replace(/\[Official Music Video\]/gi, '')
        .replace(/\[MV\]/gi, '')
        .trim();
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
            const songs = await Client.songs.search(cleanedSongName);
            const lyrics = await songs[0].lyrics();
            
            if (!lyrics) {
                return interaction.reply(`Sorry, I couldn't fetch the lyrics for ${songName}.`);
            }

            // Split the lyrics into manageable sections if they're too long for a single Discord message
            const chunks = lyrics.match(/[\s\S]{1,2048}/g);

            for (const chunk of chunks) {
                interaction.reply({ content: chunk });
            }

        } catch (error) {
            console.error(error);
            return interaction.reply(`There was an error trying to fetch the lyrics for ${songName}.`);
        }
    }
};