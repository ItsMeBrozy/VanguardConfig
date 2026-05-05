require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

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

// Define the activity check command
const commands = [
  {
    name: 'activitycheck',
    description: 'Pings everyone for an activity check',
    options: [
      {
        name: 'day',
        type: 3, // STRING
        description: 'The day number',
        required: true,
      },
    ],
  },
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const guildId = process.env.GUILD_ID;

  try {
    if (guildId) {
      console.log(`Registering slash commands for GUILD: ${guildId} (Instant)`);
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildId),
        { body: commands },
      );
    } else {
      console.log('Registering slash commands GLOBALLY (May take up to 1 hour)');
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands },
      );
    }
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
}

// DEBUG: Log masked token to verify which one Railway is using
console.log(`Attempting to login with token starting with ${TOKEN.substring(0, 4)}... and ending with ...${TOKEN.substring(TOKEN.length - 4)}`);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'activitycheck') {
    const day = interaction.options.getString('day');
    try {
      const activityMsg = await interaction.channel.send(`@everyone ActivityCheck ${day}`);
      await activityMsg.react('✅');
      await interaction.reply({ content: `Activity check ${day} started!`, ephemeral: true });
    } catch (error) {
      console.error('Error sending slash activity check:', error);
      await interaction.reply({ content: 'Error sending activity check. Check my permissions!', ephemeral: true });
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const prefix = ['?', '!'];
  if (!prefix.some(p => message.content.startsWith(p))) return;

  const content = message.content.slice(1).trim();
  if (content.startsWith('activitycheck')) {
    const args = content.slice('activitycheck'.length).trim().split(/ +/);
    const day = args[0];

    if (!day) {
      return message.reply('Please provide a day number. Example: `?activitycheck 1` or `!activitycheck 1`');
    }

    try {
      const activityMsg = await message.channel.send(`@everyone ActivityCheck ${day}`);
      await activityMsg.react('✅');
    } catch (error) {
      console.error('Error sending prefix activity check:', error);
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
