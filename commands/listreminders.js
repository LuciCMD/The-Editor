const { EmbedBuilder } = require('@discordjs/builders');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

module.exports = {
    data: {
        name: 'listreminders',
        description: 'List all reminders you have created',
    },

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        
        // Connect to the database
        const dbPath = path.join(__dirname, '..', 'database', 'reminders_db.sqlite');
        const db = new sqlite3.Database(dbPath);
        
        // Get all reminders created by the user in this guild
        db.all(
            "SELECT * FROM reminders WHERE creator_id = ? AND guild_id = ? ORDER BY next_trigger ASC",
            [userId, guildId],
            (err, rows) => {
                if (err) {
                    console.error(err);
                    db.close();
                    return interaction.reply({ 
                        content: "An error occurred while fetching your reminders.", 
                        ephemeral: true 
                    });
                }
                
                if (rows.length === 0) {
                    db.close();
                    return interaction.reply("You don't have any reminders set in this server.");
                }
                
                const reminderPath = 'attachment://reminder.png';
                const embed = new EmbedBuilder()
                    .setTitle("Your Reminders")
                    .setColor(0x00FF00)
                    .setThumbnail(reminderPath);
                
                // Add each reminder to the embed
                for (const reminder of rows) {
                    const nextDate = new Date(reminder.next_trigger * 1000);
                    const repeatsLeft = reminder.remaining_repeats === null ? "∞" : reminder.remaining_repeats;
                    
                    embed.addFields({
                        name: `${reminder.title} (ID: ${reminder.id})`,
                        value: `${reminder.description}\n**Next Trigger:** ${nextDate.toLocaleString()}\n**Repeats Left:** ${repeatsLeft}`
                    });
                }
                
                interaction.reply({ 
                    embeds: [embed], 
                    files: [path.join(__dirname, '..', 'assets', 'reminder.png')] 
                });
                
                db.close();
            }
        );
    }
};