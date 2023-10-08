const { EmbedBuilder } = require('@discordjs/builders');
const queuePath = 'attachment://queue.png';
const path = require('path');

module.exports = {
    data: {
        name: 'queue',
        description: 'Displays the list of songs in the queue.',
    },

    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`Music Queue`)
                .setDescription(`You need to be in a voice channel to see the queue!`)
                .setThumbnail(queuePath);
            return interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'queue.png')]});
        }

        const queue = client.distube.getQueue(interaction.guild);

        if (!queue || !queue.songs[0]) {
            const embed = new EmbedBuilder()
                .setTitle(`Music Queue`)
                .setDescription(`There are no songs in the queue right now!`)
                .setThumbnail(queuePath);
            return interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'queue.png')]});
        }

        const nowPlaying = queue.songs[0];
        const upNext = queue.songs.slice(1).map((song, index) => `${index + 1}. ${song.name}`).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`Music Queue`)
            .setDescription(`**Now Playing:**\n${nowPlaying.name}\n\n**Up Next:**\n${upNext || "No songs up next."}`)
            .setThumbnail(queuePath);
        await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'queue.png')]});
    }
};