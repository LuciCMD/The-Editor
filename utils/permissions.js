const dbManager = require('../database/dbManager');
const config = require('./config');
const { PermissionFlagsBits } = require('discord.js');

function hasDiscordAdmin(member) {
    if (!member) {
        return false;
    }
    return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isAuthorized(userId, guildId) {
    if (!userId || !guildId) {
        return Promise.resolve(false);
    }

    const db = dbManager.getDatabase('permissions_db');
    return new Promise((resolve) => {
        db.get(
            "SELECT id FROM authorized_users WHERE user_id = ? AND guild_id = ?",
            [userId, guildId],
            (err, row) => {
                if (err) {
                    console.error('Error checking authorization:', err);
                    resolve(false);
                    return;
                }
                resolve(!!row);
            }
        );
    });
}

function hasPermission(userId, guildId, permission) {
    if (!userId || !guildId || !permission) {
        return Promise.resolve(false);
    }

    const db = dbManager.getDatabase('permissions_db');
    return new Promise((resolve) => {
        db.get(
            "SELECT id FROM user_permissions WHERE user_id = ? AND guild_id = ? AND permission = ?",
            [userId, guildId, permission],
            (err, row) => {
                if (err) {
                    console.error('Error checking permission:', err);
                    resolve(false);
                    return;
                }
                resolve(!!row);
            }
        );
    });
}

async function checkPermission(interaction, permission) {
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id;
    const member = interaction.member;

    if (!guildId) {
        return false;
    }

    if (hasDiscordAdmin(member)) {
        return true;
    }

    const isAuth = await isAuthorized(userId, guildId);
    if (isAuth) {
        return true;
    }

    if (permission) {
        return await hasPermission(userId, guildId, permission);
    }

    return false;
}

function addAuthorizedUser(userId, guildId, username, addedBy) {
    if (!userId || !guildId || !addedBy) {
        return Promise.reject(new Error('Missing parameters'));
    }

    const db = dbManager.getDatabase('permissions_db');
    return new Promise((resolve, reject) => {
        db.run(
            "INSERT OR IGNORE INTO authorized_users (user_id, guild_id, username, added_by) VALUES (?, ?, ?, ?)",
            [userId, guildId, username, addedBy],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes > 0);
            }
        );
    });
}

function removeAuthorizedUser(userId, guildId) {
    if (!userId || !guildId) {
        return Promise.reject(new Error('Missing parameters'));
    }

    const db = dbManager.getDatabase('permissions_db');
    return new Promise((resolve, reject) => {
        db.run(
            "DELETE FROM authorized_users WHERE user_id = ? AND guild_id = ?",
            [userId, guildId],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes > 0);
            }
        );
    });
}

function grantPermission(userId, guildId, permission, grantedBy) {
    if (!userId || !guildId || !permission || !grantedBy) {
        return Promise.reject(new Error('Missing parameters'));
    }

    const db = dbManager.getDatabase('permissions_db');
    return new Promise((resolve, reject) => {
        db.run(
            "INSERT OR IGNORE INTO user_permissions (user_id, guild_id, permission, granted_by) VALUES (?, ?, ?, ?)",
            [userId, guildId, permission, grantedBy],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes > 0);
            }
        );
    });
}

function revokePermission(userId, guildId, permission) {
    if (!userId || !guildId || !permission) {
        return Promise.reject(new Error('Missing parameters'));
    }

    const db = dbManager.getDatabase('permissions_db');
    return new Promise((resolve, reject) => {
        db.run(
            "DELETE FROM user_permissions WHERE user_id = ? AND guild_id = ? AND permission = ?",
            [userId, guildId, permission],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes > 0);
            }
        );
    });
}

function getUserPermissions(userId, guildId) {
    if (!userId || !guildId) {
        return Promise.resolve([]);
    }

    const db = dbManager.getDatabase('permissions_db');
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT permission FROM user_permissions WHERE user_id = ? AND guild_id = ?",
            [userId, guildId],
            (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows ? rows.map(row => row.permission) : []);
            }
        );
    });
}

function isLegacyAuthorized(userId) {
    if (!userId) {
        return false;
    }
    return config.AUTHORIZED_USERS && config.AUTHORIZED_USERS.includes(userId);
}

module.exports = {
    hasDiscordAdmin,
    isAuthorized,
    hasPermission,
    checkPermission,
    addAuthorizedUser,
    removeAuthorizedUser,
    grantPermission,
    revokePermission,
    getUserPermissions,
    isLegacyAuthorized
};
