const { EmbedBuilder } = require('@discordjs/builders');
const dbManager = require('../database/dbManager');
const { watchRefusal } = require('../utils/watch');

module.exports = {
    name: 'messageCreate',
    execute: async (message, client) => {
        // Ignore DMs
        if (!message.guild) return;
        
        // Connect to database
        const db = dbManager.getDatabase('watched_channels_db');
        
        // Find all users watching this channel
        db.all(
            "SELECT user_id, ignore_bots FROM watched_channels WHERE channel_id = ?",
            [message.channel.id],
            async (err, rows) => {
                if (err) {
                    console.error('Error fetching channel watchers:', err);
                    return;
                }
                
                if (!rows || rows.length === 0) {
                    return;
                }
                
                // Send DM to each watcher
                for (const row of rows) {
                    // Don't notify the message author about their own message
                    if (row.user_id === message.author.id) continue;
                    
                    // Check if we should ignore bot messages for this user
                    if (message.author.bot && row.ignore_bots === 1) continue;

                    try {
                        // Re-checked per message so a watcher who lost access or left stops getting DMs
                        const member = await message.guild.members.fetch(row.user_id).catch(() => null);
                        if (watchRefusal(member, message.channel)) {
                            console.log(`Skipping watch DM to ${row.user_id}, no access to ${message.channel.id}`);
                            continue;
                        }


                        const user = await client.users.fetch(row.user_id);
                        if (!user) continue;
                        
                        // Create embed for the notification
                        const embed = new EmbedBuilder()
                            .setTitle("Watched Channel Activity")
                            .setAuthor({
                                name: message.author.tag + (message.author.bot ? " (Bot)" : ""),
                                iconURL: message.author.displayAvatarURL()
                            })
                            .addFields(
                                { name: "Channel", value: `#${message.channel.name}`, inline: true },
                                { name: "Server", value: message.guild.name, inline: true }
                            )
                            .setColor(message.author.bot ? 0x7289DA : 0x5865F2)
                            .setTimestamp(message.createdTimestamp)
                            .setFooter({ text: `Message ID: ${message.id}` });
                        
                        // Add message content if it exists
                        if (message.content) {
                            // Truncate if too long
                            const content = message.content.length > 1024 
                                ? message.content.substring(0, 1021) + '...' 
                                : message.content;
                            embed.setDescription(content);
                        }
                        
                        // Add embed info if present (common for bot messages)
                        if (message.embeds.length > 0) {
                            const embedInfo = message.embeds[0];
                            if (embedInfo.title || embedInfo.description) {
                                let embedText = "";
                                if (embedInfo.title) embedText += `**${embedInfo.title}**\n`;
                                if (embedInfo.description) {
                                    embedText += embedInfo.description.length > 500 
                                        ? embedInfo.description.substring(0, 497) + '...'
                                        : embedInfo.description;
                                }
                                embed.addFields({
                                    name: "Embed Content",
                                    value: embedText.substring(0, 1024),
                                    inline: false
                                });
                            }
                        }
                        
                        // Add attachment info if present
                        if (message.attachments.size > 0) {
                            const attachmentList = message.attachments
                                .map(att => att.name)
                                .join(', ');
                            embed.addFields({
                                name: "Attachments",
                                value: attachmentList.substring(0, 1024),
                                inline: false
                            });
                        }
                        
                        // Add jump link
                        embed.addFields({
                            name: "Jump to Message",
                            value: `[Click here](${message.url})`,
                            inline: false
                        });
                        
                        // Send DM
                        await user.send({ embeds: [embed] });
                        
                    } catch (error) {
                        // User might have DMs disabled or bot might be blocked
                        if (error.code === 50007) {
                            console.log(`Cannot send DM to user ${row.user_id} - DMs disabled or bot blocked`);
                        } else {
                            console.error(`Error sending watch notification to ${row.user_id}:`, error);
                        }
                    }
                }
                
            }
        );
    }
};