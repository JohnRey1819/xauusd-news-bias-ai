# XAU Fundamental AI

Single-file frontend + Node/Express backend for an XAUUSD fundamental dashboard.

## Files

- `public/index.html` - all frontend HTML, CSS and JavaScript in ONE file
- `server.js` - backend/API
- `package.json` - Node dependencies
- `render.yaml` - Render deployment
- `.env.example` - optional environment variables

## Local

1. Install Node.js 18+.
2. Open the project folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:10000`.

## Render

1. Create a GitHub repository.
2. Upload all files.
3. Create a Render Web Service from that repository.
4. Render will read `render.yaml`, or use:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Deploy.
6. Open the Render URL.

The frontend is served by the same Node server, so you do not need a separate frontend host.

## Data

Macro data uses the public U.S. Bureau of Labor Statistics API.
News uses GDELT.
The economic calendar endpoint is provider-ready but intentionally does not invent future forecast/actual/previous numbers. Add a calendar provider through environment variables when you need those fields live.

This project is for analysis/education, not guaranteed trading signals.
