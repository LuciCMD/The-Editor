const { EmbedBuilder } = require('@discordjs/builders');
const config = require('../../config.json');
const path = require('path');
const { spawn } = require('child_process');
const { getVoiceConnection } = require('@discordjs/voice');

const restartPath = 'attachment://restart.png';

module.exports = {
    data: {
        name: 'restart',
        description: 'Restarts the bot (authorized users only).',
    },

    async execute(interaction, client) {
        // Check if the user executing the command is authorized
        if (!config.AUTHORIZED_USERS.includes(interaction.user.id)) {
            const embed = new EmbedBuilder()
                .setTitle(`Permission Denied`)
                .setDescription(`You do not have permission to restart the bot.`)
                .setThumbnail(restartPath);
            return interaction.reply({ embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'restart.png')] });
        }

        try {
            // Disconnect from all voice channels
            client.guilds.cache.forEach(guild => {
                const connection = getVoiceConnection(guild.id);
                if (connection) {
                    connection.destroy();
                }
            });            

            const embed = new EmbedBuilder()
                .setTitle(`Restarting`)
                .setDescription(`The bot will now restart.`)
                .setThumbnail(restartPath);
            await interaction.reply({ embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'restart.png')] });

            // Spawn a new bot instance
            let args = process.argv.slice(1);
            spawn(process.argv[0], args, {
                detached: true,
                stdio: 'inherit'
            }).unref();

            // Gracefully shut down the bot
            client.destroy();
            process.exit();

        } catch (error) {
            console.error(error);
            const embed = new EmbedBuilder()
                .setTitle(`Restart Error`)
                .setDescription(`An error occurred while attempting to restart the bot.`)
                .setThumbnail(restartPath);
            await interaction.reply({ embeds: [embed], files: [path.join(__dirname, '..', '..', 'assets', 'restart.png')] });
        }
    }
};