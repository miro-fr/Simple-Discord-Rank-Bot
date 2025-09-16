# 🎖️ Simple Discord Rank Bot

Un bot **minimaliste** qui attribue automatiquement des rôles selon l’activité **voix** et **messages** des membres, avec commandes simples et logs optionnels.

---

## 📋 Pré-requis
- **Node.js 18+** *(recommandé)*  
  Compatible **Node.js 16** via une branche/pack adaptée (discord.js v13).
- Un **token Discord Bot** avec les intents activés :
  - `Guilds`
  - `GuildMembers`
  - `GuildMessages`
  - `MessageContent`
  - `GuildVoiceStates`

---

## ⚙️ Installation

1. Copier le fichier d’exemple puis renseigner les variables :

    ```bash
    cp .env.example .env
    # Ouvrez .env et ajoutez au minimum :
    # BOT_TOKEN=<votre_token>
    # (optionnel) OWNER_ID=<votre_id>
    ```

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
- Le **stockage** est effectué en JSON dans `data/`.
- Les **rôles par défaut** sont créés automatiquement à l’arrivée du bot sur un serveur.
- Les **IDs de rôles** sont stockés par serveur dans `data/<guildId>.json` → robuste aux renommages.
- Le rôle **Muted** est créé si absent (⚠️ pensez à configurer manuellement les overrides de salons).

---

## 🎮 Commandes disponibles (slash)
- `/ranks-create` : crée les rôles par défaut *(nécessite Gérer les rôles)*.
- `/rank-check [user]` : affiche heures en vocal, nombre de messages et rôle actuel.
- `/ban <user>` : bannit un membre *(Haute Perm)*.
- `/kick <user>` : expulse un membre *(Perm modo + Haute Perm)*.
- `/mute <user> [minutes]` : mute temporisé *(limite selon rang)*.

---

## 🏅 Rôles créés par défaut

### 🔹 Basse Perm
- `@Perm III` → **15h** vocal **ou** **400** messages  
- `@Perm II` → **10h** vocal **ou** **300** messages  
- `@Perm I`  → **5h** vocal **ou** **200** messages  

### 🔸 Perm modo
- `@Perm VI` → **50h** vocal **ou** **800** messages  
- `@Perm V`  → **40h** vocal **ou** **700** messages  
- `@Perm IV` → **30h** vocal **ou** **600** messages  

### 🔺 Haute Perm
- `@Perm X`   → **100h** vocal **ou** **2000** messages  
- `@Perm IX`  → **90h**  vocal **ou** **1500** messages  
- `@Perm VIII`→ **80h**  vocal **ou** **1000** messages  
- `@Perm VII` → **60h**  vocal **ou** **900** messages  

### 🎨 Décoratif
- `@Decoratif` → **130h** vocal **ou** **3000** messages *(aucune permission)*

---

## 🔒 Caps & permissions
- **Basse Perm** : `/mute` ≤ **120 min** (2h)
- **Perm modo** : `/mute` ≤ **300 min** (5h) + `/kick`
- **Haute Perm** : `/mute` ≤ **600 min** (10h) + `/kick` + `/ban`

---

## 📑 Logs & Owner
- Définissez un **OWNER global** dans `.env` :

    ```env
    OWNER_ID=<votre_id>
    ```

- L’OWNER peut gérer la configuration des logs même sans permissions serveur.

### Commandes de logs
- `/logs-set <type> <channelId>` : configure le salon pour `mute|kick|ban|rank|all`
- `/logs-show` : affiche la configuration actuelle

Toutes les actions **ban / kick / mute** et les **changements de rang** sont envoyés dans le salon configuré (ou `all`).

---

## ✅ Robustesse aux renommages/suppressions
- Les rôles sont identifiés par **ID** → renommer un rôle ne casse pas le système.
- Si un rôle stocké est **supprimé**, le bot le **recrée** avec le nom par défaut et met la base à jour.

---

## 🧩 Roadmap (idées)
- Config des seuils via commandes
- Export CSV des stats
- Panneau de configuration par slash

---

## 👨‍💻 Développeur

* Développé par **sexualwhisper**
* [Profil Discord](https://discord.com/users/690749637921079366)

---
