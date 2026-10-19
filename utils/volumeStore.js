// Per-guild music volume, kept in a small JSON file so it survives restarts

const fs = require('fs');
const path = require('path');
const { SQLITE_DIR } = require('../database/dbManager');

// Inside the database folder so it lands in the Docker volume and survives rebuilds
const FILE_PATH = path.join(SQLITE_DIR, 'volume_state.json');
const DEFAULT_VOLUME = 50;
const MIN_VOLUME = 0;
const MAX_VOLUME = 150;

let cache = null;

function load() {
    if (cache) {
        return cache;
    }
    try {
        cache = fs.existsSync(FILE_PATH)
            ? JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'))
            : {};
    } catch (error) {
        console.error('volumeStore: failed to load, using empty state:', error.message);
        cache = {};
    }
    return cache;
}

function get(guildId) {
    if (!guildId) {
        return DEFAULT_VOLUME;
    }
    const value = load()[guildId];
    return typeof value === 'number' ? value : DEFAULT_VOLUME;
}

function set(guildId, value) {
    if (!guildId || typeof value !== 'number') {
        throw new Error('volumeStore.set requires a guildId and numeric value');
    }
    const clamped = Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, Math.round(value)));
    const state = load();
    state[guildId] = clamped;
    try {
        fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
        fs.writeFileSync(FILE_PATH, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('volumeStore: failed to save:', error.message);
    }
    return clamped;
}

module.exports = { get, set, DEFAULT_VOLUME, MIN_VOLUME, MAX_VOLUME };
