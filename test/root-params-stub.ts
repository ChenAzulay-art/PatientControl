// Stand-in for `next/root-params` in tests, which only the Next.js compiler
// provides. Pages aren't rendered in unit tests, so there's no route locale.
// See vitest.config.mts.
export async function locale(): Promise<string | undefined> {
  return undefined;
}
