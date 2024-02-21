const { EmbedBuilder } = require('@discordjs/builders');
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
        const endTime = Date.parse(endTimeString + ':00Z'); // Adding seconds and Z to indicate UTC
        if (isNaN(endTime)) {
            await interaction.reply({ content: "Invalid time format. Please use YYYY-MM-DD HH:MM format in UTC.", ephemeral: true });
            return;
        }

        const now = Date.now();
        if (endTime <= now) {
            await interaction.reply({ content: "The specified time is in the past. Please enter a future time.", ephemeral: true });
            return;
        }

        const countdownEmbed = new EmbedBuilder()
            .setTitle("Countdown Timer")
            .setDescription(`Countdown to ${endTimeString} (UTC)`)
            .addFields({ name: "Time Left", value: "Calculating..." })
            .setColor(0xFF5733);

        const message = await interaction.reply({ embeds: [countdownEmbed], fetchReply: true });

        // Update countdown every second
        const interval = setInterval(async () => {
            const now = Date.now();
            if (endTime <= now) {
                clearInterval(interval);
                countdownEmbed.setDescription(`The countdown to ${endTimeString} (UTC) has ended!`);
                countdownEmbed.setFields({ name: "Time Left", value: `0h 0m 0s` });
                try {
                    await interaction.editReply({ embeds: [countdownEmbed] });
                } catch (error) {
                    console.error('Failed to edit message: ', error);
                }
                return;
            }

            let delta = endTime - now; // Difference in milliseconds
            let hours = Math.floor(delta / (1000 * 60 * 60));
            delta -= hours * (1000 * 60 * 60);
            let minutes = Math.floor(delta / (1000 * 60));
            delta -= minutes * (1000 * 60);
            let seconds = Math.floor(delta / (1000));

            countdownEmbed.setFields({ name: "Time Left", value: `${hours}h ${minutes}m ${seconds}s` });
            try {
                await interaction.editReply({ embeds: [countdownEmbed] });
            } catch (error) {
                if (error.code === 10008) { // "Unknown Message" error
                    console.error('Message was deleted. Stopping the countdown.');
                    clearInterval(interval); // Stop the countdown if the message was deleted.
                } else {
                    console.error('Failed to edit message: ', error);
                }
            }
        }, 1000);
    }
};