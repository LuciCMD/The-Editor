const { joinVoiceChannel } = require('@discordjs/voice');
const v2 = require('../../utils/componentsV2');

const OK_COLOR = 0x1DB954;
const ERROR_COLOR = 0xFF0000;

module.exports = {
    data: {
        name: 'join',
        description: 'Makes the bot join the current voice channel.'
    },

    async execute(interaction) {
        const voiceChannel = interaction.member && interaction.member.voice
            ? interaction.member.voice.channel
            : null;

        if (!voiceChannel) {
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Join Voice Channel', body: 'Please join a voice channel first!' })
            });
        }

        try {
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.infoPanel({ color: OK_COLOR, heading: 'Join Voice Channel', body: `Joined ${voiceChannel.toString()}.` })
            });
        } catch (error) {
            console.error('Error joining voice channel:', error);
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Join Voice Channel', body: 'There was an error connecting to the voice channel.' })
            });
        }
    }
};
