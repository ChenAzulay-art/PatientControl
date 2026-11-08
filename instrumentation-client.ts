import { initBotId } from "botid/client/core";

/**
 * Vercel BotID: an invisible check on the public booking form, so bots
 * can't flood a clinic's calendar. The server side is checkBotId() in
 * app/[locale]/book/[slug]/actions.ts. Outside Vercel it always passes.
 */
initBotId({
  protect: [{ path: "/*/book/*", method: "POST" }],
});
