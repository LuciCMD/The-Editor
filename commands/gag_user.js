const { EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { AUTHORIZED_USERS } = require('../config.json');

// Helper function to parse the duration
function parseDuration(durationStr) {
    let hours = 0;
    let minutes = 0;
    const hourMatch = durationStr.match(/(\d+)h/);
    const minuteMatch = durationStr.match(/(\d+)m/);
    if (hourMatch) hours = parseInt(hourMatch[1]);
    if (minuteMatch) minutes = parseInt(minuteMatch[1]);
    return hours * 60 * 60 * 1000 + minutes * 60 * 1000; // Return milliseconds
}

module.exports = {
    data: {
        name: 'gag',
        description: 'Gag a user with a specific type for a duration',
        options: [
            {
                name: 'user',
                type: 6,  // USER type
                description: 'User to gag',
                required: true
            },
            {
                name: 'type',
                type: 3,  // STRING type
                description: 'Type of gag (e.g. cricket, dog, cat, ...)',
                required: true
            },
            {
                name: 'duration',
                type: 3,  // STRING type
                description: 'Duration of the gag (e.g. 1h30m)',
                required: true
            },
            {
                name: 'reason',
                type: 3,  // STRING type
                description: 'Reason for the gag',
                required: false
            }
        ]
    },

    async execute(interaction) {
        console.log('AUTHORIZED_USERS:', AUTHORIZED_USERS); // Debugging line
        console.log('Type of AUTHORIZED_USERS:', typeof AUTHORIZED_USERS); // Debugging line
        console.log('Interaction User ID:', interaction.user.id); // Debugging line

        if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user');
        const type = interaction.options.getString('type');
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason');

        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            await interaction.reply(`Couldn't find a member with ID ${user.id}.`);
            return;
        }

        const memberName = member.nickname || member.displayName;
        const endTime = Date.now() + parseDuration(duration);

        const dbPath = path.join(__dirname, '..', 'database', 'gags_db.sqlite');
        const db = new sqlite3.Database(dbPath);

        // Save to the database
        db.run("INSERT OR REPLACE INTO gags (user_id, type, end_time, reason) VALUES (?, ?, ?, ?)",
            [user.id, type, endTime, reason], (err) => {
                if (err) {
                    console.error(err);
                    interaction.reply({ content: "An error occurred while updating the database.", ephemeral: true });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle("Gag Information")
                    .setDescription(`${memberName} has been gagged`)
                    .setColor(0xFF5733)
                    .addFields(
                        { name: "🕰 Duration", value: duration, inline: true },
                        { name: "🚨 Reason", value: reason || "No reason provided", inline: true },
                        { name: "🤐 Gag Type", value: type, inline: true }
                    );

                interaction.reply({ embeds: [embed] });
            });
    }
};