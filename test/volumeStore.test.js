const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { useTempEnv, removeDir } = require('./helpers');

const dir = useTempEnv();

const dbManager = require('../database/dbManager');
const volumeStore = require('../utils/volumeStore');

test.after(async () => {
    await dbManager.closeAllConnections();
    removeDir(dir);
});

test('saved volume goes to the database folder', () => {
    assert.strictEqual(volumeStore.set('guild1', 80), 80);
    const file = path.join(dir, 'volume_state.json');
    assert.ok(fs.existsSync(file), 'volume_state.json not written to DATABASE_DIR');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { guild1: 80 });
});

test('volume is clamped and defaults apply', () => {
    assert.strictEqual(volumeStore.set('guild2', 999), volumeStore.MAX_VOLUME);
    assert.strictEqual(volumeStore.get('unknown'), volumeStore.DEFAULT_VOLUME);
});
