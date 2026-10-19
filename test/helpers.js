// Shared setup so no test touches database/sqlite or a real .env

const fs = require('fs');
const os = require('os');
const path = require('path');

// Call before requiring anything that loads dbManager or utils/config
function useTempEnv(env = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-editor-test-'));
    process.env.DATABASE_DIR = dir;
    for (const [key, value] of Object.entries(env)) {
        process.env[key] = value;
    }
    return dir;
}

function removeDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
        console.warn(`Could not remove ${dir}:`, error.message);
    }
}

// Minimal slash-command interaction, `done` resolves with the first reply payload
function fakeInteraction({ userId, target, strings = {} }) {
    let resolveReply;
    const done = new Promise((resolve) => { resolveReply = resolve; });
    const members = new Map();
    if (target) {
        members.set(target.id, { nickname: null, displayName: target.username, toString: () => `<@${target.id}>` });
    }
    const interaction = {
        user: { id: userId },
        options: {
            getUser: () => target,
            getString: (name) => (name in strings ? strings[name] : null),
            getNumber: (name) => (name in strings ? strings[name] : null)
        },
        guild: { members: { cache: members } },
        reply: (payload) => {
            resolveReply(payload);
            return Promise.resolve();
        }
    };
    return { interaction, done };
}

function replyText(payload) {
    return typeof payload === 'string' ? payload : payload.content;
}

module.exports = { useTempEnv, removeDir, fakeInteraction, replyText };
