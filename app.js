const fs = require('fs');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const config = require('./config.json');
const checkGag = require('./passives/checkGag');
const currencyHandler = require('./passives/messageCurrency');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildMessageReactions] });

// Collection to store the commands
client.commands = new Collection();

// Dynamically read and set commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

const registerCommands = async () => {
    const data = new REST({ version: '10' }).setToken(config.token);

    await data.put(Routes.applicationCommands(client.user.id), {
        body: client.commands.map(cmd => cmd.data)
    });
};

// Passive event handler loading
const passiveFiles = fs.readdirSync('./passives').filter(file => file.endsWith('.js'));
for (const file of passiveFiles) {
    const passive = require(`./passives/${file}`);
    if (passive.name && typeof passive.execute === "function" && passive.name !== 'messageCreate') {
        client.on(passive.name, passive.execute);
    }
}

client.once('ready', async () => {
    console.log('Bot is online!');
    await registerCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, config.AUTHORIZED_USERS);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error trying to execute that command!', ephemeral: true });
    }
});

client.on('messageCreate', async message => {
    // Log message details (from your passive script)
    if (message.content) {
        console.log(`Message Received: ${message.author.username}#${message.author.discriminator} - ${message.content}`);
    } else if (message.attachments.size > 0) {
        console.log(`Message from ${message.author.username}#${message.author.discriminator} contains attachments.`);
    } else if (message.embeds.length > 0) {
        console.log(`Message from ${message.author.username}#${message.author.discriminator} contains embeds.`);
    } else {
        console.log(`Message from ${message.author.username}#${message.author.discriminator} received without text content.`);
    }

    // Handle the gag check
    const wasGagged = await checkGag(message.author, message.channel, message);
    if (wasGagged) {
        // If the message was from a gagged user, return early
        return;
    }

    // If the message isn't from a gagged user, handle the currency addition
    currencyHandler.execute(message);
});

client.login(config.token);