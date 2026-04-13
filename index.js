const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  REST,
  Routes,
} = require('discord.js');

const crypto = require('crypto');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// ──────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────
const CONFIG = {
 token:            process.env.DISCORD_TOKEN,
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || '1493300483610120204',
  verifiedRoleId:   process.env.VERIFIED_ROLE_ID || '1492603414042120394',
  unverifiedRoleId: process.env.UNVERIFIED_ROLE_ID || null,  // set to null to skip
  rulesChannelId:   process.env.RULES_CHANNEL_ID || '1492606024484524062',
  ownerId:          process.env.OWNER_ID || '1483729049519132672',
  logGuildId:       process.env.LOG_GUILD_ID || '1493300482704146432',
  logChannelId:     process.env.LOG_CHANNEL_ID || '1493366421084967082',
  clientId:         process.env.CLIENT_ID || '1493300661171785849'
};
// ──────────────────────────────────────────────

// In-memory key store: key -> { usesLeft, totalUses, guildId, createdAt }
const keyStore = new Map();

// ─── Helpers ─────────────────────────────────
const isOwner = (userId) => userId === CONFIG.ownerId;

function generateKey() {
  const part = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${part()}-${part()}-${part()}`;
}

async function sendAuthLog(interaction) {
  try {
    const logGuild   = await client.guilds.fetch(CONFIG.logGuildId);
    const logChannel = await logGuild.channels.fetch(CONFIG.logChannelId);
    const logEmbed   = new EmbedBuilder()
      .setTitle('User Authenticated')
      .setColor(0x57F287)
      .addFields(
        { name: 'User',    value: `${interaction.user} (${interaction.user.tag})`, inline: true  },
        { name: 'User ID', value: `\`${interaction.user.id}\``,                    inline: true  },
        { name: 'Server',  value: `${interaction.guild.name}`,                     inline: false },
        { name: 'Time',    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,        inline: false },
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Verification Log' })
      .setTimestamp();
    await logChannel.send({ embeds: [logEmbed] });
  } catch (err) {
    console.error('Failed to send auth log:', err);
  }
}

// ─── Register Slash Commands ───────────────────
const commands = [
  {
    name: 'start',
    description: 'Display the member inviter panel',
  },
];

