const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client, Intents, Permissions, MessageEmbed } = require('discord.js');

// Load .env: prefer repository root, then fallback to src/.env, then default
const rootEnv = path.join(__dirname, '..', '.env');
const srcEnv = path.join(__dirname, '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(srcEnv)) {
  dotenv.config({ path: srcEnv });
} else {
  // final fallback - default behaviour (process.cwd())
  dotenv.config();
}

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_MEMBERS
  ],
  partials: [ 'CHANNEL' ]
});

const OWNER_ID = process.env.OWNER_ID || null;

const DEFAULT_RANKS = [
  // Décoratif
  { id: 'dec', name: '@decoratif', voiceHours: 130, messages: 3000, group: 'decoratif' },
  // Haute Perm (X -> VII)
  { id: 'hp1', name: '@perm X', voiceHours: 100, messages: 2000, group: 'haute' },
  { id: 'hp2', name: '@perm IX', voiceHours: 90, messages: 1500, group: 'haute' },
  { id: 'hp3', name: '@perm VIII', voiceHours: 80, messages: 1000, group: 'haute' },
  { id: 'hp4', name: '@perm VII', voiceHours: 60, messages: 900, group: 'haute' },
  // Perm modo
  { id: 'pm6', name: '@Perm VI', voiceHours: 50, messages: 800, group: 'modo' },
  { id: 'pm5', name: '@Perm V', voiceHours: 40, messages: 700, group: 'modo' },
  { id: 'pm4', name: '@Perm IV', voiceHours: 30, messages: 600, group: 'modo' },
  // Basse Perm
  { id: 'bp3', name: '@Perm III', voiceHours: 15, messages: 400, group: 'basse' },
  { id: 'bp2', name: '@Perm II', voiceHours: 10, messages: 300, group: 'basse' },
  { id: 'bp1', name: '@Perm I', voiceHours: 5, messages: 200, group: 'basse' }
];

