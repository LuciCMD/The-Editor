const { EmbedBuilder } = require('@discordjs/builders');
const playPath = 'attachment://play.png';
const path = require('path');

module.exports = {
    data: {
        name: 'play',
        description: 'Plays a song from YouTube or Spotify.',
        options: [
            {
                name: 'song',
                type: 3,  // STRING type
                description: 'The URL or name of the song you want to play.',
                required: true
            }
        ]
    },

    async execute(interaction, client) {
        const song = interaction.options.getString('song');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`Play Music`)
                .setDescription(`You need to be in a voice channel to play music!`)
                .setThumbnail(playPath);
            return interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'play.png')]});
        }

        try {
            client.distube.play(voiceChannel, song);
            await new Promise(r => setTimeout(r, 2000));  // Wait for 2 seconds

            const queue = client.distube.getQueue(interaction.guild);
            // Get the last song added or the current song if only one song is in the queue.
            const lastSong = queue?.songs[queue.songs.length - 1]?.name || 'Unknown Song';

            let description;
            if (queue.songs.length === 1) {
                description = `Now playing: ${lastSong}`;
            } else {
                description = `Queued: ${lastSong}`;
            }

            const embed = new EmbedBuilder()
                .setTitle(`Play Music`)
                .setDescription(description)
                .setThumbnail(playPath);
            await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'play.png')]});

        } catch (error) {
            console.error(error);
            const embed = new EmbedBuilder()
                .setTitle(`Play Music`)
                .setDescription(`Error occurred while trying to play the song.`)
                .setThumbnail(playPath);
            await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'play.png')]});
        }
    }
};