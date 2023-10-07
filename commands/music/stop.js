const { EmbedBuilder } = require('@discordjs/builders');
const pausePath = 'attachment://pause.png';
const path = require('path');

module.exports = {
    data: {
        name: 'stop',
        description: 'Stops the music and leaves the voice channel.',
    },

    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`Stop Music`)
                .setDescription(`You need to be in a voice channel to stop music!`)
                .setThumbnail(pausePath);
            return interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'pause.png')]});
        }

        const queue = client.distube.getQueue(interaction.guild);

        if (!queue || !queue.songs[0]) {
            const embed = new EmbedBuilder()
                .setTitle(`Stop Music`)
                .setDescription(`There is no song currently playing to stop!`)
                .setThumbnail(pausePath);
            return interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'pause.png')]});
        }

        try {
            client.distube.stop(interaction.guild);
            const embed = new EmbedBuilder()
                .setTitle(`Stop Music`)
                .setDescription(`Stopped the music and left the voice channel!`)
                .setThumbnail(pausePath);
            await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'pause.png')]});
        } catch (error) {
            console.error(error);
            const embed = new EmbedBuilder()
                .setTitle(`Stop Music`)
                .setDescription(`Error occurred while trying to stop the music.`)
                .setThumbnail(pausePath);
            await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'pause.png')]});
        }
    }
};
