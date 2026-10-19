const { ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const v2 = require('../utils/componentsV2');
const watch = require('../utils/watch');

const OK_COLOR = 0x00FF00;
const ERROR_COLOR = 0xFF0000;

module.exports = {
    data: {
        name: 'watch',
        description: 'Watch a channel to get DMs when messages are posted (no options = picker)',
        options: [
            { name: 'channel', type: 7, description: 'The channel to watch', required: false },
            { name: 'ignore_bots', type: 5, description: 'Ignore messages from bots (default: false)', required: false }
        ]
    },

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const ignoreBots = interaction.options.getBoolean('ignore_bots') ?? false;

        // No channel supplied -> show a channel picker.
        if (!channel) {
            const menu = new ChannelSelectMenuBuilder()
                .setCustomId('watch:add')
                .setPlaceholder('Select a channel to watch')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.container({
                    color: OK_COLOR,
                    components: [v2.textDisplay('## Watch a Channel\nPick a channel below. You can toggle bot messages afterwards.'), v2.selectRow(menu)]
                })
            });
        }

        const refusal = watch.watchRefusal(interaction.member, channel);
        if (refusal) {
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Channel Watch', body: refusal }) });
        }

        try {
            const result = await watch.addWatch(interaction.user.id, channel, interaction.guild.name, ignoreBots);
            const verb = result === 'updated' ? 'Updated watch settings for' : "You're now watching";
            return v2.reply(interaction, {
                ephemeral: true,
                components: v2.infoPanel({
                    color: OK_COLOR,
                    heading: 'Channel Watch',
                    body: `${verb} ${channel.toString()}.\n🤖 Bot messages: **${ignoreBots ? 'ignored' : 'included'}**`
                })
            });
        } catch (error) {
            console.error('Error adding watched channel:', error);
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Channel Watch', body: 'An error occurred while adding the watched channel.' }) });
        }
    }
};
