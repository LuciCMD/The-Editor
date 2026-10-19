const test = require('node:test');
const assert = require('node:assert');
const { useTempEnv, removeDir } = require('./helpers');

const dir = useTempEnv();

const { Client, MessagePayload, ChannelType, Collection } = require('discord.js');
const dbManager = require('../database/dbManager');
const clientOptions = require('../utils/clientOptions');
const watch = require('../utils/watch');
const watchComponent = require('../components/watch');
const channelWatcher = require('../passives/channelWatcher');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeChannel(id, { visible, type = ChannelType.GuildText } = {}) {
    return {
        id,
        type,
        name: id,
        guild: { id: 'guild' },
        permissionsFor: () => ({ has: () => visible }),
        toString: () => `<#${id}>`
    };
}

function watchRow(userId, channelId) {
    return new Promise((resolve, reject) => {
        dbManager.getDatabase('watched_channels_db').get(
            'SELECT * FROM watched_channels WHERE user_id = ? AND channel_id = ?', [userId, channelId],
            (err, row) => (err ? reject(err) : resolve(row))
        );
    });
}

function pickChannel(userId, channel) {
    let replied;
    const done = new Promise((resolve) => { replied = resolve; });
    const interaction = {
        values: [channel.id],
        user: { id: userId },
        member: { id: userId },
        guild: { name: 'Guild', channels: { cache: new Map([[channel.id, channel]]) } },
        reply: (payload) => { replied(payload); return Promise.resolve(); }
    };
    return { interaction, done };
}

// Message as channelWatcher sees it, `dms` collects what each watcher was sent
function postMessage(channel, memberVisible) {
    const dms = [];
    const message = {
        id: 'm1',
        url: 'https://discord.com/channels/guild/c/m1',
        content: 'secret plans',
        createdTimestamp: Date.now(),
        embeds: [],
        attachments: new Collection(),
        author: { id: 'author', bot: false, tag: 'author#0', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' },
        guild: {
            name: 'Guild',
            members: { fetch: async (id) => ({ id, visible: memberVisible }) }
        },
        channel
    };
    const client = { users: { fetch: async (id) => ({ id, send: async (payload) => dms.push({ id, payload }) }) } };
    return { message, client, dms };
}

test.before(() => dbManager.initializeDatabases());
test.after(async () => {
    await dbManager.closeAllConnections();
    removeDir(dir);
});

test('messages never allow @everyone, @here or role pings by default', () => {
    const client = new Client(clientOptions);
    try {
        const body = new MessagePayload({ client }, { content: '@everyone' }).resolveBody().body;
        assert.ok(body.allowed_mentions, 'no allowed_mentions sent, Discord parses everything');
        assert.deepStrictEqual(body.allowed_mentions.parse, ['users']);
    } finally {
        client.destroy();
    }
});

test('watchRefusal allows a visible text channel only', () => {
    assert.strictEqual(watch.watchRefusal({}, fakeChannel('a', { visible: true })), null);
    assert.match(watch.watchRefusal({}, fakeChannel('b', { visible: false })), /permission/);
    assert.match(watch.watchRefusal(null, fakeChannel('c', { visible: true })), /permission/);
    assert.match(watch.watchRefusal({}, fakeChannel('d', { visible: true, type: ChannelType.GuildVoice })), /text channels/);
});

test('the watch picker refuses a channel the user cannot see', async () => {
    const { interaction, done } = pickChannel('snoop', fakeChannel('hidden', { visible: false }));
    await watchComponent.execute(Object.assign(interaction, { customId: 'watch:add' }));
    await done;
    assert.strictEqual(await watchRow('snoop', 'hidden'), undefined, 'hidden channel was saved as a watch');
});

test('the watch picker still adds a channel the user can see', async () => {
    const { interaction, done } = pickChannel('reader', fakeChannel('open', { visible: true }));
    await watchComponent.execute(Object.assign(interaction, { customId: 'watch:add' }));
    await done;
    assert.ok(await watchRow('reader', 'open'));
});

test('a watcher without access to the channel gets no DM', async () => {
    const channel = fakeChannel('private', { visible: false });
    await watch.addWatch('lost-access', channel, 'Guild', false);
    const { message, client, dms } = postMessage(channel, false);
    await channelWatcher.execute(message, client);
    await wait(300);
    assert.deepStrictEqual(dms, [], 'message from a channel the watcher cannot see was DMed');
});

test('a watcher with access still gets the DM', async () => {
    const channel = fakeChannel('public', { visible: true });
    await watch.addWatch('still-member', channel, 'Guild', false);
    const { message, client, dms } = postMessage(channel, true);
    await channelWatcher.execute(message, client);
    for (let i = 0; i < 20 && dms.length === 0; i++) await wait(50);
    assert.strictEqual(dms.length, 1);
    assert.strictEqual(dms[0].id, 'still-member');
});
