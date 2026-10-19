// Discord client options, kept apart from app.js so tests can check them without logging in

const { GatewayIntentBits } = require('discord.js');

module.exports = {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ],
    // Song titles, poll options and reminder text are user-controlled, so only user pings go through
    // and @everyone, @here and roles never do, reminders still ping the people they tag
    allowedMentions: { parse: ['users'], repliedUser: true }
};
