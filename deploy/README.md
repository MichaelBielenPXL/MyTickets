# Putting MyTickets online

Two pieces:

- **The site** (React) runs on **Vercel**, from `mytickets-frontend`.
- **The API** runs with **Docker Compose** on a server, from this folder, with Redis and RustFS (uploaded pictures).
  It listens on port **8001**; a **Cloudflare Tunnel** publishes that as the API's domain, with https.

| Environment | API | Vercel |
| --- | --- | --- |
| dev | `https://devticketsapi.michaelbielen.be` | Preview deployments |
| live | `https://myticketsapi.michaelbielen.be` | Production deployment |

The site always calls `/api` on its own address. `mytickets-frontend/middleware.ts` forwards that to the API of the
same environment. That keeps the sign-in cookie on the site's own domain: a cookie from another domain is blocked by
Safari and on iPhones, so a site and API on different domains could not keep anyone signed in.

## The API on a server

1. On the server, check out the repository and make the settings file:

   ```sh
   cp deploy/.env.dev.example deploy/.env      # the live server: deploy/.env.live.example
   openssl rand -hex 32                          # paste this as STORAGE_SECRET_KEY
   nano deploy/.env                              # fill in PUBLIC_URL (the site on Vercel) and the secret
   ```

2. Start it:

   ```sh
   docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
   ```

   Check on the server: `curl http://127.0.0.1:8001/health` answers `{"status":"ok"}`.

3. In the Cloudflare Tunnel, add a public hostname: `devticketsapi.michaelbielen.be` (live:
   `myticketsapi.michaelbielen.be`) → service `http://localhost:8001`. Then
   `https://devticketsapi.michaelbielen.be/health` answers the same.

4. Update after a `git pull`: run the same `up -d --build` again. The databases update themselves on start.

Port 8001 only listens on the server itself (`API_BIND=127.0.0.1`), so the API is only reachable through the tunnel.
Running cloudflared in a container instead? Set `API_BIND=0.0.0.0`, or add cloudflared to this compose network and
point the hostname at `http://api:8001`.

Everything that must survive a restart is in Docker volumes: `api-data` (the databases and the sign-in keys) and
`pictures` (uploaded logos and pictures). Back up those two.

The API sees each request after two proxies, Vercel and Cloudflare; `Proxy__ForwardedHops: "2"` makes the sign-in
limit count per visitor. Change it if that chain changes.

### Settings (deploy/.env)

| Setting | What it is |
| --- | --- |
| `API_DOMAIN` | The API's public address (the tunnel's hostname). For reference only. |
| `API_BIND` | Where port 8001 listens: `127.0.0.1` (only for cloudflared on the server) or `0.0.0.0`. |
| `PUBLIC_URL` | The site's address on Vercel. Card links (`/c/…`), Stripe's return pages and wallet passes point there. Card chips are locked with this address, so write cards only once it is the final one. |
| `STORAGE_SECRET_KEY` | The password of the picture storage. Keep it the same once pictures are uploaded. |
| `USE_TEST_CHECKOUT` | `true`: a test checkout where no money moves. Live: `false`, with the Stripe keys. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe, for real (or Stripe test) payments. The webhook is `https://<API_DOMAIN>/api/payments/stripe-webhook`. |

Wallet passes (Apple/Google) need their keys too, under `WalletPasses__Apple__…` and `WalletPasses__Google__…`; add
them to the `api` service's `environment` when you have them.

## The site on Vercel

1. New project from the repository, with **Root Directory** `mytickets-frontend`. Vercel reads `vercel.json` there
   (Vite, output `dist`, every page served by `index.html`).
2. Nothing else is needed: Production deployments use the live API and Preview deployments the dev API. To point an
   environment somewhere else, set `API_ORIGIN` (e.g. `https://api.mytickets.be`) for it under Settings ›
   Environment Variables.
3. Give the dev site a fixed address (e.g. a domain on a `dev` branch), so `PUBLIC_URL` on the dev server stays right.

Check after the first deployment: open the site and sign in, then reload. If sign-in does not stick, or the browser's
network tab shows requests going to the API's own domain, the forwarding is not active.
