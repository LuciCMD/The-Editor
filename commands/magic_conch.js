const { EmbedBuilder } = require('@discordjs/builders');

module.exports = {
    data: {
        name: 'magicconch',
        description: 'Ask the magic conch a question',
        options: [
            {
                name: 'question',
                type: 3,  // STRING type
                description: 'The question to ask the magic conch',
                required: true
            }
        ]
    },

    async execute(interaction) {
        const responses = [
            // Default Answers
            "It is certain",
            "It is decidedly so",
            "Without a doubt",
            "Yes, definitely",
            "You may rely on it",
            "As I see it, yes",
            "Most likely",
            "Outlook good",
            "Signs point to yes",
            "Reply hazy, try again",
            "Ask again later",
            "Better not tell you now",
            "Cannot predict now",
            "Concentrate and ask again",
            "Don't count on it",
            "My reply is no",
            "My sources say no",
            "Outlook not so good",
            "Very doubtful",
            // Custom Answers
            "I dunno lol",
            "FUCK YES",
            "Go ask your therapist",
            "Computer says no",
            "Sneezes in Japanese",
            "My sources say no, but they've also given up on finding the meaning of life",
            "On Lunch - Try again later",
        ];

        const question = interaction.options.getString('question');
        const response = responses[Math.floor(Math.random() * responses.length)];

        const embed = new EmbedBuilder()
                .setTitle('The Magic Conch')
                .setDescription(`Question: ${question}\nAnswer: ${response}`)

        interaction.reply({embeds: [embed]})
    }
};