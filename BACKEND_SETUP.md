# Supabase backend setup

The app now connects to `https://vhhpqqsgkljxamfjvkvi.supabase.co` using the publishable key in `index.html` (`LB_URL` and `LB_KEY`). Multiplayer and the other online features share this configuration. A publishable key belongs in the browser; do not replace it with a secret or service-role key.

## Verified on October 18, 2026

- Two independent clients successfully joined a temporary Realtime room and exchanged broadcast messages through this project (`node test-relay.cjs`). Multiplayer does not need database tables.
- Read-only probes confirmed that `public.lb_all`, `public.lb_entries`, and `public.get_config` are missing. Leaderboards and remote configuration are not migrated yet.
- Leaderboard credentials stored by the previous project are kept separate from this project's login. Local game progress is unchanged.

## Remaining database setup

The repository does not include the original database migrations. Obtain the original schema/functions from the creator or implement compatible replacements before enabling these features. Changing the URL alone does not copy database records or functions.

The client expects:

| Feature | Database/API requirements |
| --- | --- |
| Leaderboard reads | `lb_all`, `lb_entries` |
| Leaderboard registration and updates | `join_leaderboard`, `rename_player`, `leave_leaderboard`, `submit_entry`, `remove_entry` RPCs |
| Personal rank | `lb_me`, `lb_rank` RPCs |
| Remote configuration and announcements | `get_config` RPC |
| Optional analytics | `log_events`, `heartbeat` RPCs and `geo-ping` Edge Function |
| Optional push subscriptions | `save_push_sub` RPC, plus server-side push delivery setup |

Exact request arguments and response consumption are in `index.html`, near `lbRpc` and the corresponding function names. Database permissions and credential validation must be implemented alongside those functions; exposing writable tables to anonymous clients is not a substitute.

Run `node check-backend.cjs` for read-only checks of the leaderboard views/tables and configuration RPC. It prints HTTP status and API errors, and does not create schema or records.

## Publish the changed app

Run `node build.cjs`, then deploy the resulting `dist/` directory through your website host. This backend change does not transfer ownership of the website hosting account or publish a new website deployment. Both players must load the updated build to use the same backend. The service-worker cache version has been bumped to refresh installed copies after deployment.

Match simulation still runs in the host player's browser; Supabase relays messages. Moving the relay project does not turn the game into a dedicated-server simulation.
