const { addAuthorizedUser, checkPermission } = require('../utils/permissions');

module.exports = {
    data: {
        name: 'auth_add',
        description: 'Add a user to the authorized users list (requires Administrator or authorized user)',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'The user to add',
                required: true
            }
        ]
    },

    async execute(interaction, client) {
        const requesterId = interaction.user.id;
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
                content: 'You do not have permission to add authorized users. You must be a server Administrator or an authorized user.',
                ephemeral: true
            });
        }

        const targetUserId = targetUser.id;
        const targetUsername = targetUser.username;

        try {
            const added = await addAuthorizedUser(targetUserId, guildId, targetUsername, requesterId);

            if (added) {
                await interaction.reply({
                    content: `Successfully added ${targetUsername} to authorized users for this server.`
                });
            } else {
                await interaction.reply({
                    content: `${targetUsername} is already an authorized user in this server.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error adding authorized user:', error);
            await interaction.reply({
                content: 'An error occurred while adding the user.',
                ephemeral: true
            });
        }
    }
};
