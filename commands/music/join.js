const { EmbedBuilder } = require('@discordjs/builders');
const { joinVoiceChannel } = require("@discordjs/voice");
const path = require('path');

const joinVoicePath = 'attachment://join.png';
const leaveVoicePath = 'attachment://leave.png';

module.exports = {
    data: {
        name: 'join',
        description: 'Makes the bot join the current voice channel.',
    },

    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`Join Voice Channel`)
                .setDescription(`Please join a voice channel!`)
                .setThumbnail(leaveVoicePath);
            return interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'leave.png')]});
        }
        try {
            joinVoiceChannel({
                channelId: interaction.member.voice.channelId,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });
            const embed = new EmbedBuilder()
                .setTitle(`Join Voice Channel`)
                .setDescription(`Successfully joined the voice channel.`)
                .setThumbnail(joinVoicePath);
            await interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'join.png')]});
        } catch (error) {
            const embed = new EmbedBuilder()
                .setTitle(`Join Voice Channel Error`)
                .setDescription(`There was an error connecting to the voice channel: ${error}`);
            return interaction.reply({embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'leave.png')]});
        }
    }
};