require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');
const { loadData, saveData } = require('./database');
require('./server'); // Start the web server

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

const commands = [
  {
    name: 'activitycheck',
    description: 'Starts a recurring activity check loop',
    options: [
      {
        name: 'loop',
        type: 3, // STRING
        description: 'Time loop (e.g., 5s, 1m, 1h, 1d)',
        required: true,
      },
    ],
  },
  {
    name: 'stopactivitycheck',
    description: 'Stops the activity check loop in this channel',
  },
  {
    name: 'setup-applications',
    description: 'Set the channel where applications are reviewed',
    options: [
      {
        name: 'channel',
        type: 7, // CHANNEL
        description: 'The channel for reviews',
        required: true,
      }
    ]
  }
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const guildId = process.env.GUILD_ID;
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    }
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
}

function parseLoopTime(timeStr) {
  const match = timeStr.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers = {
    's': 1000,
    'm': 60000,
    'h': 3600000,
    'd': 86400000
  };
  
  return value * multipliers[unit];
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
  }, 1000);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'activitycheck') {
      if (!ALLOWED_USERS.includes(interaction.user.id)) return interaction.reply({ content: 'No permission.', ephemeral: true });
      const loopStr = interaction.options.getString('loop');
      const intervalMs = parseLoopTime(loopStr);
      if (!intervalMs) return interaction.reply({ content: 'Invalid format.', ephemeral: true });
      
      await interaction.reply({ content: `Loop started: ${loopStr}`, ephemeral: true });
      await sendActivityCheck(interaction.channel);
      const data = loadData();
      data.loops[interaction.channel.id] = { intervalMs, nextRun: Date.now() + intervalMs };
      saveData(data);
    } 
    else if (interaction.commandName === 'stopactivitycheck') {
      if (!ALLOWED_USERS.includes(interaction.user.id)) return interaction.reply({ content: 'No permission.', ephemeral: true });
      const data = loadData();
      if (data.loops[interaction.channel.id]) {
        delete data.loops[interaction.channel.id];
        saveData(data);
        await interaction.reply({ content: 'Stopped.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'No active loop.', ephemeral: true });
      }
    }
    else if (interaction.commandName === 'setup-applications') {
      if (!ALLOWED_USERS.includes(interaction.user.id)) return interaction.reply({ content: 'No permission.', ephemeral: true });
      const channel = interaction.options.getChannel('channel');
      const data = loadData();
      data.config.reviewChannelId = channel.id;
      saveData(data);
      await interaction.reply({ content: `Applications will be sent to ${channel}.`, ephemeral: true });
    }
  }

  // Handle Modal Submit
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('reject_reason_')) {
      const appId = interaction.customId.replace('reject_reason_', '');
      const reason = interaction.fields.getTextInputValue('reason');
      
      const data = loadData();
      const appIndex = data.applications.findIndex(a => a.id === appId);
      
      if (appIndex !== -1) {
        data.applications[appIndex].status = 'rejected';
        data.applications[appIndex].rejectReason = reason;
        saveData(data);

        await interaction.reply({ content: 'Application rejected with reason.', ephemeral: true });
        
        // Notify user
        const user = await client.users.fetch(data.applications[appIndex].userId).catch(() => null);
        if (user) {
          user.send(`Your application to Vanguard FC has been rejected.\n**Reason:** ${reason}`).catch(() => null);
        }

        // Update the original message
        if (interaction.message) {
          const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('#e74c3c')
            .setTitle('Application Rejected')
            .addFields({ name: 'Rejection Reason', value: reason });
          await interaction.message.edit({ embeds: [embed], components: [] });
        }
      }
    }
  }

  // Handle Button Clicks
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('approve_')) {
      const appId = interaction.customId.replace('approve_', '');
      const data = loadData();
      const appIndex = data.applications.findIndex(a => a.id === appId);

      if (appIndex !== -1) {
        data.applications[appIndex].status = 'approved';
        saveData(data);

        await interaction.reply({ content: 'Application approved!', ephemeral: true });

        // Notify user
        const user = await client.users.fetch(data.applications[appIndex].userId).catch(() => null);
        if (user) {
          user.send(`Congratulations! Your application to Vanguard FC has been **approved**!`).catch(() => null);
        }

        // Update original message
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor('#2ecc71')
          .setTitle('Application Approved');
        await interaction.message.edit({ embeds: [embed], components: [] });
      }
    }

    if (interaction.customId.startsWith('reject_')) {
      const appId = interaction.customId.replace('reject_', '');
      
      const modal = new ModalBuilder()
        .setCustomId(`reject_reason_${appId}`)
        .setTitle('Rejection Reason');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Why is this application being rejected?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
    }
  }
});

// Handle Discord Native "Apply to Join" (Guild Join Requests)
client.on('raw', async (packet) => {
  if (packet.t === 'GUILD_JOIN_REQUEST_CREATE') {
    const data = packet.d;
    const { user, form_responses, created_at } = data;
    
    // Extract questions and answers
    const answers = (form_responses || []).map(fr => ({
      label: fr.label,
      response: fr.response
    }));

    const dbData = loadData();
    const appId = `native_${user.id}_${Date.now()}`;
    
    const newApp = {
      id: appId,
      userId: user.id,
      username: `${user.username}${user.discriminator !== '0' ? '#' + user.discriminator : ''}`,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      fields: answers,
      status: 'pending',
      timestamp: new Date(created_at).getTime()
    };

    dbData.applications.push(newApp);
    saveData(dbData);
    console.log(`New native join request from ${user.username}`);
  }

  if (packet.t === 'GUILD_JOIN_REQUEST_UPDATE') {
    const data = packet.d;
    const { user, status } = data;
    
    const dbData = loadData();
    // Find the latest pending application for this user
    const appIndex = dbData.applications
      .slice()
      .reverse()
      .findIndex(a => a.userId === user.id && a.status === 'pending');
    
    if (appIndex !== -1) {
      const actualIndex = dbData.applications.length - 1 - appIndex;
      dbData.applications[actualIndex].status = status === 'approved' ? 'approved' : 'rejected';
      saveData(dbData);
      console.log(`Native join request updated for ${user.username}: ${status}`);
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.emoji.name !== '✅') return;
  if (reaction.partial) await reaction.fetch().catch(() => null);

  const data = loadData();
  let checkData = data.checks[reaction.message.id];
  
  if (!checkData && reaction.message.content.includes('Vanguard FC | Activity Check')) {
    checkData = { users: [] };
    data.checks[reaction.message.id] = checkData;
  }

  if (checkData && checkData.users.length < 5 && !checkData.users.includes(user.id)) {
    checkData.users.push(user.id);
    saveData(data);
    const userList = checkData.users.map((id, index) => `${index + 1}- <@${id}>`).join('\n\n');
    const newContent = `# Vanguard FC | Activity Check\n\n**Fastest 5**\n${userList}\n\n|| @everyone @here ||`;
    await reaction.message.edit(newContent).catch(() => null);
  }
});

client.login(TOKEN);
