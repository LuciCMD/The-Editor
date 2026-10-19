const { revokePermission, checkPermission } = require('../utils/permissions');

module.exports = {
    data: {
        name: 'permission_revoke',
        description: 'Revoke a permission from a user (requires Administrator or authorized user)',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'The user to revoke permission from',
                required: true
            },
            {
                name: 'permission',
                type: 3,
                description: 'The permission to revoke (e.g., virustotal_ignore)',
                required: true
            }
        ]
    },

    async execute(interaction, client) {
        const guildId = interaction.guild.id;
        const targetUser = interaction.options.getUser('user');
        const permission = interaction.options.getString('permission');

        if (!targetUser) {
            return interaction.reply({
                content: 'Invalid user specified.',
                ephemeral: true
            });
        }

        if (!permission) {
            return interaction.reply({
                content: 'Invalid permission specified.',
                ephemeral: true
            });
        }

        const hasPerms = await checkPermission(interaction);

        if (!hasPerms) {
            return interaction.reply({
                content: 'You do not have permission to revoke permissions. You must be a server Administrator or an authorized user.',
                ephemeral: true
            });
        }

        const targetUserId = targetUser.id;
        const targetUsername = targetUser.username;

        try {
            const revoked = await revokePermission(targetUserId, guildId, permission);

            if (revoked) {
                await interaction.reply({
                    content: `Successfully revoked '${permission}' permission from ${targetUsername} in this server.`
                });
            } else {
                await interaction.reply({
                    content: `${targetUsername} does not have the '${permission}' permission in this server.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error revoking permission:', error);
            await interaction.reply({
                content: 'An error occurred while revoking the permission.',
                ephemeral: true
            });
        }
    }
};
