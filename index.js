require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, Partials } = require('discord.js');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('BOT_TOKEN is not defined. Set BOT_TOKEN in the environment.');
  process.exit(1);
}

// Storage for active checks: Map<messageId, {users: [], loopInterval: Timer, channelId: string}>
const activeChecks = new Map();

const commands = [
  {
    name: 'activitycheck',
    description: 'Starts a recurring activity check loop',
    options: [
      {
        name: 'loop',
        type: 3, // STRING
        description: 'Time loop (e.g., 1h, 24h, 1d)',
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
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    }
    console.log('Successfully reloaded (/) commands.');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
}

function parseLoopTime(timeStr) {
  const match = timeStr.match(/^(\d+)(h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  return unit === 'h' ? value * 3600000 : value * 86400000;
}

async function sendActivityCheck(channel) {
  const content = `# Vanguard FC | Activity Check\n\n**Fastest 5**\n(Waiting for reactions...)\n\n|| @everyone @here`;
  try {
    const msg = await channel.send(content);
    await msg.react('✅');
    
    // Initialize tracking for this specific message
    activeChecks.set(msg.id, {
      users: [],
      channelId: channel.id
    });
    return msg;
  } catch (e) {
    console.error('Failed to send activity check:', e);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'activitycheck') {
    const loopStr = interaction.options.getString('loop');
    const intervalMs = parseLoopTime(loopStr);

    if (!intervalMs) {
      return interaction.reply({ content: 'Invalid loop format! Use `1h` for 1 hour or `1d` for 1 day.', ephemeral: true });
    }

    try {
      await interaction.reply({ content: `Activity Check loop started every ${loopStr}!`, ephemeral: true });
      
      // Start the first one immediately
      await sendActivityCheck(interaction.channel);

      // Schedule the loop
      setInterval(async () => {
        await sendActivityCheck(interaction.channel);
      }, intervalMs);

    } catch (error) {
      console.error('Error starting loop:', error);
      await interaction.reply({ content: 'Error starting activity check loop.', ephemeral: true });
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.emoji.name !== '✅') return;

  const checkData = activeChecks.get(reaction.message.id);
  if (!checkData) return;

  // Only track first 5 unique users
  if (checkData.users.length < 5 && !checkData.users.includes(user.id)) {
    checkData.users.push(user.id);

    const userMention = `<@${user.id}>`;
    const userList = checkData.users.map((id, index) => `${index + 1}- <@${id}>`).join('\n\n');
    
    const newContent = `# Vanguard FC | Activity Check\n\n**Fastest 5**\n${userList}\n\n|| @everyone @here`;
    
    try {
      await reaction.message.edit(newContent);
    } catch (e) {
      console.error('Error updating activity check message:', e);
    }
  }
});

client.on('error', (err) => console.error('Discord client error:', err));
client.login(TOKEN).catch(err => {
  console.error('Failed to login:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
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
