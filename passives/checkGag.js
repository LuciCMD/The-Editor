const dbManager = require('../database/dbManager');

async function checkAndReplaceBannedWords(author, channel, message) {
    if (!channel || typeof channel.send !== 'function') {
        throw new Error('Invalid channel provided to checkAndReplaceBannedWords function.');
    }

    let messageContent = message.content;
    let messageAltered = false;

    const dbWords = dbManager.getDatabase('badwords_db');
    const dbGags = dbManager.getDatabase('gags_db');

    try {
        const rows = await new Promise((resolve, reject) => {
            dbWords.all("SELECT word FROM banned_words WHERE user_id=?", [author.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
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

        const gag = await new Promise((resolve, reject) => {
            dbGags.get("SELECT type, end_time, reason FROM gags WHERE user_id=?", [author.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (gag) {
            if (Date.now() > gag.end_time) {
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

                const options = replacements[gag.type];
                if (options) {
                    messageContent = options[Math.floor(Math.random() * options.length)];
                    messageAltered = true;
                }
            }
        }

        if (messageAltered) {
            await message.delete();
            await channel.send(messageContent);
        }
    } catch (err) {
        console.error("Error in checkAndReplaceBannedWords:", err);
    }
}

module.exports = checkAndReplaceBannedWords;