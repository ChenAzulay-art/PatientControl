import { initBotId } from "botid/client/core";

/**
 * Vercel BotID: an invisible check on the public booking form, so bots
 * can't flood a clinic's calendar, and on "Try it as a guest". The server
 * side is checkBotId() in app/[locale]/book/[slug]/actions.ts and
 * app/[locale]/(auth)/guest/actions.ts. Outside Vercel it always passes.
 */
initBotId({
  protect: [
    { path: "/*/book/*", method: "POST" },
    // "Try it as a guest" on the home and login pages.
    { path: "/he", method: "POST" },
    { path: "/en", method: "POST" },
    { path: "/*/login", method: "POST" },
  ],
});
