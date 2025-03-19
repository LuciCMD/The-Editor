const { EmbedBuilder } = require('@discordjs/builders');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { AUTHORIZED_USERS } = require('../config.json');

module.exports = {
    data: {
        name: 'cancelreminder',
        description: 'Cancel a reminder',
        options: [
            {
                name: 'id',
                type: 4,  // INTEGER
                description: 'The ID of the reminder to cancel',
                required: true
            }
        ]
    },

    async execute(interaction) {
        const reminderId = interaction.options.getInteger('id');
        const userId = interaction.user.id;
        
        // Connect to the database
        const dbPath = path.join(__dirname, '..', 'database', 'reminders_db.sqlite');
        const db = new sqlite3.Database(dbPath);
        
        // Get the reminder
        db.get("SELECT * FROM reminders WHERE id = ?", [reminderId], (err, row) => {
            if (err) {
                console.error(err);
                db.close();
                return interaction.reply({ 
                    content: "An error occurred while fetching the reminder.", 
                    ephemeral: true 
                });
            }
            
            if (!row) {
                db.close();
                return interaction.reply("Reminder not found.");
            }
            
            // Check if the user is authorized to cancel this reminder
            if (row.creator_id !== userId && !AUTHORIZED_USERS.includes(userId)) {
                db.close();
                return interaction.reply("You don't have permission to cancel this reminder.");
            }
            
            // Delete the reminder
            db.run("DELETE FROM reminders WHERE id = ?", [reminderId], function(err) {
                if (err) {
                    console.error(err);
                    db.close();
                    return interaction.reply({ 
                        content: "An error occurred while canceling the reminder.", 
                        ephemeral: true 
                    });
                }
                
                const reminderPath = 'attachment://reminder.png';
                const embed = new EmbedBuilder()
                    .setTitle("Reminder Canceled")
                    .setDescription(`The reminder "${row.title}" has been canceled.`)
                    .setColor(0xFF0000)
                    .setThumbnail(reminderPath);
                
                interaction.reply({ 
                    embeds: [embed], 
                    files: [path.join(__dirname, '..', 'assets', 'reminder.png')] 
                });
                
                db.close();
            });
        });
    }
};