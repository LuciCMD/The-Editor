const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { EmbedBuilder } = require('@discordjs/builders');

const dbPathGags = path.join(__dirname, '..', 'database', 'gags_db.sqlite');
const dbGags = new sqlite3.Database(dbPathGags);

const dbPathWords = path.join(__dirname, '..', 'database', 'badwords_db.sqlite');
const dbWords = new sqlite3.Database(dbPathWords);

async function checkAndReplaceBannedWords(author, channel, message) {
    if (!channel || typeof channel.send !== 'function') {
        throw new Error('Invalid channel provided to checkAndReplaceBannedWords function.');
    }

    let messageContent = message.content;
    let messageAltered = false;

    // Check for banned words
    const rows = await new Promise((resolve, reject) => {
        dbWords.all("SELECT word FROM banned_words WHERE user_id=?", [author.id], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    if (rows.length > 0) {
        rows.forEach(row => {
            if (messageContent.includes(row.word)) {
                messageContent = messageContent.replace(new RegExp(row.word, 'gi'), '🤐');
                messageAltered = true;
            }
        });
    }

    // Check for gags
    const gag = await new Promise((resolve, reject) => {
        dbGags.get("SELECT type, end_time, reason FROM gags WHERE user_id=?", [author.id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    if (gag) {
        const { type, end_time: endTime, reason } = gag;
        if (Date.now() > endTime) {
            // Remove from the database since gag is expired
            dbGags.run("DELETE FROM gags WHERE user_id=?", [author.id]);
        } else {
            const replacements = {
                "cricket": ["Chirp... Chirp...", "chiiirp chirp chirp", "CHIRP CHIRP CHIIIIIIIRP"],
                "dog": ["Woof!", "Bark bark!", "Woof woof!"],
                "cat": ["Meow!", "Meow meow!", "Mow mow!", "Meow meow meow!", "Meow meow meow meow?", "meow mow"],
                "pokemon": ["Pika!", "Pika pika!", "pika pika pika", "pika pika?!"],
                "bunny": ["Hop hop!", "hop?", "it's not because you're a rabbit, it's because you're black"],
                "hamster": ["Squeek!", "squeek", "Squeeeeeek..."],
                "mute": [":zipper_mouth:"]
            };

            messageContent = replacements[type][Math.floor(Math.random() * replacements[type].length)];
            messageAltered = true;
        }
    }

    if (messageAltered) {
        try {
            await message.delete();
            await channel.send(messageContent);
        } catch (err) {
            console.error("Failed to process the message:", err);
        }
    }
}

module.exports = checkAndReplaceBannedWords;