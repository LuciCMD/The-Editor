const { removeAuthorizedUser, checkPermission } = require('../utils/permissions');

module.exports = {
    data: {
        name: 'auth_remove',
        description: 'Remove a user from the authorized users list (requires Administrator or authorized user)',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'The user to remove',
                required: true
            }
        ]
    },

    async execute(interaction, client) {
        const guildId = interaction.guild.id;
        const targetUser = interaction.options.getUser('user');

        if (!targetUser) {
            return interaction.reply({
                content: 'Invalid user specified.',
                ephemeral: true
            });
        }

        const hasPerms = await checkPermission(interaction);

        if (!hasPerms) {
            return interaction.reply({
                content: 'You do not have permission to remove authorized users. You must be a server Administrator or an authorized user.',
                ephemeral: true
            });
        }

        const targetUserId = targetUser.id;
        const targetUsername = targetUser.username;

        try {
            const removed = await removeAuthorizedUser(targetUserId, guildId);

            if (removed) {
                await interaction.reply({
                    content: `Successfully removed ${targetUsername} from authorized users for this server.`
                });
            } else {
                await interaction.reply({
                    content: `${targetUsername} is not an authorized user in this server.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error removing authorized user:', error);
            await interaction.reply({
                content: 'An error occurred while removing the user.',
                ephemeral: true
            });
        }
    }
};
