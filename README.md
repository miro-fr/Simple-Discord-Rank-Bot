# 🎖️ Simple Discord Rank Bot

Un bot **minimaliste** pour gérer l’auto-rank des membres selon leur activité **(voix & messages)** et attribuer automatiquement des rôles.

---

## 📋 Pré-requis
- **Node.js 18+** *(recommandé)*  
  - Compatible Node.js 16 avec la branche adaptée (discord.js v13)  
- Un **token Discord Bot** avec les intents activés :  
  - `Guilds`  
  - `GuildMembers`  
  - `GuildMessages`  
  - `MessageContent`  
  - `GuildVoiceStates`  

---

## ⚙️ Installation

1. Copier le fichier d’exemple :  
   ```bash
   cp .env.example .env
````

Puis ajouter `BOT_TOKEN` (et éventuellement `OWNER_ID`).

2. Installer les dépendances :

   ```bash
   npm install
   ```

3. Lancer le bot :

   ```bash
   npm start
   ```

---

## 🛠️ Notes techniques

* Le **stockage** est fait en JSON dans le dossier `data/`.
* Les rôles par défaut sont créés automatiquement lors du **join d’un serveur**.
* Le bot **stocke les IDs de rôles** pour gérer robustement les renommages/suppressions.
* Le rôle `Muted` est créé automatiquement si absent (⚠️ overrides de salons à configurer manuellement).

---

## 🎮 Commandes disponibles (slash)

* `/ranks-create` → crée les rôles par défaut dans le serveur *(nécessite Gérer les rôles)*
* `/rank-check [user]` → affiche heures de voix, messages et rôle actuel
* `/ban <user>` → bannir un membre *(Haute Perm uniquement)*
* `/kick <user>` → expulser un membre *(Perm modo + Haute Perm)*
* `/mute <user> [minutes]` → mute un membre pour une durée (limite selon rang)

---

## 🏅 Rôles créés par défaut

### 🔹 Basse Perm

* `@Perm III` → **15h voix** ou **400 messages**
* `@Perm II` → **10h voix** ou **300 messages**
* `@Perm I` → **5h voix** ou **200 messages**

### 🔸 Perm modo

* `@Perm VI` → **50h voix** ou **800 messages**
* `@Perm V` → **40h voix** ou **700 messages**
* `@Perm IV` → **30h voix** ou **600 messages**

### 🔺 Haute Perm

* `@Perm X` → **100h voix** ou **2000 messages**
* `@Perm IX` → **90h voix** ou **1500 messages**
* `@Perm VIII` → **80h voix** ou **1000 messages**
* `@Perm VII` → **60h voix** ou **900 messages**

### 🎨 Décoratif

* `@Decoratif` → **130h voix** ou **3000 messages** *(aucune permission)*

---

## 🔒 Permissions par catégorie

* **Basse Perm** → `/mute` max **120 min (2h)**
* **Perm modo** → `/mute` max **300 min (5h)** + `/kick`
* **Haute Perm** → `/mute` max **600 min (10h)** + `/kick` + `/ban`

---

## 📑 Logs & Owner

* Définir un **OWNER global** dans `.env` :

  ```env
  OWNER_ID=<votre_id>
  ```
* L’OWNER peut configurer les logs sans permissions serveur.

### Commandes logs

* `/logs-set <type> <channelId>` → configure le salon de logs (`mute`, `kick`, `ban`, `rank`, `all`)
* `/logs-show` → affiche la config actuelle

Tous les **ban/kick/mute** et **changements de rang** sont loggés dans le salon configuré.

---

## ✅ Robustesse

* Les rôles sont identifiés par **ID** et non par nom → un renommage ne casse pas le système.
* Si un rôle est supprimé, le bot le **recrée automatiquement** avec son nom par défaut et met à jour la DB.

---

## 👨‍💻 Développeur

* Développé par **sexualwhisper**
* [Profil Discord](https://discord.com/users/690749637921079366)

```
