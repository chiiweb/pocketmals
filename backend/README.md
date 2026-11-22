# Pocketmals MongoDB API

This folder is a small Node.js API for reading Pocketmals species records from MongoDB Atlas. The browser must talk to this API; it must never connect directly to MongoDB or contain the database password.

## 1. Create your database in MongoDB Atlas

1. Create a MongoDB Atlas account and a free shared cluster.
2. In **Database Access**, create a database user with a password. Keep it separate from your Atlas website login.
3. In **Network Access**, allow the IP address of the backend host. For a beginner test from your own computer, you can add your current IP. Avoid leaving broad access open longer than necessary.
4. Open the cluster's **Connect** button, choose **Drivers**, select **Node.js**, and copy the `mongodb+srv://...` URI.
5. Replace the username/password placeholders. Add the database name `pocketmals` after the hostname if it is not already there.

The URI belongs in the backend's `.env` file locally, or the backend host's private Environment Variables panel after deployment. It does NOT belong in `main.js`, `index.html`, a public GitHub file, or MongoDB itself.

## 2. Run the API on your computer

From the repository folder:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Open `backend/.env` and replace the example `MONGODB_URI` with the real Atlas URI. Then run:

```powershell
npm run seed
npm start
```

The API should start at `http://localhost:3000`. Open `http://localhost:3000/api/health` to confirm it can reach MongoDB. The species list is at `http://localhost:3000/api/pocketmals`.

## 3. Deploy the backend so GitHub Pages can reach it

GitHub Pages only hosts static files. Deploy this folder as a separate Node web service (for example, on Render):

- Repository: `chiiweb/pocketmals`
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

Add these private environment variables to the service:

- `MONGODB_URI`: your full Atlas URI
- `DB_NAME`: `pocketmals`
- `CLIENT_ORIGIN`: `https://chiiweb.github.io`

Allow the backend host's outbound IP in Atlas Network Access if that host provides fixed IPs. If it does not, follow that host's current MongoDB Atlas networking guidance.

After deployment the service gives you an API base URL, for example `https://your-pocketmals-api.example.com`. That is the URL the website uses for API requests. It is different from the MongoDB connection string.

## Collections and data

- Database: `pocketmals`
- Collection: `pocketmals` — 65 species, stats, abilities, moves and Pokédex descriptions.
- Seed file: `pocketmals.seed.json`

The server currently exposes read-only species endpoints. The current game still runs from its built-in `data.js`; the MongoDB API is prepared and seeded, but player cloud saves and live in-game species fetching are not enabled yet. Those require a separate frontend integration and, for player accounts, authentication.

## Safety

Never share your MongoDB password or full connection string in chat or commit them to GitHub. If a connection string is ever published, rotate that database user's password in Atlas immediately.
