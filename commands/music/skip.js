const { EmbedBuilder } = require('@discordjs/builders');
const skipPath = 'attachment://skip.png';
const path = require('path');

module.exports = {
    data: {
        name: 'skip',
        description: 'Skips the currently playing song.',
    },

    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`Skip Music`)
                .setDescription(`You need to be in a voice channel to skip music!`)
                .setThumbnail(skipPath);
            return interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'skip.png')]});
        }

        const queue = client.distube.getQueue(interaction.guild);

        if (!queue || !queue.songs[0]) {  // Just checking for the currently playing song
            const embed = new EmbedBuilder()
                .setTitle(`Skip Music`)
                .setDescription(`There is no song currently playing to skip!`)
                .setThumbnail(skipPath);
            return interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'skip.png')]});
        }

        try {
            if (queue.songs[1]) { // If there's a next song in the queue
                client.distube.skip(interaction.guild);
                const embed = new EmbedBuilder()
                    .setTitle(`Skip Music`)
                    .setDescription(`Skipped the currently playing song!`)
                    .setThumbnail(skipPath);
                await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'skip.png')]});
            } else {
                client.distube.stop(interaction.guild); // If no song is up next, stop the current song
                const embed = new EmbedBuilder()
                    .setTitle(`Skip Music`)
                    .setDescription(`Stopped the current song as there is no song up next!`)
                    .setThumbnail(skipPath);
                await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'skip.png')]});
            }
        } catch (error) {
            console.error(error);
            const embed = new EmbedBuilder()
                .setTitle(`Skip Music`)
                .setDescription(`Error occurred while trying to skip the song.`)
                .setThumbnail(skipPath);
            await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'skip.png')]});
        }
    }
};