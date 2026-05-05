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

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('error', (err) => {
  console.error('Discord client error:', err);
});

client.login(TOKEN);
