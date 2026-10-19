const test = require('node:test');
const assert = require('node:assert');
const { useTempEnv, removeDir, fakeInteraction, replyText } = require('./helpers');

const dir = useTempEnv({ AUTHORIZED_USERS: 'owner' });

const dbManager = require('../database/dbManager');
const gag = require('../commands/gag_user');
const ungag = require('../commands/ungag_user');

function getGag(userId) {
    return new Promise((resolve, reject) => {
        dbManager.getDatabase('gags_db').get(
            'SELECT * FROM gags WHERE user_id = ?', [userId],
            (err, row) => (err ? reject(err) : resolve(row))
        );
    });
}

test.before(() => dbManager.initializeDatabases());
test.after(async () => {
    await dbManager.closeAllConnections();
    removeDir(dir);
});

test('/gag stores the gag where checkGag and /ungag read it', async () => {
    const target = { id: 'target', username: 'Target' };
    const { interaction, done } = fakeInteraction({
        userId: 'owner',
        target,
        strings: { type: 'cricket', duration: '1h', reason: 'test' }
    });

    await gag.execute(interaction);
    const payload = await done;

    assert.ok(payload.embeds, `expected the gag embed, got: ${replyText(payload)}`);
    const row = await getGag('target');
    assert.ok(row, 'gag row missing from the pooled gags_db');
    assert.strictEqual(row.type, 'cricket');
});

test('/ungag removes a gag made by /gag', async () => {
    const target = { id: 'target', username: 'Target' };
    const { interaction, done } = fakeInteraction({ userId: 'owner', target });

    await ungag.execute(interaction);
    assert.match(replyText(await done), /has been ungagged/);
    assert.strictEqual(await getGag('target'), undefined);
});