// Simple JSON DB per guild
function loadGuildData(guildId) {
  const file = path.join(DATA_DIR, `${guildId}.json`);
  if (!fs.existsSync(file)) return { roles: {}, users: {} };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function saveGuildData(guildId, data) {
  const file = path.join(DATA_DIR, `${guildId}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function hoursFromMs(ms) { return ms / (1000 * 60 * 60); }

client.once('ready', async () => {
  console.log('Ready as', client.user.tag);

  // register commands per guild (two simple commands)
  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.commands.create({
        name: 'ranks-create',
        description: 'Créer les rôles de rank (admin only)'
      });
      await guild.commands.create({
        name: 'rank-check',
        description: 'Vérifier le rank d\'un membre',
        options: [{ name: 'user', type: 6, description: 'Membre à vérifier', required: false }]
      });
    // admin moderation commands: require reason before optional fields
    await guild.commands.create({ name: 'ban', description: 'Ban un membre', options: [{ name: 'user', type: 6, description: 'Membre', required: true }, { name: 'reason', type: 3, description: 'Raison du ban', required: true }] });
    await guild.commands.create({ name: 'kick', description: 'Kick un membre', options: [{ name: 'user', type: 6, description: 'Membre', required: true }, { name: 'reason', type: 3, description: 'Raison du kick', required: true }] });
    await guild.commands.create({ name: 'mute', description: 'Mute un membre (perm IV-V-VI)', options: [{ name: 'user', type: 6, description: 'Membre', required: true }, { name: 'reason', type: 3, description: 'Raison du mute', required: true }, { name: 'minutes', type: 4, description: 'Durée en minutes', required: false }] });
    await guild.commands.create({ name: 'logs-set', description: 'Configurer salon de logs (owner or ManageGuild)', options: [{ name: 'type', type: 3, description: 'mute/kick/ban/rank/all', required: true }, { name: 'channel', type: 3, description: 'ID du channel', required: true }] });
    await guild.commands.create({ name: 'logs-show', description: 'Afficher la configuration des salons de logs' });
  await guild.commands.create({ name: 'owner-give', description: 'Donner le rôle spécial (owner only)', options: [{ name: 'user', type: 6, description: 'Membre', required: true }] });
  await guild.commands.create({ name: 'owner-rank', description: 'Assigner un rank (donné par le rôle spécial)', options: [{ name: 'user', type: 6, description: 'Membre', required: true }, { name: 'rank', type: 3, description: 'ID du rank (hp1, bp1, ...)', required: true }] });
  await guild.commands.create({ name: 'unmute', description: 'Unmute un membre (haute perms)', options: [{ name: 'user', type: 6, description: 'Membre', required: true }, { name: 'reason', type: 3, description: 'Raison du unmute', required: true }] });
  await guild.commands.create({ name: 'owner-embed', description: 'Créer un embed des perms/ranks pour un salon (owner only)', options: [{ name: 'channel', type: 7, description: 'Channel optionnel pour poster', required: false }] });
    } catch (err) {
      console.warn('Failed to register commands for', guild.id, err?.message || err);
    }
  }

  // Ensure roles exist for each guild on startup and store IDs
  for (const guild of client.guilds.cache.values()) {
    const gdata = loadGuildData(guild.id);
    gdata.roles = gdata.roles || {};
    let changed = false;
    for (const r of DEFAULT_RANKS) {
      // if id stored and role exists, continue
      if (gdata.roles[r.id] && guild.roles.cache.has(gdata.roles[r.id])) continue;
      try {
  const role = await guild.roles.create({ name: r.name, reason: 'Ranks initial sync', mentionable: true });
        gdata.roles[r.id] = role.id;
        changed = true;
      } catch (err) {
        console.error('Failed to ensure role', r.name, err);
      }
    }
    // ensure special owner role exists (role that only OWNER can grant and that can rank members)
    gdata.special = gdata.special || {};
    if (!gdata.special.ownerRoleId || !guild.roles.cache.has(gdata.special.ownerRoleId)) {
      try {
  const specialRole = await guild.roles.create({ name: 'OwnerRole', reason: 'Special owner role for rank management', mentionable: true });
        gdata.special.ownerRoleId = specialRole.id;
        changed = true;
        // try to position it above the rank roles we just created (best-effort)
        try {
          const positions = Object.values(gdata.roles || {}).map(id => (guild.roles.cache.get(id) || {}).position || 0);
          const maxPos = positions.length ? Math.max(...positions) : 0;
          await specialRole.setPosition(maxPos + 1).catch(() => null);
        } catch (err) {
          // ignore position errors
        }
      } catch (err) {
        console.error('Failed to create special owner role', err);
      }
    }
    if (changed) saveGuildData(guild.id, gdata);
  }

  // Diagnostic: list registered slash commands per guild
  for (const guild of client.guilds.cache.values()) {
    try {
      const cmds = await guild.commands.fetch();
      console.log(`Guild ${guild.id} (${guild.name}) has ${cmds.size} registered commands:`);
      for (const c of cmds.values()) {
        console.log(` - ${c.name} (${c.id})`);
      }
    } catch (err) {
      console.warn(`Failed to fetch commands for guild ${guild.id}:`, err?.message || err);
    }
  }
});

// Create roles when the bot joins a guild
client.on('guildCreate', async (guild) => {
  console.log(`Joined guild: ${guild.name}`);
  const gdata = loadGuildData(guild.id);
  if (Object.keys(gdata.roles || {}).length > 0) return; // already setup

  const created = {};
  for (const r of DEFAULT_RANKS) {
    try {
      const role = await guild.roles.create({
        name: r.name,
        reason: 'Rank bot initial role creation'
      });
      created[r.id] = role.id;
    } catch (err) {
      console.error('Failed to create role', r.name, err);
    }
  }

  gdata.roles = created;
  gdata.users = {};
  saveGuildData(guild.id, gdata);
  console.log('Roles created and saved for', guild.id);
});

// Track messages
client.on('messageCreate', (message) => {
  if (message.author.bot || !message.guild) return;
  const gdata = loadGuildData(message.guild.id);
  gdata.users = gdata.users || {};
  const uid = message.author.id;
  gdata.users[uid] = gdata.users[uid] || { messages: 0, voiceMs: 0 };
  gdata.users[uid].messages += 1;
  saveGuildData(message.guild.id, gdata);
});

// Track voice time: store join timestamp and accumulate on leave
client.on('voiceStateUpdate', (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;
  const gdata = loadGuildData(guild.id);
  gdata.users = gdata.users || {};

  const member = newState.member || oldState.member;
  if (!member) return;
  const uid = member.id;
  gdata.users[uid] = gdata.users[uid] || { messages: 0, voiceMs: 0, voiceStart: null };

  // Joined voice
  if (!oldState.channel && newState.channel) {
    gdata.users[uid].voiceStart = Date.now();
  }

  // Left voice
  if (oldState.channel && !newState.channel) {
    const start = gdata.users[uid].voiceStart;
    if (start) {
      const delta = Date.now() - start;
      gdata.users[uid].voiceMs = (gdata.users[uid].voiceMs || 0) + delta;
      gdata.users[uid].voiceStart = null;
    }
  }

  saveGuildData(guild.id, gdata);
});

// Ranking logic: choose the highest threshold that the user meets
async function applyRankForMember(guild, member) {
  const gdata = loadGuildData(guild.id);
  const user = gdata.users && gdata.users[member.id];
  if (!user) return;

  const hours = hoursFromMs(user.voiceMs || 0);
  const messages = user.messages || 0;

  // sort ranks descending by voiceHours then messages
  const ranks = [...DEFAULT_RANKS].sort((a, b) => (b.voiceHours - a.voiceHours) || (b.messages - a.messages));
  let chosen = null;
  for (const r of ranks) {
    if (hours >= r.voiceHours || messages >= r.messages) { chosen = r; break; }
  }
  if (!chosen) return;

  const roleId = gdata.roles && gdata.roles[chosen.id];
  if (!roleId) return;

  // if stored role id no longer exists in guild (deleted), recreate role with default name and update DB
  if (!guild.roles.cache.has(roleId)) {
    try {
  const newRole = await guild.roles.create({ name: chosen.name, reason: 'Recreate missing rank role', mentionable: true });
      gdata.roles[chosen.id] = newRole.id;
      saveGuildData(guild.id, gdata);
      // update roleId var
      // eslint-disable-next-line no-unused-vars
      // assign new id for operations below
      // (we won't redeclare roleId const; instead read from gdata)
    } catch (err) {
      console.error('Failed to recreate missing role', chosen.name, err);
      return;
    }
  }
  const updatedRoleId = gdata.roles[chosen.id];

  try {
    const roleIds = Object.values(gdata.roles || {});
    const previousRoles = roleIds.filter(id => member.roles.cache.has(id));
    await member.roles.remove(previousRoles);
    await member.roles.add(updatedRoleId);
    // log role change using role mention if possible
    const roleMention = updatedRoleId ? `<@&${updatedRoleId}>` : getRoleNameResolved(guild, gdata, chosen.id);
    const logMsg = `${member.user.tag} assigned role ${roleMention} (${updatedRoleId})`;
    sendLog(guild.id, 'rank', logMsg);
  } catch (err) {
    console.error('Failed to apply rank', err);
  }
}

function interactionRoleName(gdata, key) {
  const r = DEFAULT_RANKS.find(x => x.id === key);
  return r ? r.name : null;
}

function getRoleByKey(guild, gdata, key) {
  const id = gdata.roles && gdata.roles[key];
  if (!id) return null;
  return guild.roles.cache.get(id) || null;
}

function getRoleNameResolved(guild, gdata, key) {
  const role = getRoleByKey(guild, gdata, key);
  if (role) return role.name;
  return interactionRoleName(gdata, key) || key;
}

function sendLog(guildId, type, content) {
  try {
    const gdata = loadGuildData(guildId);
    if (!gdata || !gdata.logs) return;
    const channelId = gdata.logs.all || gdata.logs[type];
    if (!channelId) return;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch) return;
    const embed = new MessageEmbed().setTitle(type.toUpperCase()).setDescription(content).setTimestamp();
    ch.send({ embeds: [embed] }).catch(() => null);
  } catch (err) {
    console.error('Failed to send log', err);
  }
}

// Moderation quota: per-guild per-moderator limited actions
function getModQuota(guildId, modId) {
  const gdata = loadGuildData(guildId);
  gdata.mods = gdata.mods || {};
  gdata.mods[modId] = gdata.mods[modId] || { used: 0, resetAt: 0 };
  return gdata.mods[modId];
}

function consumeModAction(guildId, modId, limit = 2, cooldownMs = 45 * 60 * 1000) {
  const gdata = loadGuildData(guildId);
  gdata.mods = gdata.mods || {};
  const now = Date.now();
  const q = gdata.mods[modId] || { used: 0, resetAt: 0 };
  if (q.resetAt && now >= q.resetAt) {
    q.used = 0;
    q.resetAt = 0;
  }
  if (q.used >= limit) {
    // still under cooldown
    gdata.mods[modId] = q;
    saveGuildData(guildId, gdata);
    return { ok: false, remainingMs: q.resetAt - now };
  }
  // consume
  q.used = (q.used || 0) + 1;
  if (q.used >= limit) q.resetAt = now + cooldownMs;
  gdata.mods[modId] = q;
  saveGuildData(guildId, gdata);
  return { ok: true, used: q.used, resetAt: q.resetAt };
}

// Simple periodic rank application
setInterval(async () => {
  for (const guild of client.guilds.cache.values()) {
    const gdata = loadGuildData(guild.id);
    if (!gdata || !gdata.users) continue;
    for (const uid of Object.keys(gdata.users)) {
      const member = await guild.members.fetch(uid).catch(() => null);
      if (member) await applyRankForMember(guild, member);
    }
  }
}, 1000 * 60 * 5);

// Interaction (slash command) handlers
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand && !interaction.isCommand()) return;

  if (interaction.commandName === 'ranks-create') {
    // permission check
    const me = interaction.guild.members.cache.get(interaction.user.id) || interaction.member;
  if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) {
      return interaction.reply({ content: 'Vous devez avoir la permission Gérer les rôles.', ephemeral: true });
    }

    const gdata = loadGuildData(interaction.guild.id);
    gdata.roles = gdata.roles || {};
    const created = gdata.roles;
    let createdCount = 0;
    for (const r of DEFAULT_RANKS) {
      if (created[r.id] && interaction.guild.roles.cache.has(created[r.id])) continue;
      try {
  const role = await interaction.guild.roles.create({ name: r.name, reason: 'Ranks creation via command', mentionable: true });
        created[r.id] = role.id;
        createdCount++;
      } catch (err) {
        console.error('Failed to create role', r.name, err);
      }
    }
    gdata.roles = created;
    saveGuildData(interaction.guild.id, gdata);
    return interaction.reply({ content: `Rôles créés: ${createdCount}`, ephemeral: true });
  }

  if (interaction.commandName === 'rank-check') {
    const target = interaction.options.getUser('user') || interaction.user;
    const gdata = loadGuildData(interaction.guild.id);
    const udata = gdata.users && gdata.users[target.id];
    if (!udata) return interaction.reply({ content: 'Aucune donnée pour cet utilisateur.', ephemeral: true });
    const hrs = hoursFromMs(udata.voiceMs || 0).toFixed(2);
    const msgs = udata.messages || 0;

    // find role assigned
    const roleId = Object.values(gdata.roles || {}).find(id => interaction.guild.members.cache.get(target.id)?.roles.cache.has(id));
  const role = roleId ? (interaction.guild.roles.cache.get(roleId) ? interaction.guild.roles.cache.get(roleId).toString() : 'Aucun') : 'Aucun';
  return interaction.reply({ content: `Membre: ${target.tag}\nHeures de voix: ${hrs}\nMessages: ${msgs}\nRole: ${role}`, ephemeral: true });
  }

  if (interaction.commandName === 'owner-give') {
    if (!OWNER_ID || interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Seul le owner du bot peut utiliser cette commande.', ephemeral: true });
    const target = interaction.options.getUser('user');
    if (!target) return interaction.reply({ content: 'Spécifier un membre.', ephemeral: true });
    const gdata = loadGuildData(interaction.guild.id);
    if (!gdata.special || !gdata.special.ownerRoleId) return interaction.reply({ content: 'Le rôle spécial n\'est pas configuré.', ephemeral: true });
    const role = interaction.guild.roles.cache.get(gdata.special.ownerRoleId);
    if (!role) return interaction.reply({ content: 'Rôle spécial introuvable.', ephemeral: true });
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
    await member.roles.add(role).catch(err => console.error(err));
    sendLog(interaction.guild.id, 'owner', `${interaction.user.tag} a donné le rôle spécial à ${target.tag}`);
    const e = new MessageEmbed().setTitle('Rôle spécial donné').setDescription(`${target.tag} a reçu le rôle spécial.`).setTimestamp();
    return interaction.reply({ embeds: [e], ephemeral: true });
  }

  if (interaction.commandName === 'owner-rank') {
    const target = interaction.options.getUser('user');
    const rankKey = interaction.options.getString('rank');
    if (!target || !rankKey) return interaction.reply({ content: 'Spécifier un membre et un rank.', ephemeral: true });
    const gdata = loadGuildData(interaction.guild.id);
    if (!gdata.special || !gdata.special.ownerRoleId) return interaction.reply({ content: 'Le rôle spécial n\'est pas configuré.', ephemeral: true });
    const specialRole = interaction.guild.roles.cache.get(gdata.special.ownerRoleId);
    if (!specialRole) return interaction.reply({ content: 'Rôle spécial introuvable.', ephemeral: true });
    // check caller has special role
    if (!interaction.member.roles.cache.has(specialRole.id)) return interaction.reply({ content: 'Tu n\'as pas le rôle spécial requis pour cette commande.', ephemeral: true });
    // validate rank key
    const rankDef = DEFAULT_RANKS.find(r => r.id === rankKey);
    if (!rankDef) return interaction.reply({ content: 'Rank invalide.', ephemeral: true });
    const roleId = gdata.roles && gdata.roles[rankKey];
    if (!roleId) return interaction.reply({ content: 'Role de rank non trouvé sur le serveur.', ephemeral: true });
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
    // remove other rank roles and assign
    const roleIds = Object.values(gdata.roles || {});
    const previousRoles = roleIds.filter(id => member.roles.cache.has(id));
    await member.roles.remove(previousRoles).catch(() => null);
    await member.roles.add(roleId).catch(err => console.error(err));
  const roleMention = roleId ? (interaction.guild.roles.cache.get(roleId) ? interaction.guild.roles.cache.get(roleId).toString() : rankDef.name) : rankDef.name;
  sendLog(interaction.guild.id, 'rank', `${interaction.user.tag} a assigné ${roleMention} à ${target.tag}`);
  const e = new MessageEmbed().setTitle('Rank assigné').setDescription(`${target.tag} -> ${roleMention}`).setTimestamp();
    return interaction.reply({ embeds: [e], ephemeral: true });
  }

  if (interaction.commandName === 'unmute') {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison fournie';
    if (!target) return interaction.reply({ content: 'Spécifier un membre.', ephemeral: true });
    const gdata = loadGuildData(interaction.guild.id);
    // only haute perms (hp1..hp4) or OWNER
    const hauteKeys = ['hp1','hp2','hp3','hp4'];
    const hauteIds = Object.entries(gdata.roles || {}).filter(([k,v]) => hauteKeys.includes(k)).map(([k,v]) => v);
    const hasHaute = interaction.member.roles.cache.some(r => hauteIds.includes(r.id));
    if (!(hasHaute || (OWNER_ID && interaction.user.id === OWNER_ID))) return interaction.reply({ content: 'Tu n\'as pas la permission d\'unmute.', ephemeral: true });

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });

    // remove muted role if present
    const mutedRole = interaction.guild.roles.cache.find(r => r.name === 'Muted');
    if (mutedRole && member.roles.cache.has(mutedRole.id)) {
      await member.roles.remove(mutedRole).catch(() => null);
    }

    // try to remove per-channel denies set for muted role (best-effort)
    if (mutedRole) {
      for (const ch of interaction.guild.channels.cache.values()) {
        try {
          await ch.permissionOverwrites.edit(mutedRole.id, { VIEW_CHANNEL: null, SEND_MESSAGES: null }).catch(() => null);
        } catch (err) {}
      }
    }

    // DM the user
    try {
      const dmEmbed = new MessageEmbed().setTitle(`Tu as été unmute sur ${interaction.guild.name}`).addField('Modérateur', interaction.user.tag, true).addField('Raison', reason).setTimestamp();
      await target.send({ embeds: [dmEmbed] }).catch(() => null);
    } catch (err) {}

    sendLog(interaction.guild.id, 'unmute', `${interaction.user.tag} a unmute ${target.tag} (${target.id}) — Raison: ${reason}`);
    const e = new MessageEmbed().setTitle('Unmute effectué').setDescription(`${target.tag} est unmute.`).setTimestamp();
    return interaction.reply({ embeds: [e], ephemeral: true });
  }

  if (interaction.commandName === 'owner-embed') {
    if (!OWNER_ID || interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Seul le owner peut utiliser cette commande.', ephemeral: true });
    const chOption = interaction.options.getChannel('channel');
    const gdata = loadGuildData(interaction.guild.id);
    // Build embed: list ranks with thresholds
    const embed = new MessageEmbed().setTitle(`Rôles et thresholds pour ${interaction.guild.name}`).setTimestamp();
    for (const r of DEFAULT_RANKS) {
      embed.addField(r.name, `Voice hours: ${r.voiceHours}h\nMessages: ${r.messages}`, false);
    }

    // If channel specified, append overwrites for roles
    if (chOption) {
      let text = '';
      for (const rk of Object.keys(gdata.roles || {})) {
        const roleId = gdata.roles[rk];
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) continue;
        const ow = chOption.permissionOverwrites.cache.get(roleId);
        if (!ow) continue;
        // decode allow/deny bitfields to names
        const allowFlags = [];
        const denyFlags = [];
        const perms = Permissions.FLAGS;
        for (const [k, v] of Object.entries(perms)) {
          if (ow.allow && (ow.allow & v) === v) allowFlags.push(k);
          if (ow.deny && (ow.deny & v) === v) denyFlags.push(k);
        }
  const allow = allowFlags.join(', ') || 'none';
  const deny = denyFlags.join(', ') || 'none';
  const roleMention = role.toString();
  text += `${roleMention}: allow=${allow} deny=${deny}\n`;
      }
      if (text === '') text = 'Aucun overwrite rôle détecté pour ce channel.';
      embed.addField(`Overwrites pour ${chOption.name}`, text);
    }

    if (chOption) {
      await chOption.send({ embeds: [embed] }).catch(() => null);
      return interaction.reply({ content: `Embed envoyé dans ${chOption.name}`, ephemeral: true });
    }
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.commandName === 'logs-set') {
    // only owner or ManageGuild
  const allowed = (OWNER_ID && interaction.user.id === OWNER_ID) || interaction.member.permissions.has(Permissions.FLAGS.MANAGE_GUILD);
    if (!allowed) return interaction.reply({ content: 'Tu n\'es pas autorisé à configurer les logs.', ephemeral: true });
    const type = interaction.options.getString('type');
    const channelId = interaction.options.getString('channel');
    const gdata = loadGuildData(interaction.guild.id);
    gdata.logs = gdata.logs || {};
    if (type === 'all') {
      gdata.logs = { all: channelId };
    } else {
      gdata.logs[type] = channelId;
    }
    saveGuildData(interaction.guild.id, gdata);
    return interaction.reply({ content: `Logs pour '${type}' configurés vers <#${channelId}>`, ephemeral: true });
  }

  if (interaction.commandName === 'logs-show') {
    const gdata = loadGuildData(interaction.guild.id);
    const logs = gdata.logs || {};
    let text = 'Configuration des logs:\n';
    for (const k of Object.keys(logs)) text += `${k}: <#${logs[k]}>\n`;
    if (Object.keys(logs).length === 0) text += 'Aucun salon configuré.';
    return interaction.reply({ content: text, ephemeral: true });
  }

  // moderation commands
  if (interaction.commandName === 'ban') {
  if (!interaction.options.getUser('user')) return interaction.reply({ content: 'Spécifier un membre.', ephemeral: true });
  const target = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'Aucune raison fournie';
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });

    // check decoratif role only (dec) or OWNER
    const gdata = loadGuildData(interaction.guild.id);
    const decorRoleId = (gdata.roles && gdata.roles['dec']);
    const isDecor = decorRoleId && interaction.member.roles.cache.has(decorRoleId);
    if (!(isDecor || (OWNER_ID && interaction.user.id === OWNER_ID))) return interaction.reply({ content: 'Seul le rôle décoratif ou le owner peut bannir.', ephemeral: true });

  // quota check: 5 actions per 24h
  const quota = consumeModAction(interaction.guild.id, interaction.user.id, 5, 24 * 60 * 60 * 1000);
  if (!quota.ok) {
    const waitMin = Math.ceil(quota.remainingMs / 60000);
    const embed = new MessageEmbed().setTitle('Quota atteint').setDescription(`Tu as atteint le quota de modération (2 actions). Réessaie dans ${waitMin} minutes.`).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  await member.ban({ reason: `${reason} — par ${interaction.user.tag}` }).catch(err => { console.error(err); });
  // DM the user with embed
  try {
    const dmEmbed = new MessageEmbed()
      .setTitle(`Tu as été banni de ${interaction.guild.name}`)
      .addField('Modérateur', interaction.user.tag, true)
      .addField('Raison', reason)
      .setTimestamp();
    await target.send({ embeds: [dmEmbed] }).catch(() => null);
  } catch (err) {}
  // DM OWNER with details (moderator id and target id)
  try {
    if (OWNER_ID) {
      const ownerUser = await client.users.fetch(OWNER_ID).catch(() => null);
      if (ownerUser) {
        const ownerEmbed = new MessageEmbed().setTitle('Ban action').addField('Modérateur', `${interaction.user.tag} (${interaction.user.id})`).addField('Cible', `${target.tag} (${target.id})`).addField('Raison', reason).setTimestamp();
        await ownerUser.send({ embeds: [ownerEmbed] }).catch(() => null);
      }
    }
  } catch (err) {}
  sendLog(interaction.guild.id, 'ban', `${interaction.user.tag} a banni ${target.tag} (${target.id}) — Raison: ${reason}`);
  const replyEmbed = new MessageEmbed().setTitle('Ban effectué').setDescription(`${target.tag} banni.`).addField('Raison', reason).setTimestamp();
  return interaction.reply({ embeds: [replyEmbed], ephemeral: true });
  }

  if (interaction.commandName === 'kick') {
  if (!interaction.options.getUser('user')) return interaction.reply({ content: 'Spécifier un membre.', ephemeral: true });
  const target = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'Aucune raison fournie';
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });

    // allowed for modo (pm4..pm6) and haute (hp1..hp4) and decoratif
    const gdata = loadGuildData(interaction.guild.id);
    const allowedRoleKeys = ['pm4','pm5','pm6','hp1','hp2','hp3','hp4','dec'];
    const allowed = Object.entries(gdata.roles || {}).filter(([k,v]) => allowedRoleKeys.includes(k)).map(([k,v]) => v);
    const has = interaction.member.roles.cache.some(r => allowed.includes(r.id));
  if (!has && !interaction.member.permissions.has(Permissions.FLAGS.KICK_MEMBERS)) return interaction.reply({ content: 'Tu n\'as pas la permission de kick.', ephemeral: true });

  // quota check: 5 actions per 24h
  const quota = consumeModAction(interaction.guild.id, interaction.user.id, 5, 24 * 60 * 60 * 1000);
  if (!quota.ok) {
    const waitMin = Math.ceil(quota.remainingMs / 60000);
    const embed = new MessageEmbed().setTitle('Quota atteint').setDescription(`Tu as atteint le quota de modération (2 actions). Réessaie dans ${waitMin} minutes.`).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  await member.kick(`${reason} — par ${interaction.user.tag}`).catch(err => { console.error(err); });
  try {
    const dmEmbed = new MessageEmbed()
      .setTitle(`Tu as été kick de ${interaction.guild.name}`)
      .addField('Modérateur', interaction.user.tag, true)
      .addField('Raison', reason)
      .setTimestamp();
    await target.send({ embeds: [dmEmbed] }).catch(() => null);
  } catch (err) {}
  // DM OWNER with details (moderator id and target id)
  try {
    if (OWNER_ID) {
      const ownerUser = await client.users.fetch(OWNER_ID).catch(() => null);
      if (ownerUser) {
        const ownerEmbed = new MessageEmbed().setTitle('Kick action').addField('Modérateur', `${interaction.user.tag} (${interaction.user.id})`).addField('Cible', `${target.tag} (${target.id})`).addField('Raison', reason).setTimestamp();
        await ownerUser.send({ embeds: [ownerEmbed] }).catch(() => null);
      }
    }
  } catch (err) {}
  sendLog(interaction.guild.id, 'kick', `${interaction.user.tag} a kick ${target.tag} (${target.id}) — Raison: ${reason}`);
  const replyEmbed = new MessageEmbed().setTitle('Kick effectué').setDescription(`${target.tag} kické.`).addField('Raison', reason).setTimestamp();
  return interaction.reply({ embeds: [replyEmbed], ephemeral: true });
  }

  if (interaction.commandName === 'mute') {
    if (!interaction.options.getUser('user')) return interaction.reply({ content: 'Spécifier un membre.', ephemeral: true });
    const target = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes') || 10;
    const reason = interaction.options.getString('reason') || 'Aucune raison fournie';
  // Defer reply early to avoid interaction timeout during long operations
  await interaction.deferReply({ ephemeral: true }).catch(() => null);
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.editReply({ content: 'Membre introuvable.', ephemeral: true }).catch(() => null);

    const gdata = loadGuildData(interaction.guild.id);

    // Determine caller group by roles stored in gdata
    const callerRoleKeys = Object.entries(gdata.roles || {}).filter(([k,v]) => interaction.member.roles.cache.has(v)).map(([k,v]) => k);
    let callerGroup = null;
    if (callerRoleKeys.some(k => ['hp1','hp2','hp3','hp4'].includes(k))) callerGroup = 'haute';
    else if (callerRoleKeys.some(k => ['pm4','pm5','pm6'].includes(k))) callerGroup = 'modo';
    else if (callerRoleKeys.some(k => ['bp1','bp2','bp3'].includes(k))) callerGroup = 'basse';

    // Permission fallback
  if (!callerGroup && !interaction.member.permissions.has(Permissions.FLAGS.MODERATE_MEMBERS)) return interaction.reply({ content: 'Tu n\'as pas la permission de mute.', ephemeral: true });

    // caps in minutes: basse=120, modo=300, haute=600
    const caps = { basse: 120, modo: 300, haute: 600 };
    const cap = callerGroup ? caps[callerGroup] : 0;
    const minutesAllowed = cap ? Math.min(minutes, cap) : 0;
    if (!cap) return interaction.reply({ content: 'Ton rôle ne permet pas de mute.', ephemeral: true });

    // create or get a Muted role
    let mutedRole = interaction.guild.roles.cache.find(r => r.name === 'Muted');
    if (!mutedRole) {
      mutedRole = await interaction.guild.roles.create({ name: 'Muted', reason: 'Role for muting by rank bot' });
    }

    // create or get a Prison channel visible to muted role but read-only
    let prison = interaction.guild.channels.cache.find(c => c.name === 'prison' || c.name === 'Prison');
    if (!prison) {
      try {
        prison = await interaction.guild.channels.create('Prison', {
          type: 'GUILD_TEXT',
          reason: 'Channel for muted users',
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone.id, deny: ['VIEW_CHANNEL'] },
            { id: mutedRole.id, allow: ['VIEW_CHANNEL'], deny: ['SEND_MESSAGES'] }
          ]
        });
      } catch (err) {
        console.error('Failed to create Prison channel', err);
      }
    } else {
      // ensure overwrites include mutedRole restrictions
      try {
        await prison.permissionOverwrites.edit(mutedRole.id, { VIEW_CHANNEL: true, SEND_MESSAGES: false });
        await prison.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { VIEW_CHANNEL: false });
      } catch (err) {
        console.error('Failed to update prison overwrites', err);
      }
    }

    // apply restricted view: ensure mutedRole cannot view other channels and can only view Prison
    for (const ch of interaction.guild.channels.cache.values()) {
      try {
        if (ch.id === (prison && prison.id)) continue; // skip prison
        // set deny VIEW_CHANNEL for muted role on all other channels
        await ch.permissionOverwrites.edit(mutedRole.id, { VIEW_CHANNEL: false }).catch(() => null);
      } catch (err) {
        // ignore per-channel permission errors
      }
    }

  // quota check: mute limit 4 per 45 minutes
  const quota = consumeModAction(interaction.guild.id, interaction.user.id, 4, 45 * 60 * 1000);
    if (!quota.ok) {
      const waitMin = Math.ceil(quota.remainingMs / 60000);
      const embed = new MessageEmbed().setTitle('Quota atteint').setDescription(`Tu as atteint le quota de modération (2 actions). Réessaie dans ${waitMin} minutes.`).setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }


    // DM the user with reason and duration
    try {
      const dmEmbed = new MessageEmbed()
        .setTitle(`Tu as été mute sur ${interaction.guild.name}`)
        .addField('Modérateur', interaction.user.tag, true)
        .addField('Durée (min)', String(minutesAllowed), true)
        .addField('Raison', reason)
        .setTimestamp();
      await target.send({ embeds: [dmEmbed] });
    } catch (err) {
      // user may have DMs closed
    }

    // save log with reason
    sendLog(interaction.guild.id, 'mute', `${interaction.user.tag} a muted ${target.tag} (${target.id}) pour ${minutesAllowed} minutes. Raison: ${reason}`);

  // assign muted role
  await member.roles.add(mutedRole).catch(err => console.error(err));

  // schedule unmute
  setTimeout(async () => {
      try {
        await member.roles.remove(mutedRole).catch(() => null);
        // restore prison and other perms? we leave channel overwrites as-is; optionally remove per-channel deny
        sendLog(interaction.guild.id, 'mute', `${target.tag} (${target.id}) a été unmute automatiquement après ${minutesAllowed} minutes.`);
      } catch (err) {
        console.error('Failed to unmute', err);
      }
    }, minutesAllowed * 60 * 1000);

  // Edit deferred reply
  return interaction.editReply({ content: `${target.tag} muted pour ${minutesAllowed} minutes.` }).catch(() => null);
  }
});

// Login
if (!process.env.BOT_TOKEN) {
  console.error('Please set BOT_TOKEN in .env');
  process.exit(1);
}
client.login(process.env.BOT_TOKEN);
