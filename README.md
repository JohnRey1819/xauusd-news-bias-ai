# XAUUSD News Bias AI

A dark, mobile-friendly macro dashboard inspired by the style of modern AI market-bias sites. It reads a Forex Factory calendar feed on the server and scores USD macro events for their usual XAUUSD directional pressure.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:10000

## Render

- Build Command: `npm install`
- Start Command: `npm start`
- Runtime: Node

The app binds to `0.0.0.0` and uses Render's `PORT` environment variable.

## Notes

This is a rule-based educational signal, not a guaranteed price prediction. Actual-vs-forecast scoring only applies after the event releases; before release, the event is shown as WAIT. The calendar feed URL can be changed with `CALENDAR_URL`.
