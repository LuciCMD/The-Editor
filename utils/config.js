// Settings from the environment, loaded from .env or .env.test by node --env-file
// Same keys as the old config.json so call sites didn't change

// Notepad saves a BOM and Node keeps it in the first key's name, so fix that key for every reader
const BOM = '﻿';
for (const key of Object.keys(process.env)) {
    if (key.startsWith(BOM) && !(key.slice(1) in process.env)) {
        process.env[key.slice(1)] = process.env[key];
    }
}

// Also accepts the old config.json shape ["111","222"] pasted as is
function parseList(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return [];
    }
    return value.replace(/[[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean);
}

module.exports = {
    token: process.env.DISCORD_TOKEN || '',
    geniusToken: process.env.GENIUS_TOKEN || '',
    virusTotalApiKey: process.env.VIRUSTOTAL_API_KEY || '',
    AUTHORIZED_USERS: parseList(process.env.AUTHORIZED_USERS),
    testGuildId: process.env.TEST_GUILD_ID || '',
    databaseDir: process.env.DATABASE_DIR || '',
    parseList
};
