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

3. Pull the local chat model once:

   ```bash
   docker compose exec ollama ollama pull llama3.1:8b
   ```

4. Open `http://localhost:3000`.

The app container runs Prisma migrations and seeds the starter creatures on startup. Uploaded assets are stored in the `uploads-data` Docker volume, Postgres data is stored in the `postgres-data` Docker volume, and Ollama models are stored in the `ollama-data` Docker volume.

The DM Reference panel automatically imports `SRD_CC_v5.1.pdf` from the project root as the default rules source the first time a DM opens a campaign. You can also run the same import manually with the `Import SRD PDF` button. PDF extraction uses `pdftotext`, which is installed in the app container.

Useful commands:

```bash
docker compose up --build
docker compose exec ollama ollama pull llama3.1:8b
docker compose down
docker compose logs -f app
docker compose logs -f ollama
docker compose exec app npx prisma studio
```

## Railway with a local Ollama model

Railway cannot reach `localhost` on the machine running Ollama. Publish a
dedicated hostname for Ollama through Cloudflare Tunnel, protect that hostname
with Cloudflare Access, and have the Railway API authenticate with an Access
service token. Do not expose the Ollama port directly to the public internet.

1. On the machine running Ollama, create a separate tunnel hostname such as
   `llm.example.com` that forwards to `http://localhost:11434`. Keep this
   separate from the hostname that serves the web app.
2. In Cloudflare Zero Trust, create a Self-hosted Access application for that
   hostname. Add a **Service Auth** policy and create a service token for the
   Railway API. Do not add a public allow policy.
3. Add these Railway variables (as secrets where appropriate):

   ```text
   OLLAMA_BASE_URL=https://llm.example.com
   OLLAMA_MODEL=llama3.1:8b
   OLLAMA_CF_ACCESS_CLIENT_ID=<Cloudflare service-token client ID>
   OLLAMA_CF_ACCESS_CLIENT_SECRET=<Cloudflare service-token client secret>
   ```

The API sends the service-token values as `CF-Access-Client-Id` and
`CF-Access-Client-Secret` on each request. For local development, leave both
variables empty and continue using `http://localhost:11434`.

If you put a custom gateway in front of Ollama as an additional control, set
the same `OLLAMA_GATEWAY_API_KEY` secret in Railway and configure that gateway
to require it in the `X-LLM-Gateway-Key` request header. The application never
sends browser traffic directly to Ollama; prompts flow through the NestJS API.

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
4. Add the `OLLAMA_*` variables described above. Leave them unset if the app
   should run without AI generation.
5. Deploy. The container entrypoint runs `prisma migrate deploy` and seeds the
   starter data before starting the server. Railway supplies `PORT`; the app
   listens on it automatically.
6. In **Settings → Networking**, select **Generate Domain** (or attach your
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
