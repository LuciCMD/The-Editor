// These two read AUTHORIZED_USERS without importing it and threw a ReferenceError

const test = require('node:test');
const assert = require('node:assert');
const { useTempEnv, removeDir, fakeInteraction, replyText } = require('./helpers');

const dir = useTempEnv({ AUTHORIZED_USERS: 'owner' });

const dbManager = require('../database/dbManager');
const addCurrency = require('../commands/add_currency');
const ungag = require('../commands/ungag_user');

test.after(async () => {
    await dbManager.closeAllConnections();
    removeDir(dir);
});

for (const [name, command] of [['add_currency', addCurrency], ['ungag', ungag]]) {
    test(`/${name} refuses a user who isn't authorized`, async () => {
        const target = { id: 'target', username: 'Target' };
        const { interaction, done } = fakeInteraction({ userId: 'stranger', target });

        await command.execute(interaction);
        assert.match(replyText(await done), /not authorized/);
    });
}