const rest = new REST({ version: '10' }).setToken(CONFIG.token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    
    await rest.put(
      Routes.applicationCommands(CONFIG.clientId),
      { body: commands },
    );
    
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

// ─── Ready ───────────────────────────────────
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});
// ─── guildMemberAdd ───────────────────────────
client.on('guildMemberAdd', async (member) => {
  if (CONFIG.unverifiedRoleId) {
    const role = member.guild.roles.cache.get(CONFIG.unverifiedRoleId);
    if (role) await member.roles.add(role).catch(console.error);
  }

  const welcomeChannel = member.guild.channels.cache.get(CONFIG.welcomeChannelId);
  if (!welcomeChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('Welcome to the server!')
    .setDescription(
      `Hey ${member}, welcome to **${member.guild.name}**!\n\n` +
      `To gain access please read our rules in <#${CONFIG.rulesChannelId}> ` +
      `and click Verify below.\n\n` +
      `> By verifying you agree to follow our server rules.`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setColor(0x5865F2)
    .setFooter({ text: `${member.guild.name} - Verification System` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`verify_${member.id}`)
      .setLabel('I agree - Verify me!')
      .setStyle(ButtonStyle.Success)
  );

  await welcomeChannel.send({ embeds: [embed], components: [row] });
});

// ─── Message commands ─────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  // ── !V setup ──────────────────────────────
  if (content.toLowerCase() === '!v setup') {
    if (!isOwner(message.author.id)) {
      return message.reply({ content: 'You do not have permission to use this command.' });
    }

    const embed = new EmbedBuilder()
      .setTitle('Server Verification')
      .setDescription(
        `Welcome to **${message.guild.name}**!\n\n` +
        `To gain access click Verify below.\n\n` +
        (CONFIG.rulesChannelId ? `> Read the rules in <#${CONFIG.rulesChannelId}> first.\n\n` : '') +
        `> By verifying you agree to follow our server rules.`
      )
      .setColor(0x5865F2)
      .setFooter({ text: `${message.guild.name} - Verification System` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_panel')
        .setLabel('Verify me!')
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
    return;
  }

  // ── !R generate ───────────────────────────
  if (content.toLowerCase() === '!r generate') {
    if (!isOwner(message.author.id)) {
      return message.reply({ content: 'You do not have permission to use this command.' });
    }

    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle('Key Generator')
      .setDescription(
        `Select how many times this key can be used from the dropdown.\n` +
        `Pick **Custom** to enter your own number.\n\n` +
        `> Key will be tied to **${message.guild.name}**.`
      )
      .setColor(0xEB459E)
      .setFooter({ text: 'Key Generator - Select a use limit' })
      .setTimestamp();

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`keygen_select_${message.guild.id}`)
        .setPlaceholder('Select number of uses...')
        .addOptions([
          { label: '1 use',     value: '1',         description: 'Single use key'         },
          { label: '5 uses',    value: '5',         description: 'Five use key'            },
          { label: '10 uses',   value: '10',        description: 'Ten use key'             },
          { label: '25 uses',   value: '25',        description: 'Twenty-five uses'        },
          { label: '50 uses',   value: '50',        description: 'Fifty uses'              },
          { label: 'Unlimited', value: 'unlimited', description: 'No use limit'            },
          { label: 'Custom...', value: 'custom',    description: 'Type a custom use count' },
        ])
    );

    try {
      await message.author.send({ embeds: [embed], components: [selectRow] });
    } catch {
      const fallback = await message.channel.send({
        content: `<@${message.author.id}> I could not DM you. Please enable DMs from server members and try again.`,
      });
      setTimeout(() => fallback.delete().catch(() => {}), 8000);
    }
    return;
  }
});// ─── Interaction handler ──────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── /start command ────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'start') {
    const embed = new EmbedBuilder()
      .setTitle('Member Inviter')
      .setDescription('Use your key in the drop down menu for bot to start')
      .setColor(0x00FF00) // Green color
      .setImage('https://cdn.discordapp.com/attachments/1493368630509965555/1493368630631727154/image.png?ex=69deb76a&is=69dd65ea&hm=e6c12359d77ee6f2338f42e5baa2ec55493063b8b5535a0c59f238d6624354d5&')
      .setFooter({ text: `${interaction.guild.name} - Member Inviter` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`key_input_${interaction.user.id}`)
        .setPlaceholder('INSERT KEY')
        .addOptions([
          { label: 'Enter your key', value: 'enter_key', description: 'Click to enter your verification key' }
        ])
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // ── Key input dropdown ──────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('key_input_')) {
    const userId = interaction.customId.split('_')[2];
    
    // Check if the user is the one who triggered the dropdown
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: 'This menu is not for you.', ephemeral: true });
    }

    // Show a modal for key input
    const modal = new ModalBuilder()
      .setCustomId(`key_modal_${userId}`)
      .setTitle('Enter Your Key');

    const keyInput = new TextInputBuilder()
      .setCustomId('key_value')
      .setLabel('Enter your verification key')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('XXXX-XXXX-XXXX')
      .setMinLength(11)
      .setMaxLength(14)
      .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(keyInput);
    modal.addComponents(actionRow);

    return interaction.showModal(modal);
  }

  // ── Key modal submit ────────────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('key_modal_')) {
    const userId = interaction.customId.split('_')[2];
    
    // Check if the user is the one who submitted the modal
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: 'This modal is not for you.', ephemeral: true });
    }

    const key = interaction.fields.getTextInputValue('key_value').trim().toUpperCase();
    const keyData = keyStore.get(key);

    if (!keyData) {
      // Key invalid
      const embed = new EmbedBuilder()
        .setTitle('KEY INVALID')
        .setColor(0xFF0000) // Red color
        .setDescription('The key you entered is invalid. Please check and try again.')
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (keyData.usesLeft <= 0 || keyData.usesLeft === 0) {
      // Key expired
      const embed = new EmbedBuilder()
        .setTitle('KEY EXPIRED')
        .setColor(0xFFA500) // Orange color
        .setDescription('The key you entered has expired or has been used up.')
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Key is valid, process it
    if (keyData.usesLeft !== Infinity) {
      keyData.usesLeft--;
      keyStore.set(key, keyData);
    }

    // Here you would implement the member adding functionality
    // For now, we'll just show a success message
    const totalUses = keyData.totalUses === 'Unlimited' ? 'Unlimited' : keyData.totalUses;
    const usesLeft = keyData.usesLeft === Infinity ? 'Unlimited' : keyData.usesLeft;
    const usedCount = totalUses === 'Unlimited' ? 'N/A' : totalUses - usesLeft;

    const embed = new EmbedBuilder()
      .setTitle('KEY ACCEPTED')
      .setColor(0x00FF00) // Green color
      .setDescription(`ADD MEMBERS ${usedCount}/${totalUses}`)
      .setTimestamp();
    
    // You would implement the actual member adding logic here
    // For example, if the key is for adding members to a specific role or group
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  // ── Verify buttons ────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('verify_')) {
    const isPanelButton = interaction.customId === 'verify_panel';
    const member        = interaction.guild?.members.cache.get(interaction.user.id);

    if (!member) {
      return interaction.reply({ content: 'Could not find you in this server.', ephemeral: true });
    }

    if (!isPanelButton) {
      const targetUserId = interaction.customId.split('_')[1];
      if (interaction.user.id !== targetUserId) {
        return interaction.reply({ content: 'This verification button is not for you.', ephemeral: true });
      }
    }

    const verifiedRole = interaction.guild.roles.cache.get(CONFIG.verifiedRoleId);
    if (!verifiedRole) {
      return interaction.reply({ content: 'Verified role not configured. Contact an admin.', ephemeral: true });
    }
    if (member.roles.cache.has(CONFIG.verifiedRoleId)) {
      return interaction.reply({ content: 'You are already verified!', ephemeral: true });
    }

    // Assign roles
    await member.roles.add(verifiedRole).catch(console.error);
    if (CONFIG.unverifiedRoleId) {
      await member.roles.remove(CONFIG.unverifiedRoleId).catch(console.error);
    }

    // Send auth log to the log channel
    await sendAuthLog(interaction);

    if (isPanelButton) {
      return interaction.reply({
        content: `You have been verified! Welcome to **${interaction.guild.name}**.`,
        ephemeral: true,
      });
    }

    const completedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x57F287)
      .setTitle('Verified!')
      .setDescription(`${member} has been verified and granted access to the server. Welcome!`);

    return interaction.update({ embeds: [completedEmbed], components: [] });
  }

  // ── Key gen dropdown ──────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('keygen_select_')) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: 'This menu is not for you.', ephemeral: true });
    }

    const guildId = interaction.customId.split('_')[2];
    const value   = interaction.values[0];

    if (value === 'custom') {
      const modal = new ModalBuilder()
        .setCustomId(`keygen_modal_${guildId}`)
        .setTitle('Custom Key Use Limit');

      const input = new TextInputBuilder()
        .setCustomId('custom_uses')
        .setLabel('How many times can this key be used?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 15')
        .setMinLength(1)
        .setMaxLength(6)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    return generateAndSendKey(interaction, guildId, value);
  }

  // ── Key gen modal submit ──────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('keygen_modal_')) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: 'This modal is not for you.', ephemeral: true });
    }

    const guildId  = interaction.customId.split('_')[2];
    const rawValue = interaction.fields.getTextInputValue('custom_uses').trim();
    const parsed   = parseInt(rawValue, 10);

    if (isNaN(parsed) || parsed < 1) {
      return interaction.reply({
        content: 'Invalid number. Please enter a whole number greater than 0.',
        ephemeral: true,
      });
    }

    return generateAndSendKey(interaction, guildId, String(parsed));
  }
});
// ─── Key generation helper ────────────────────
async function generateAndSendKey(interaction, guildId, usesValue) {
  const key         = generateKey();
  const isUnlimited = usesValue === 'unlimited';
  const usesLeft    = isUnlimited ? Infinity : parseInt(usesValue, 10);
  const guild       = client.guilds.cache.get(guildId);

  keyStore.set(key, {
    usesLeft,
    totalUses: isUnlimited ? 'Unlimited' : usesLeft,
    guildId,
    createdAt: new Date(),
  });

  const embed = new EmbedBuilder()
    .setTitle('Key Generated')
    .setColor(0xEB459E)
    .addFields(
      { name: 'Key',     value: `\`\`\`${key}\`\`\``,                                     inline: false },
      { name: 'Uses',    value: isUnlimited ? 'Unlimited' : `**${usesValue}**`,            inline: true  },
      { name: 'Server',  value: guild ? `**${guild.name}**` : `ID: \`${guildId}\``,        inline: true  },
      { name: 'Created', value: `<t:${Math.floor(Date.now() / 1000)}:F>`,                  inline: false },
    )
    .setFooter({ text: 'Keep this key safe - Key Generator' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Login
client.login(CONFIG.token);
