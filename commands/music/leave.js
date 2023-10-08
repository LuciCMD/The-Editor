const { EmbedBuilder } = require('@discordjs/builders');
const { getVoiceConnection } = require("@discordjs/voice");
const path = require('path');

const leaveVoicePath = 'attachment://leave.png';

module.exports = {
    data: {
        name: 'leave',
        description: 'Makes the bot leave the current voice channel.',
    },

    async execute(interaction, client) {
        const connection = getVoiceConnection(interaction.guildId);

        if (!connection) {
            const embed = new EmbedBuilder()
                .setTitle(`Leave Voice`)
                .setDescription(`I'm not currently in a voice channel.`)
                .setThumbnail(leaveVoicePath);
            return interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'leave.png')]});
        }

        try {
            connection.destroy();
            const embed = new EmbedBuilder()
                .setTitle(`Leave Voice`)
                .setDescription(`Successfully left the voice channel.`)
                .setThumbnail(leaveVoicePath);
            await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'leave.png')]});
        } catch (error) {
            console.error(error);
            const embed = new EmbedBuilder()
                .setTitle(`Leave Voice Error`)
                .setDescription(`There was an error trying to leave the voice channel.`)
                .setThumbnail(leaveVoicePath);
            await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'leave.png')]});
        }
    }
};