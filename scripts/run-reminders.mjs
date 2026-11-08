// Runs the reminders job once against a running app, the way Vercel's
// schedule does every 15 minutes. Usage:
//   npm run reminders:run                 # http://localhost:3000
//   npm run reminders:run -- http://localhost:3100
const origin = process.argv[2] ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error(
    "Set CRON_SECRET in .env.local first (openssl rand -base64 32).",
  );
  process.exit(1);
}
const response = await fetch(new URL("/api/cron/reminders", origin), {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});
console.log(response.status, await response.text());
process.exit(response.ok ? 0 : 1);
