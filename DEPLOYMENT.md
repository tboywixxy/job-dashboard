# Deployment — access-99.mastaskillz.com

## Shape

```
client --443/TLS--> nginx --> 127.0.0.1:4000 --> docker container (Next.js standalone)
```

nginx terminates TLS (Certbot-managed) and reverse-proxies to the container, which
publishes **only on loopback**. Port 4000 is never directly reachable from the internet.

| File | Role |
| --- | --- |
| `Dockerfile` | 3-stage build; runner ships `.next/standalone` + `.next/static` + `public` |
| `docker-compose.yml` | Single service, loopback port publish, `.env.local` via `env_file` |
| `deploy/nginx/access-99.mastaskillz.com.conf` | Reference copy of the vhost |
| `next.config.ts` | `output: "standalone"` — required by the Dockerfile runner stage |

## The IPv4/IPv6 gotcha (cause of a past total outage)

nginx must proxy to `127.0.0.1:4000`, **not** `localhost:4000`.

Docker publishes ports IPv4-only by default. nginx resolves `localhost` to `::1`
first on Ubuntu, so with `localhost` every request hits an address nothing is
listening on and returns **502 on every path** — including `/_next/static/*`, which
makes it look like a static-asset problem rather than a dead upstream.

This is invisible when running `npm start` on the host: bare `next start` binds
dual-stack (`[::]:PORT`), so it answers on `::1` too. Container and host binding
behaviour differ — hence "works with npm start, breaks in Docker".

Do not add `-H 0.0.0.0` to the `start` script: it forces IPv4-only and reintroduces
the same failure for host-run deploys.

## Environment

`.env.local` is **not** in the image (`.dockerignore` excludes `.env*`); compose
injects it at runtime via `env_file`. It must exist on the server next to
`docker-compose.yml`.

| Var | Consumed by |
| --- | --- |
| `MASTASKILLZ_AUTH_API_BASE_URL` | `app/api/auth/[...path]/route.ts` |
| `MASTASKILLZ_LOGIN_API_BASE_URL` | `app/api/login/route.ts` |
| `PORT` | container `next`/`server.js` bind port (must stay 4000 to match nginx) |

Both URLs are read at request time with a fallback, so a malformed value fails at
runtime rather than at boot — check them by eye after editing.

## Deploy

```bash
git pull
docker compose up -d --build
docker compose logs -f --tail 50
```

## Verify

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/          # 200
curl -sS -o /dev/null -w '%{http_code}\n' https://access-99.mastaskillz.com/  # 200
```

If the public URL 502s but `127.0.0.1:4000` is 200, the vhost is proxying to
`localhost` — see the gotcha above.
