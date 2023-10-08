const { EmbedBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');

const volumePath = 'attachment://volume.png';
const volumeFilePath = path.join(__dirname, '..', '..', 'database', 'volume_state.json');

function readVolume(guildId) {
    let data = {};
    try {
        if (fs.existsSync(volumeFilePath)) {
            data = JSON.parse(fs.readFileSync(volumeFilePath, 'utf8'));
        }
    } catch (error) {
        console.error(`Error reading volume state: ${error.message}`);
    }
    return data[guildId] || 50;
}

function writeVolume(guildId, volume) {
    let data = {};
    try {
        if (fs.existsSync(volumeFilePath)) {
            data = JSON.parse(fs.readFileSync(volumeFilePath, 'utf8'));
        }
        data[guildId] = volume;
        fs.writeFileSync(volumeFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing volume state: ${error.message}`);
    }
}

module.exports = {
    data: {
        name: 'volume',
        description: 'Get or set the stream volume.',
        options: [
            {
                name: 'value',
                type: 4,
                description: 'The volume value you want to set (0-100).',
                required: false
            }
        ]
    },

    async execute(interaction, client) {
        const guildId = interaction.guild.id;
        const volumeValue = interaction.options.getInteger('value');

        console.log(`Guild ID: ${guildId}`);
        console.log(`Queue:`, client.distube.getQueue(interaction.guild));

        const queue = client.distube.getQueue(interaction.guild);
        if (!queue) {
            const embed = new EmbedBuilder()
                .setTitle(`Volume Error`)
                .setDescription(`There is no active music session in this guild.`)
                .setThumbnail(volumePath);
            return await interaction.reply({ embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'volume.png')] });
        }

        try {
            if (typeof volumeValue === 'undefined') {
                const currentVolume = readVolume(guildId);
                const embed = new EmbedBuilder()
                    .setTitle(`Volume Status`)
                    .setDescription(`The current volume is: **${currentVolume}%**`)
                    .setThumbnail(volumePath);
                await interaction.reply({ embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'volume.png')] });
            } else {
                client.distube.setVolume(interaction.guild, volumeValue);
                writeVolume(guildId, volumeValue);
                const embed = new EmbedBuilder()
                    .setTitle(`Volume Changed`)
                    .setDescription(`Volume set to: **${volumeValue}%**`)
                    .setThumbnail(volumePath);
                await interaction.reply({ embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'volume.png')] });
            }
        } catch (error) {
            console.error(error);
            if (error.errorCode === 'NO_QUEUE') {
                const embed = new EmbedBuilder()
                    .setTitle(`Volume Error`)
                    .setDescription(`The bot needs to be playing music for the volume to be changed.`)
                    .setThumbnail(volumePath);
                await interaction.reply({ embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'volume.png')] });
            } else {
                const embed = new EmbedBuilder()
                    .setTitle(`Volume Error`)
                    .setDescription(`An unexpected error occurred while trying to change the volume.`)
                    .setThumbnail(volumePath);
                await interaction.reply({ embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'volume.png')] });
            }
        }
    }
};