const v2 = require('../utils/componentsV2');
const watch = require('../utils/watch');

const INFO_COLOR = 0x3498DB;
const ERROR_COLOR = 0xFF0000;
const MAX_SHOWN = 12;

module.exports = {
    data: {
        name: 'listwatched',
        description: 'List all channels you are watching'
    },

    async execute(interaction) {
        let rows;
        try {
            rows = await watch.listWatched(interaction.user.id);
        } catch (error) {
            console.error('Error fetching watched channels:', error);
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Watched Channels', body: 'An error occurred while fetching your watched channels.' }) });
        }

        if (rows.length === 0) {
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: INFO_COLOR, heading: 'Watched Channels', body: "You're not watching any channels." }) });
        }

        const components = [v2.textDisplay(`## Your Watched Channels\n*🤖✅ bots included • 🤖❌ bots ignored*`)];
        for (const row of rows.slice(0, MAX_SHOWN)) {
            const botStatus = row.ignore_bots ? '🤖❌' : '🤖✅';
            const text = `<#${row.channel_id}> ${botStatus}\n*${row.guild_name}*`;
            components.push(v2.separator());
            components.push(v2.section({
                texts: [text],
                accessoryButton: v2.button({
                    id: `watch:remove:${row.channel_id}`,
                    label: 'Unwatch',
                    style: v2.ButtonStyle.Danger,
                    emoji: '🗑️'
                })
            }));
        }
        if (rows.length > MAX_SHOWN) {
            components.push(v2.separator());
            components.push(v2.textDisplay(`…and ${rows.length - MAX_SHOWN} more.`));
        }

        return v2.reply(interaction, { ephemeral: true, components: v2.container({ color: INFO_COLOR, components }) });
    }
};
