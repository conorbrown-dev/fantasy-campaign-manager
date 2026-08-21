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

## Docker Setup For WSL

1. Enable Docker Desktop WSL integration for this distro, or install Docker Engine inside WSL.

2. Build and start the app with Postgres:

   ```bash
   docker compose up --build
   ```

3. Open `http://localhost:3000`.

The app container runs Prisma migrations and seeds the starter creatures on startup. Uploaded assets are stored in the `uploads-data` Docker volume and Postgres data is stored in the `postgres-data` Docker volume.

The SRD Rulebook automatically imports `SRD_CC_v5.1.pdf` from the project root as the default rules source the first time a DM opens a campaign. You can also run the same import manually with the `Import SRD PDF` button. The rulebook provides deterministic, searchable SRD excerpts and source citations; it does not require an AI model or external inference service. PDF extraction uses `pdftotext`, which is installed in the app container.

Useful commands:

```bash
docker compose up --build
docker compose down
docker compose logs -f app
docker compose exec app npx prisma studio
```

## Deploying the web app to Railway

The repository includes [railway.toml](railway.toml), which tells Railway to
build the existing Dockerfile and use `/api/health` for health checks. Railway
Postgres is provisioned as a separate service in the project:

1. Create a Railway project and choose **Deploy from GitHub repo**, then select
   this repository. Railway will detect `railway.toml` and build the Dockerfile.
2. Select **Add → Database → PostgreSQL** and wait for the database to finish
   provisioning.
3. Open the web service's **Variables** tab and add a reference to the
   Postgres service's `DATABASE_URL` using Railway's variable reference picker.
   Do not use a local `localhost` connection string. Also add a long random
   `JWT_SECRET`.
4. Deploy. The container entrypoint runs `prisma migrate deploy` and seeds the
   starter data before starting the server. Railway supplies `PORT`; the app
   listens on it automatically.
5. In **Settings → Networking**, select **Generate Domain** (or attach your
   own domain). Confirm that `/api/health` returns `{\"status\":\"ok\"}`.

Uploaded assets are stored under `/app/uploads`. Railway's filesystem is
ephemeral, so add a Railway Volume mounted at `/app/uploads` if uploaded maps,
images, or audio must survive redeploys. Database records persist in the
Railway PostgreSQL service.

## Route Shape

- Create a campaign from `/`
- Players use `/:CampaignName`
- Dungeon Masters use `/:CampaignName/CampaignManager`

## Next Build Targets

- Add encounter initiative tracking and HP controls
- Add map and creature image upload flows using the existing multipart asset endpoint
- Add richer character sheet sections for rolls, spell slots, proficiencies, and notes
- Add AI asset-generation adapters behind the existing `Asset` model
