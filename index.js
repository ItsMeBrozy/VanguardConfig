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

// Poll Discord REST API for join requests
async function pollJoinRequests() {
  const guildId = process.env.GUILD_ID;
  if (!guildId) {
    console.log('[POLL] No GUILD_ID set, skipping join request poll');
    return;
  }

  try {
    // Fetch pending join requests from Discord REST API
    const requests = await client.rest.get(`/guilds/${guildId}/requests?status=SUBMITTED&limit=100`).catch(async (err) => {
      // Try alternative endpoint formats
      console.log(`[POLL] Primary endpoint failed (${err.status || err.message}), trying alternatives...`);
      
      // Try without query params
      const alt1 = await client.rest.get(`/guilds/${guildId}/requests`).catch(e => null);
      if (alt1) return alt1;
      
      // Try member-requests
      const alt2 = await client.rest.get(`/guilds/${guildId}/member-requests`).catch(e => null);
      if (alt2) return alt2;

      // Try join-requests 
      const alt3 = await client.rest.get(`/guilds/${guildId}/join-requests`).catch(e => null);
      if (alt3) return alt3;

      console.log('[POLL] All endpoints failed. Error:', err.message || err);
      return null;
    });

    if (!requests) return;

    console.log(`[POLL] Fetched response:`, JSON.stringify(requests).substring(0, 500));

    // Handle array or object with array inside
    const requestList = Array.isArray(requests) ? requests : (requests.guild_join_requests || requests.data || requests.requests || []);
    
    if (requestList.length === 0) {
      console.log('[POLL] No pending join requests found');
      return;
    }

    console.log(`[POLL] Found ${requestList.length} join request(s)`);

    const dbData = loadData();

    for (const req of requestList) {
      const user = req.user || {};
      const userId = user.id || req.user_id;
      
      if (!userId) continue;

      // Check if we already have a PENDING application for this user
      const existingPending = dbData.applications.find(a => a.userId === userId && a.status === 'pending');
      if (existingPending) continue;

      // Extract form responses
      const formResponses = req.form_responses || req.application_responses || [];
      const answers = formResponses.map(fr => ({
        label: fr.label || fr.field?.label || fr.question || 'Question',
        response: fr.response || fr.answer || fr.value || ''
      }));

      const reqStatus = (req.status || '').toLowerCase();
      const appStatus = reqStatus === 'approved' ? 'approved' : reqStatus === 'rejected' ? 'rejected' : 'pending';

      const newApp = {
        id: `native_${userId}_${Date.now()}`,
        userId: userId,
        username: user.username || user.global_name || 'Unknown',
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png` : null,
        fields: answers.length > 0 ? answers : [{ label: 'Application', response: 'Submitted via Discord' }],
        status: appStatus,
        timestamp: req.created_at ? new Date(req.created_at).getTime() : Date.now()
      };

      dbData.applications.push(newApp);
      console.log(`[POLL] Added application from ${newApp.username} (status: ${appStatus}, fields: ${answers.length})`);
    }

    saveData(dbData);

    // Also check for status changes on existing applications
    // 1. Check guild membership for pending apps (if they are in the guild, they are approved)
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (guild) {
      for (let i = 0; i < dbData.applications.length; i++) {
        const app = dbData.applications[i];
        if (app.status === 'pending') {
          const isMember = await guild.members.fetch(app.userId).catch(() => null);
          if (isMember) {
            app.status = 'approved';
            console.log(`[POLL] Found ${app.username} already in guild, marking as approved.`);
            saveData(dbData);
          }
        }
      }
    }

    // 2. Check for status changes in the returned list
    for (const req of requestList) {
      const userId = req.user?.id || req.user_id;
      if (!userId) continue;

      const reqStatus = (req.status || '').toLowerCase();
      const appStatus = reqStatus === 'approved' ? 'approved' : reqStatus === 'rejected' ? 'rejected' : 'pending';

      const dbApp = dbData.applications.find(a => a.userId === userId && a.status === 'pending');
      if (dbApp && dbApp.status !== appStatus && appStatus !== 'pending') {
        dbApp.status = appStatus;
        saveData(dbData);
        console.log(`[POLL] Updated ${userId} status to ${appStatus}`);
      }
    }

  } catch (error) {
    console.error('[POLL] Error:', error.message || error);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();

  // Poll for join requests immediately and then every 10 seconds
  setTimeout(() => {
    console.log('[POLL] Starting join request polling...');
    pollJoinRequests();
    setInterval(pollJoinRequests, 10000);
  }, 3000);

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

client.on('guildMemberAdd', async (member) => {
  console.log(`[MEMBER JOIN] ${member.user.username} joined the server.`);
  const dbData = loadData();
  
  // Find if they had a pending application
  const appIndex = dbData.applications.findIndex(a => a.userId === member.user.id && a.status === 'pending');
  if (appIndex !== -1) {
    dbData.applications[appIndex].status = 'approved';
    saveData(dbData);
    console.log(`[MEMBER JOIN] Marked application for ${member.user.username} as approved because they joined.`);
  }
});

client.on('guildMemberRemove', async (member) => {
  console.log(`[MEMBER LEAVE] ${member.user.username} left or was kicked.`);
  const dbData = loadData();
  let updated = false;
  
  dbData.applications.forEach(app => {
    if (app.userId === member.user.id && app.status !== 'left') {
      app.status = 'left';
      updated = true;
    }
  });

  if (updated) {
    saveData(dbData);
    console.log(`[MEMBER LEAVE] Updated applications for ${member.user.username} to Kicked/Left status.`);
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
