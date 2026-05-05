require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent
] });

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('BOT_TOKEN is not defined. Set BOT_TOKEN in the environment.');
  process.exit(1);
}

// DEBUG: Log masked token to verify which one Railway is using
console.log(`Attempting to login with token starting with ${TOKEN.substring(0, 4)}... and ending with ...${TOKEN.substring(TOKEN.length - 4)}`);

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('?activitycheck')) {
    const args = message.content.slice('?activitycheck'.length).trim().split(/ +/);
    const day = args[0];

    if (!day) {
      return message.reply('Please provide a day number. Example: `?activitycheck 1`');
    }

    try {
      const activityMsg = await message.channel.send(`@everyone ActivityCheck ${day}`);
      await activityMsg.react('✅');
    } catch (error) {
      console.error('Error sending activity check:', error);
      message.reply('Error sending activity check. Ensure I have "Mention Everyone" permissions!');
    }
  }
});

client.on('error', (err) => {
  console.error('Discord client error:', err);
});

client.login(TOKEN).catch(err => {
  console.error('Failed to login with provided token:', err);
  process.exit(1);
});

// Global handler for unhandled promise rejections to aid debugging in deployment environments
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
