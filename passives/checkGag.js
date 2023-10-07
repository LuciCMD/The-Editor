const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { EmbedBuilder } = require('@discordjs/builders');

const dbPath = path.join(__dirname, '..', 'database', 'gags_db.sqlite');
const db = new sqlite3.Database(dbPath);

function checkGag(author, channel, message) {
    return new Promise((resolve, reject) => {
        if (!channel || typeof channel.send !== 'function') {
            throw new Error('Invalid channel provided to checkGag function.');
        }

        // Fetch the member from the guild
        const member = channel.guild.members.cache.get(author.id);
        if (!member) {
            return reject(new Error(`Couldn't find a member with ID ${author.id}.`));
        }

        const member_name = member.nickname || member.displayName || "Unknown Member";

        // Ensure the member name length is valid
        if (member_name.length < 2) {
            member_name = "Unknown Member";
        } else if (member_name.length > 32) {
            member_name = member_name.substring(0, 32);
        }

        db.get("SELECT type, end_time, reason FROM gags WHERE user_id=?", [author.id], async (err, row) => {
            if (err) return reject(err);

            if (row) {
                const { type, end_time: endTime, reason } = row;

                // Delete the original message
                try {
                    await message.delete();
                } catch (err) {
                    console.error("Failed to delete the original message:", err);
                }

                if (Date.now() > endTime) {
                    // Remove from the database since gag is expired
                    db.run("DELETE FROM gags WHERE user_id=?", [author.id], err => {
                        if (err) return reject(err);
                        resolve(null);  // Gag expired
                    });
                } else {
                    const replacements = {
                        "cricket": ["Chirp... Chirp...", "chiiirp chirp chirp", "CHIRP CHIRP CHIIIIIIIRP"],
                        "dog": ["Woof!", "Bark bark!", "Woof woof!"],
                        // ... other replacements ...
                    };

                    const replacementText = replacements[type][Math.floor(Math.random() * replacements[type].length)];

                    const embed = new EmbedBuilder()
                        .setDescription(replacementText)
                        .setFooter({ text: member_name })
                        .setThumbnail(author.displayAvatarURL());

                    await channel.send({ embeds: [embed] });
                    resolve(null);  // Gag message sent successfully
                }
            } else {
                resolve(null);
            }
        });
    });
}

module.exports = checkGag;