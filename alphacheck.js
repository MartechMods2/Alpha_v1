module.exports = {
    name: 'alphacheck',
    category: 'public',
    description: 'A custom command to verify Alpha Bot is online.',
    async execute(client, m, args) {
        // This response can only ever be fired by your Node app code execution loop
        await m.reply('🛡️ [SYSTEM IDENTITY VERIFICATION]\n\n🤖 Status: ACTIVE\n⚙️ Engine: Alpha Bot V1\n🌐 Server: Hosted on Render\n\n🟢 This confirmation message confirms you are speaking directly to Alpha!');
    }
};
