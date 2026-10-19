const { getUserPermissions, isAuthorized, hasDiscordAdmin } = require('../utils/permissions');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: {
        name: 'permission_list',
        description: 'List permissions for a user in this server',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'The user to check (defaults to yourself)',
                required: false
            }
        ]
    },

    async execute(interaction, client) {
        const guildId = interaction.guild.id;
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const targetUserId = targetUser.id;
        const targetUsername = targetUser.username;

        const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
        const isAdmin = targetMember ? hasDiscordAdmin(targetMember) : false;
        const isUserAuthorized = await isAuthorized(targetUserId, guildId);

        try {
            const permissions = await getUserPermissions(targetUserId, guildId);
            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle(`Permissions for ${targetUsername}`)
                .setTimestamp();

            let status = [];
            if (isAdmin) {
                status.push('Server Administrator (full access)');
            }
            if (isUserAuthorized) {
                status.push('Authorized user');
            }
            if (status.length === 0) {
                status.push('No special authorization');
            }

            embed.setDescription(status.join('\n'));

            if (permissions.length > 0) {
                embed.addFields({
                    name: 'Additional Permissions',
                    value: permissions.join('\n')
                });
            } else if (!isAdmin && !isUserAuthorized) {
                embed.addFields({
                    name: 'Additional Permissions',
                    value: 'None'
                });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error listing permissions:', error);
            await interaction.reply({
                content: 'An error occurred while listing permissions.',
                ephemeral: true
            });
        }
    }
};
