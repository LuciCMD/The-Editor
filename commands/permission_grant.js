const { grantPermission, checkPermission } = require('../utils/permissions');

module.exports = {
    data: {
        name: 'permission_grant',
        description: 'Grant a permission to a user (requires Administrator or authorized user)',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'The user to grant permission to',
                required: true
            },
            {
                name: 'permission',
                type: 3,
                description: 'The permission to grant (e.g., virustotal_ignore)',
                required: true
            }
        ]
    },

    async execute(interaction, client) {
        const requesterId = interaction.user.id;
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
                content: 'You do not have permission to grant permissions. You must be a server Administrator or an authorized user.',
                ephemeral: true
            });
        }

        const targetUserId = targetUser.id;
        const targetUsername = targetUser.username;

        try {
            const granted = await grantPermission(targetUserId, guildId, permission, requesterId);

            if (granted) {
                await interaction.reply({
                    content: `Successfully granted '${permission}' permission to ${targetUsername} in this server.`
                });
            } else {
                await interaction.reply({
                    content: `${targetUsername} already has the '${permission}' permission in this server.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error granting permission:', error);
            await interaction.reply({
                content: 'An error occurred while granting the permission.',
                ephemeral: true
            });
        }
    }
};
