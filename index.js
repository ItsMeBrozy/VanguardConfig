require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const ALLOWED_USERS = ['1479214179146535096', '1495471090904993940'];

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
  console.error('BOT_TOKEN is not defined.');
  process.exit(1);
}

// Persistence Helpers
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { loops: {}, checks: {} };
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { loops: {}, checks: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

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
  const content = `# Vanguard FC | Activity Check\n\n**Fastest 5**\n(Waiting for reactions...)\n\n|| @everyone @here ||`;
  try {
    const msg = await channel.send(content);
    await msg.react('✅');
    
    const data = loadData();
    data.checks[msg.id] = { users: [] };
    saveData(data);
    return msg;
  } catch (e) {
    console.error('Failed to send activity check:', e);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();

  // Scheduler: Check every minute if a loop is due
  setInterval(async () => {
    const data = loadData();
    const now = Date.now();
    
    for (const [channelId, config] of Object.entries(data.loops)) {
      if (now >= config.nextRun) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) {
          await sendActivityCheck(channel);
          data.loops[channelId].nextRun = now + config.intervalMs;
          saveData(data);
        }
      }
    }
  }, 60000);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!ALLOWED_USERS.includes(interaction.user.id)) {
    return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
  }

  if (interaction.commandName === 'activitycheck') {
    const loopStr = interaction.options.getString('loop');
    const intervalMs = parseLoopTime(loopStr);

    if (!intervalMs) {
      return interaction.reply({ content: 'Invalid loop format! Use `1h` or `1d`.', ephemeral: true });
    }

    try {
      await interaction.reply({ content: `Activity Check loop started every ${loopStr}!`, ephemeral: true });
      await sendActivityCheck(interaction.channel);

      const data = loadData();
      data.loops[interaction.channel.id] = {
        intervalMs: intervalMs,
        nextRun: Date.now() + intervalMs
      };
      saveData(data);

    } catch (error) {
      console.error('Error starting loop:', error);
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.emoji.name !== '✅') return;

  const data = loadData();
  const checkData = data.checks[reaction.message.id];
  if (!checkData) return;

  if (checkData.users.length < 5 && !checkData.users.includes(user.id)) {
    checkData.users.push(user.id);
    saveData(data);

    const userList = checkData.users.map((id, index) => `${index + 1}- <@${id}>`).join('\n\n');
    const newContent = `# Vanguard FC | Activity Check\n\n**Fastest 5**\n${userList}\n\n|| @everyone @here ||`;
    
    try {
      await reaction.message.edit(newContent);
    } catch (e) {
      console.error('Error updating message:', e);
    }
  }
});

client.on('error', (err) => console.error('Discord client error:', err));
client.login(TOKEN).catch(err => process.exit(1));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

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
