# Putting MyTickets online

Everything runs from one compose file, `docker-compose.yml` at the top of the repository:

| Service | What it is | Reachable from outside |
| --- | --- | --- |
| `web` | The site, served by nginx, which also passes `/api` on to the API | yes: the site's domain |
| `api` | The .NET API on port 8001 | only through `web` |
| `redis` | Cache | no |
| `storage` | RustFS, for uploaded logos and pictures | no |

One deployment always ships the site and the API from the same commit, and both live on one address (the API under
`/api`). That keeps the sign-in cookie a first-party cookie: Safari and iPhones block cookies from another domain.

The chain in front is Cloudflare (tunnel) → Coolify's proxy → `web` → `api`. Cloudflare tells the API who the
visitor is in the `CF-Connecting-IP` header (`Proxy__ClientIpHeader`), so the sign-in limit counts per visitor.

## With Coolify

1. **Install Coolify** on the server (as root; it installs Docker if needed and runs its own proxy on ports 80/443,
   the dashboard on 8000):

   ```sh
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
   ```

   Open `http://<server>:8000` and create the admin account.

2. **Cloudflare Tunnel**: add public hostnames to the tunnel:
   - the Coolify dashboard, e.g. `coolify.michaelbielen.be` → `http://192.168.0.150:8000`
   - the dev site, e.g. `devtickets.michaelbielen.be` → `http://192.168.0.150:80`
   - later the live site, e.g. `mytickets.michaelbielen.be` → `http://192.168.0.150:80`

   Coolify's proxy picks the right app by its domain. Use `http://` in Coolify's domain fields: Cloudflare already
   does https, so Coolify must not try to get its own certificates.

3. **Connect GitHub**: Sources › GitHub App, and give it access to the MyTickets repository.

4. **The dev environment**: a project with an environment `dev`, then New Resource › your repository ›
   Build Pack **Docker Compose**, branch **`dev`**, compose file **`/docker-compose.yml`**.
   - On the **web** service, set the domain: `http://devtickets.michaelbielen.be`.
   - Environment Variables: paste `deploy/.env.dev.example` and fill in `STORAGE_SECRET_KEY`
     (`openssl rand -hex 32`). `PUBLIC_URL` is the site's address with https.
   - Turn on **Auto Deploy**: every push to `dev` deploys.

5. **The live environment** later: the same, with branch `main`, the live domain and `deploy/.env.live.example`.

Updating is then `git push`. The databases update themselves when the API starts. Data that must survive deploys is
in two volumes Coolify keeps: `api-data` (the databases and the sign-in keys) and `pictures`. Back those up
(Coolify can schedule volume backups).

## Settings

| Setting | What it is |
| --- | --- |
| `PUBLIC_URL` | The site's address, `https://…`. Card links (`/c/…`), Stripe's return pages and wallet passes point there. Card chips are locked with this address, so write cards only once it is the final one. |
| `STORAGE_SECRET_KEY` | The password of the picture storage. Keep it the same once pictures are uploaded. |
| `USE_TEST_CHECKOUT` | `true`: a test checkout where no money moves. Live: `false`, with the Stripe keys. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe, for real (or Stripe test) payments. The webhook is `https://<site>/api/payments/stripe-webhook`. |

Wallet passes (Apple/Google) need their keys too, under `WalletPasses__Apple__…` and `WalletPasses__Google__…`; add
them to the `api` service's environment when you have them.

## Without Coolify

```sh
cp deploy/.env.dev.example deploy/.env    # fill in the secret
docker compose --env-file deploy/.env up -d --build
```

Nothing is published to the server's ports then; add one on `web` (e.g. `ports: ["8001:80"]` in a
`docker-compose.override.yml`) and point the tunnel at it.
