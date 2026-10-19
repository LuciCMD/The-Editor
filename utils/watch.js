// Shared helpers for the channel-watch feature (backed by watched_channels_db).

const { ChannelType, PermissionsBitField } = require('discord.js');
const dbManager = require('../database/dbManager');

// One rule for the slash option, the picker and every relayed message, picker values come from the
// client so they can't be trusted to be channels the user can see
// Returns why the member can't watch the channel, or null when they can
function watchRefusal(member, channel) {
    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
        return 'You can only watch text channels.';
    }
    const permissions = member ? channel.permissionsFor(member) : null;
    if (!permissions || !permissions.has(PermissionsBitField.Flags.ViewChannel)) {
        return "You don't have permission to view this channel.";
    }
    return null;
}

// Add a watch, or update ignore_bots if it already exists.
// Returns 'added' or 'updated'.
function addWatch(userId, channel, guildName, ignoreBots) {
    const db = dbManager.getDatabase('watched_channels_db');
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id FROM watched_channels WHERE user_id = ? AND channel_id = ?",
            [userId, channel.id],
            (err, row) => {
                if (err) {
                    return reject(err);
                }
                if (row) {
                    db.run(
                        "UPDATE watched_channels SET ignore_bots = ? WHERE user_id = ? AND channel_id = ?",
                        [ignoreBots ? 1 : 0, userId, channel.id],
                        (upErr) => (upErr ? reject(upErr) : resolve('updated'))
                    );
                } else {
                    db.run(
                        "INSERT INTO watched_channels (user_id, channel_id, guild_id, channel_name, guild_name, ignore_bots) VALUES (?, ?, ?, ?, ?, ?)",
                        [userId, channel.id, channel.guild.id, channel.name, guildName, ignoreBots ? 1 : 0],
                        (insErr) => (insErr ? reject(insErr) : resolve('added'))
                    );
                }
            }
        );
    });
}

function removeWatch(userId, channelId) {
    const db = dbManager.getDatabase('watched_channels_db');
    return new Promise((resolve, reject) => {
        db.run(
            "DELETE FROM watched_channels WHERE user_id = ? AND channel_id = ?",
            [userId, channelId],
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            }
        );
    });
}

function listWatched(userId) {
    const db = dbManager.getDatabase('watched_channels_db');
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT * FROM watched_channels WHERE user_id = ? ORDER BY guild_name, channel_name",
            [userId],
            (err, rows) => (err ? reject(err) : resolve(rows || []))
        );
    });
}

// Flip ignore_bots for a watch. Returns the new boolean, or null if not found.
function toggleIgnoreBots(userId, channelId) {
    const db = dbManager.getDatabase('watched_channels_db');
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT ignore_bots FROM watched_channels WHERE user_id = ? AND channel_id = ?",
            [userId, channelId],
            (err, row) => {
                if (err) {
                    return reject(err);
                }
                if (!row) {
                    return resolve(null);
                }
                const next = row.ignore_bots ? 0 : 1;
                db.run(
                    "UPDATE watched_channels SET ignore_bots = ? WHERE user_id = ? AND channel_id = ?",
                    [next, userId, channelId],
                    (upErr) => (upErr ? reject(upErr) : resolve(Boolean(next)))
                );
            }
        );
    });
}

module.exports = { watchRefusal, addWatch, removeWatch, listWatched, toggleIgnoreBots };
