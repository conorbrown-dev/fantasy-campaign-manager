# D&D Campaign Manager

A NestJS, Postgres, Prisma, React, and Tailwind CSS starter for running D&D 5e campaigns with separate player and Dungeon Master spaces.

## What Is Included

- Player campaign route at `/:CampaignName`
- Password-protected DM route at `/:CampaignName/CampaignManager`
- Digital character sheet storage for stats, equipment, money, rolls, and abilities
- Quest, sub-quest, loot, encounter, creature, map pin, uploaded asset, and BGM data models
- Creature search by name and preferred environment
- Socket.IO campaign rooms for synchronized BGM events
- Retro fantasy 16-bit UI styling with the requested theme families

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and update `DATABASE_URL` and `JWT_SECRET`.

3. Generate Prisma client and run migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

The Vite frontend runs at `http://localhost:5173` and proxies API requests to the NestJS server at `http://localhost:3000`.

## Route Shape

- Create a campaign from `/`
- Players use `/:CampaignName`
- Dungeon Masters use `/:CampaignName/CampaignManager`

## Next Build Targets

- Add encounter initiative tracking and HP controls
- Add map and creature image upload flows using the existing multipart asset endpoint
- Add richer character sheet sections for rolls, spell slots, proficiencies, and notes
- Add AI asset-generation adapters behind the existing `Asset` model

