// next.config.mjs loads the repo-root .env, but `next dev` runs routes in a worker that
// doesn't inherit it (MODEL_PROVIDER stayed unset -> silent mock fallback). Load it here,
// inside the server process, so route handlers see NRP_*/ANTHROPIC_* too.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    process.loadEnvFile(`${process.cwd()}/../../.env`);
  } catch {
    // no root .env: fall through to whatever the environment already has
  }
}
