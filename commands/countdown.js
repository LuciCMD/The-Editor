const { EmbedBuilder } = require('@discordjs/builders');
const { ChannelType } = require('discord-api-types/v10');
const { AUTHORIZED_USERS } = require('../config.json');

module.exports = {
    data: {
        name: 'countdown',
        description: 'Start a countdown to a specified time',
        options: [
            {
                name: 'endtime',
                type: 3, // STRING
                description: 'End time for the countdown (YYYY-MM-DD HH:MM)',
                required: true
            }
        ]
    },

    async execute(interaction) {
        if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }

        const endTimeString = interaction.options.getString('endtime');
        const endTime = Date.parse(endTimeString + ':00Z'); // Adjust for UTC
        if (isNaN(endTime)) {
            await interaction.reply({ content: "Invalid time format. Please use YYYY-MM-DD HH:MM format in UTC.", ephemeral: true });
            return;
        }

        const now = Date.now();
        if (endTime <= now) {
            await interaction.reply({ content: "The specified time is in the past. Please enter a future time.", ephemeral: true });
            return;
        }

        let countdownEmbed = new EmbedBuilder()
            .setTitle("Countdown Timer")
            .setDescription(`Countdown to ${endTimeString} (UTC)`)
            .addFields({ name: "Time Left", value: "Calculating..." })
            .setColor(0xFF5733);

        let message;
        // Try sending the message directly to the channel to avoid interaction token expiration issues
        if (interaction.channel.type === ChannelType.GuildText) {
            message = await interaction.channel.send({ embeds: [countdownEmbed] });
        } else {
            // For non-guild channels, fall back to replying to the interaction
            message = await interaction.reply({ embeds: [countdownEmbed], fetchReply: true });
        }

        // Update countdown every 2 seconds
        const interval = setInterval(async () => {
            const now = Date.now();
            if (endTime <= now) {
                clearInterval(interval);
                countdownEmbed.setDescription(`The countdown to ${endTimeString} (UTC) has ended!`);
                countdownEmbed.setFields({ name: "Time Left", value: `0h 0m 0s` });
                message.edit({ embeds: [countdownEmbed] }).catch(console.error);
                return;
            }

            let delta = endTime - now;
            let hours = Math.floor(delta / (1000 * 60 * 60));
            delta -= hours * (1000 * 60 * 60);
            let minutes = Math.floor(delta / (1000 * 60));
            delta -= minutes * (1000 * 60);
            let seconds = Math.floor(delta / (1000));

            countdownEmbed.setFields({ name: "Time Left", value: `${hours}h ${minutes}m ${seconds}s` });
            message.edit({ embeds: [countdownEmbed] }).catch(error => {
                if (error.code === 10008) { // "Unknown Message"
                    console.error('Message was deleted. Stopping the countdown.');
                    clearInterval(interval);
                } else {
                    console.error('Failed to edit message: ', error);
                }
            });
        }, 2000); // Update frequency set to 2 seconds
    }
};