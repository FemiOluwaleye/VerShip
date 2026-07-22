// Environment-aware secret resolver.
//
// This project runs from a SINGLE Replit Secrets store but serves two logical
// environments:
//   - the workspace Run  -> "stage"
//   - the published Deployment -> "prod"
//
// Replit sets REPLIT_DEPLOYMENT=1 inside a Deployment and leaves it unset in the
// workspace, so we use that as the automatic selector — no manual flag to forget.
// Secrets are namespaced with a STAGE_ / PROD_ prefix; env('FOO') returns
// PROD_FOO in the deployment and STAGE_FOO in the workspace. If the prefixed
// value is absent it falls back to an unprefixed FOO, so vars that are the same
// in both environments (or not yet split) keep working without a prefix.
//
// Force the environment explicitly with APP_ENV=stage|prod when you need to
// (e.g. testing prod secrets from the workspace).

const isProd = process.env.APP_ENV
    ? String(process.env.APP_ENV).toLowerCase() === 'prod'
    : process.env.REPLIT_DEPLOYMENT === '1';

const APP_ENV = isProd ? 'prod' : 'stage';
const PREFIX = isProd ? 'PROD_' : 'STAGE_';

// Resolve a logical env var name to its environment-specific value.
// Prefers PREFIX+name, falls back to the unprefixed name.
const env = (name) => {
    const prefixed = process.env[`${PREFIX}${name}`];
    if (prefixed !== undefined && prefixed !== '') return prefixed;
    return process.env[name];
};

console.log(
    `⚙️  Runtime environment: ${APP_ENV} (prefix "${PREFIX}", REPLIT_DEPLOYMENT=${process.env.REPLIT_DEPLOYMENT || 'unset'}, APP_ENV=${process.env.APP_ENV || 'unset'})`
);

module.exports = { env, APP_ENV, isProd, PREFIX };
