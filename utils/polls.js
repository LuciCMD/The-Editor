// Poll persistence helpers (backed by polls_db). Votes survive restarts because
// they are keyed by the poll's database id, which is embedded in the button
// customIds — no in-memory state required.

const dbManager = require('../database/dbManager');

function createPoll(guildId, channelId, question, options, createdBy) {
    const db = dbManager.getDatabase('polls_db');
    return new Promise((resolve, reject) => {
        db.run(
            "INSERT INTO polls (guild_id, channel_id, question, options, created_by) VALUES (?, ?, ?, ?, ?)",
            [guildId, channelId, question, JSON.stringify(options), createdBy],
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

function setPollMessageId(pollId, messageId) {
    const db = dbManager.getDatabase('polls_db');
    return new Promise((resolve, reject) => {
        db.run("UPDATE polls SET message_id = ? WHERE id = ?", [messageId, pollId], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function getPoll(pollId) {
    const db = dbManager.getDatabase('polls_db');
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM polls WHERE id = ?", [pollId], (err, row) => {
            if (err) {
                return reject(err);
            }
            if (!row) {
                return resolve(null);
            }
            let options = [];
            try {
                options = JSON.parse(row.options);
            } catch (parseErr) {
                console.error(`Poll ${pollId} has corrupt options:`, parseErr.message);
            }
            resolve({ ...row, options });
        });
    });
}

// Set or toggle a user's vote. Clicking the option they already chose clears it.
function toggleVote(pollId, userId, optionIndex) {
    const db = dbManager.getDatabase('polls_db');
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT option_index FROM poll_votes WHERE poll_id = ? AND user_id = ?",
            [pollId, userId],
            (err, row) => {
                if (err) {
                    return reject(err);
                }
                if (row && row.option_index === optionIndex) {
                    db.run("DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?", [pollId, userId],
                        (delErr) => (delErr ? reject(delErr) : resolve('cleared')));
                } else {
                    db.run(
                        "INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES (?, ?, ?) " +
                        "ON CONFLICT(poll_id, user_id) DO UPDATE SET option_index = excluded.option_index",
                        [pollId, userId, optionIndex],
                        (upErr) => (upErr ? reject(upErr) : resolve('set'))
                    );
                }
            }
        );
    });
}

// Return an array of vote counts indexed by option.
function getCounts(pollId, optionCount) {
    const db = dbManager.getDatabase('polls_db');
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT option_index, COUNT(*) AS c FROM poll_votes WHERE poll_id = ? GROUP BY option_index",
            [pollId],
            (err, rows) => {
                if (err) {
                    return reject(err);
                }
                const counts = new Array(optionCount).fill(0);
                for (const row of rows || []) {
                    if (row.option_index >= 0 && row.option_index < optionCount) {
                        counts[row.option_index] = row.c;
                    }
                }
                resolve(counts);
            }
        );
    });
}

module.exports = { createPoll, setPollMessageId, getPoll, toggleVote, getCounts };
