# Raspberry Pi + Docker + Node.js — Always-On API Server for a Mobile App

A step-by-step walkthrough for turning a Raspberry Pi into a hardened, always-on Node.js API server, reachable from your mobile app on Wi-Fi **and** on cellular, without exposing your home network to the public internet directly.

---

## Table of contents

1. [Architecture overview & threat model](#1-architecture-overview--threat-model)
2. [Hardware & prerequisites](#2-hardware--prerequisites)
3. [Flash and harden the OS](#3-flash-and-harden-the-os)
4. [First-boot security](#4-first-boot-security)
5. [Static LAN address](#5-static-lan-address)
6. [Install Docker & Compose](#6-install-docker--compose)
7. [The Node.js app & its container](#7-the-nodejs-app--its-container)
8. [Pulling your code onto the Pi from a separate branch](#8-pulling-your-code-onto-the-pi-from-a-separate-branch)
9. [Reverse proxy + automatic HTTPS (Caddy)](#9-reverse-proxy--automatic-https-caddy)
10. [Public access — the safe options](#10-public-access--the-safe-options)
11. [Authentication for the mobile client](#11-authentication-for-the-mobile-client)
12. [Always-on: power, watchdogs, auto-restart](#12-always-on-power-watchdogs-auto-restart)
13. [Backups & updates](#13-backups--updates)
14. [Testing matrix (LAN, cellular, failure modes)](#14-testing-matrix-lan-cellular-failure-modes)
15. [Troubleshooting](#15-troubleshooting)
16. [Appendix: file layout reference](#16-appendix-file-layout-reference)

> **Note on "Docker Desktop":** Docker Desktop is a *macOS / Windows / Linux-desktop* product and **does not run on Raspberry Pi OS**. On the Pi you install **Docker Engine + Docker Compose** directly. You can still use Docker Desktop on your laptop to build and push images to the Pi if you like — that workflow is covered in §7.

---

## 1. Architecture overview & threat model

### What we're building

```
+----------------+        +-----------------+        +---------------------+
|  Mobile app    |  TLS   |  Public edge    |  TLS   |  Raspberry Pi       |
|  (Wi-Fi / 4G)  +------->+  (Cloudflare /  +------->+  Caddy (reverse     |
|                |        |   Tailscale /   |        |  proxy, HTTPS) -->  |
|                |        |   port-forward) |        |  Node.js container  |
+----------------+        +-----------------+        +---------------------+
                                                          (Docker network)
```

Three independent layers do the security work:

| Layer | Job |
|---|---|
| **Edge** (Cloudflare Tunnel, Tailscale, or a tightly-scoped port forward) | Decide *whether* the public internet can reach the Pi at all, and on which port. |
| **Reverse proxy** (Caddy on the Pi) | Terminate TLS, enforce HTTPS, rate-limit, add security headers, hide the Node app. |
| **App auth** (JWT / API key in your Node app) | Decide *who* can call which endpoint. |

### What we're explicitly defending against

- A bot scanning the entire IPv4 space and finding your home IP.
- A leaked image of your phone exposing API credentials.
- Your roommate / guest Wi-Fi reaching the Pi.
- The Pi itself being compromised and used as a foothold into the rest of the LAN.

### Key security principles used throughout

1. **Default deny**: nothing is exposed unless explicitly opened.
2. **Least privilege**: containers run as non-root, the Pi user is not `pi/raspberry`, SSH is key-only.
3. **Network segmentation**: the Pi sits on a guest/IoT VLAN if your router supports it.
4. **No raw port 22/80/3000 open to the internet**, ever.
5. **TLS everywhere**, even on LAN.

---

## 2. Hardware & prerequisites

### Recommended hardware

- Raspberry Pi 4 (4 GB or 8 GB) or Pi 5. Pi Zero 2 W works for very light traffic but has limited RAM for Docker.
- **Official 5V/3A USB-C power supply** (under-volting silently corrupts SD cards).
- **A-grade microSD ≥ 32 GB**, *or* an SSD over USB 3.0 (strongly recommended for 24/7 use — SD cards die from write-amplification within months as a busy server).
- Wired Ethernet to the router (Wi-Fi works but adds a failure mode).
- A small UPS or battery HAT if you care about power-cut resilience.

### On your laptop

- [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
- An SSH client (built-in on macOS/Linux; OpenSSH or Windows Terminal on Windows).
- A domain you control (optional but strongly recommended — costs ~$10/yr; required for free TLS certs).

### Decide up front

- A **hostname**, e.g. `pi-api`.
- A **non-default username**, e.g. `apiadmin` (do **not** use `pi`).
- A **domain/subdomain** for the API, e.g. `api.example.com`.

---

## 3. Flash and harden the OS

1. Insert the SD card / SSD into your laptop.
2. Open **Raspberry Pi Imager**.
3. Choose **Raspberry Pi OS Lite (64-bit)** — no desktop, smaller attack surface.
4. Click the gear icon (⚙️) and pre-configure:
   - Hostname: `pi-api`
   - Username: `apiadmin` + a strong password (≥ 20 chars, generated).
   - **Enable SSH → Use public-key authentication only.** Paste your laptop's `~/.ssh/id_ed25519.pub` (generate one with `ssh-keygen -t ed25519` if you don't have it).
   - Configure Wi-Fi only as a fallback; prefer Ethernet.
   - Set locale / timezone.
5. Write the image, eject, plug into the Pi, power on.

> **Why no desktop?** Lite has no browser, no GUI auto-login, no VNC daemon listening — every service you don't install can't be exploited.

---

## 4. First-boot security

Find the Pi's IP from your router's DHCP leases page, then:

```bash
ssh apiadmin@<pi-ip>
```

### 4.1 Update everything

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt autoremove -y
sudo reboot
```

### 4.2 Lock down SSH

Edit `/etc/ssh/sshd_config.d/99-hardening.conf`:

```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 20
AllowUsers apiadmin
```

Reload: `sudo systemctl reload ssh`. **Test from a second terminal before closing the first one** — if you lock yourself out, you'll need a keyboard + monitor on the Pi.

### 4.3 Enable the firewall (default deny)

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp   # SSH from LAN only
sudo ufw enable
sudo ufw status verbose
```

We will **not** open ports 80/443 in UFW yet — they will only be opened (a) for Docker via Caddy, or (b) not at all if you use a tunnel (§9).

### 4.4 Install fail2ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

It'll auto-ban IPs that fail SSH auth repeatedly. Belt-and-braces given key-only auth, but cheap.

### 4.5 Unattended security upgrades

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # answer "Yes"
```

---

## 5. Static LAN address

The Pi must always have the same internal IP so the router can find it.

**Easiest & best**: in your router's admin page, find the Pi's MAC address under DHCP clients and create a **DHCP reservation** to e.g. `192.168.1.50`. This keeps DHCP authoritative and avoids drift.

Alternative (Pi-side static): edit `/etc/dhcpcd.conf` (Bookworm uses NetworkManager — `nmcli con mod ...`). Reservation is preferable.

---

## 6. Install Docker & Compose

Use Docker's official convenience script — the version in `apt` is often months old.

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker apiadmin
sudo systemctl enable --now docker
# Log out & back in for group membership to apply
exit
```

Re-SSH and verify:

```bash
docker run --rm hello-world
docker compose version
```

> **Security note:** adding a user to the `docker` group is effectively root-equivalent (anyone who can run `docker` can mount `/` read-write into a container). Keep `apiadmin`'s password and key secret accordingly.

### Pin Docker daemon settings

`/etc/docker/daemon.json`:

```json
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true
}
```

Restart: `sudo systemctl restart docker`. The log limits prevent a chatty container from filling the disk.

---

## 7. The Node.js app & its container

Create a working directory:

```bash
mkdir -p ~/stack/api && cd ~/stack/api
```

### 7.1 A minimal Express app (`app/server.js`)

```js
import express from 'express';
const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/hello', (req, res) => {
  res.json({ msg: 'hello from the pi', at: new Date().toISOString() });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`listening on ${port}`));
```

`app/package.json`:

```json
{
  "name": "pi-api",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.19.2" }
}
```

### 7.2 Multi-stage Dockerfile (`app/Dockerfile`)

```dockerfile
# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# ---- runtime ----
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
# Run as the built-in non-root 'node' user
USER node
COPY --from=build --chown=node:node /app /app
EXPOSE 3000
CMD ["node", "server.js"]
```

`.dockerignore`:

```
node_modules
npm-debug.log
.git
.env
```

### 7.3 Build location: on the Pi vs on your laptop

- **Simplest**: `docker compose build` on the Pi. Slow but no registry needed.
- **Faster iteration**: build on your laptop with `docker buildx build --platform linux/arm64 -t yourname/pi-api:latest --push .`, then `docker compose pull` on the Pi. This is where Docker Desktop on the laptop earns its keep — make sure the platform is `linux/arm64` for Pi 4/5 64-bit.

> The example code in §7.1–7.2 is illustrative. The next section assumes you already keep your real Node + Docker code on a feature branch in a Git repo and just want to deploy that branch onto the Pi.

---

## 8. Pulling your code onto the Pi from a separate branch

You already have your Node app, Dockerfile and `docker-compose.yml` on a dedicated branch (e.g. `pi-server`) of a private Git repo. The cleanest deployment is: clone that repo on the Pi, check out the branch, and `docker compose up -d`. Updates then become `git pull && docker compose up -d --build`.

### 8.1 Recommended repo layout

Either:

- A **dedicated server repo** (e.g. `myapp-server`) whose `main` branch is what runs on the Pi — simplest.
- Or a **monorepo** with a long-lived branch like `pi-server` that contains the server code and `docker-compose.yml`. Use this if the server code lives alongside the mobile app code.

Whichever you choose, the branch should contain — at minimum — `docker-compose.yml`, the `Caddyfile`, and the `api/app/` directory. Keep `.env` **out** of git; it's machine-local.

### 8.2 Give the Pi read-only access to the repo

Generate a deploy key on the Pi (no passphrase, since it'll be used by automation):

```bash
ssh-keygen -t ed25519 -C "pi-api deploy key" -f ~/.ssh/id_ed25519_deploy -N ""
cat ~/.ssh/id_ed25519_deploy.pub
```

Add the public key to your repo as a **read-only deploy key**:

- **GitHub**: Repo → Settings → Deploy keys → Add deploy key → paste, leave "Allow write access" unchecked.
- **GitLab**: Repo → Settings → Repository → Deploy keys.
- **Bitbucket**: Repo → Repository settings → Access keys.

Tell SSH on the Pi to use that key for the host:

`~/.ssh/config`:

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_deploy
  IdentitiesOnly yes
```

`chmod 600 ~/.ssh/config ~/.ssh/id_ed25519_deploy`. Test:

```bash
ssh -T git@github.com   # should greet you by username
```

> **Why a deploy key over a personal access token?** It's scoped to one repo, read-only, and tied to the Pi. If the Pi is compromised, you revoke that one key and nothing else is touched.

### 8.3 Clone the branch and lay it out under `~/stack`

We'll keep the working copy at `~/stack` so paths in the rest of this guide stay accurate.

```bash
cd ~
# replace with your repo + branch
git clone --branch pi-server --single-branch git@github.com:you/myapp-server.git stack
cd ~/stack
git status                # confirm branch
ls                        # expect docker-compose.yml, Caddyfile, api/, ...
```

Create the local-only files that should *not* be in git:

```bash
cp .env.example .env      # if you ship an example
chmod 600 .env
```

### 8.4 First deploy

```bash
cd ~/stack
docker compose pull       # pulls base images
docker compose build      # builds your api image from your Dockerfile
docker compose up -d
docker compose ps
docker compose logs -f api
```

### 8.5 Updating: pull-and-redeploy

Every code update on the branch is deployed with two commands:

```bash
cd ~/stack
git pull --ff-only origin pi-server
docker compose up -d --build
docker image prune -f
```

Wrap it in a script so you don't forget the prune — `~/stack/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
git fetch --prune origin
git checkout pi-server
git pull --ff-only origin pi-server
docker compose pull
docker compose up -d --build --remove-orphans
docker image prune -f
docker compose ps
```

`chmod +x ~/stack/deploy.sh`. Run with `./deploy.sh` or trigger it remotely via SSH from your laptop:

```bash
ssh apiadmin@pi-api '~/stack/deploy.sh'
```

### 8.6 Optional: auto-deploy on push (no inbound ports needed)

Two safe patterns, in order of preference:

1. **GitHub Actions → SSH over Tailscale / Cloudflare Tunnel.**
   The runner connects out to the Pi (only reachable on your tailnet or via a Cloudflare Access-protected SSH endpoint) and runs `~/stack/deploy.sh`. No public SSH on the Pi.
2. **Polling on the Pi.** A `systemd` timer that runs `deploy.sh` every 5 minutes — simple and inbound-free, at the cost of a small lag.

   `/etc/systemd/system/pi-api-deploy.service`:
   ```ini
   [Service]
   Type=oneshot
   User=apiadmin
   ExecStart=/home/apiadmin/stack/deploy.sh
   ```
   `/etc/systemd/system/pi-api-deploy.timer`:
   ```ini
   [Timer]
   OnBootSec=2min
   OnUnitActiveSec=5min

   [Install]
   WantedBy=timers.target
   ```
   `sudo systemctl enable --now pi-api-deploy.timer`.

Avoid webhook receivers (e.g. a public `/git-webhook` endpoint) unless you're prepared to authenticate them properly — they widen the attack surface.

### 8.7 Branch hygiene

- Treat the deploy branch as **production**. Don't force-push it; merge into it.
- Tag releases (`git tag v1.0.3 && git push --tags`). If a deploy breaks, `git checkout v1.0.2 && docker compose up -d --build` rolls back in seconds.
- Pin image versions in `docker-compose.yml` (`caddy:2.8-alpine`, not `caddy:latest`) so a base-image update doesn't surprise you mid-deploy.
- Keep secrets in `.env` on the Pi only; reference them from `docker-compose.yml` via `${VAR}`.

---

## 9. Reverse proxy + automatic HTTPS (Caddy)

Caddy is dramatically simpler than nginx + certbot for our use case: it auto-fetches and renews Let's Encrypt certs.

### 9.1 `~/stack/Caddyfile`

```
{
    email you@example.com
}

api.example.com {
    encode zstd gzip

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "no-referrer"
        X-Frame-Options "DENY"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
        -Server
    }

    # Rate limit /api (requires the rate_limit plugin or use fail2ban-on-Caddy-logs)
    # For a simple start, omit this and rely on Cloudflare (§9) for rate limiting.

    reverse_proxy api:3000 {
        header_up X-Real-IP {remote_host}
    }
}
```

If you don't yet have a domain, Caddy can issue certs to `https://pi-api.local` only via internal CA (good for LAN testing). For the public path you **need** a real domain.

### 9.2 `~/stack/docker-compose.yml`

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"   # HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [edge]
    depends_on: [api]
    cap_drop: [ALL]
    cap_add: [NET_BIND_SERVICE]
    security_opt: [no-new-privileges:true]

  api:
    build: ./api/app
    image: pi-api:latest
    restart: unless-stopped
    expose:
      - "3000"          # internal only — no host port
    environment:
      NODE_ENV: production
      PORT: "3000"
    networks: [edge]
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  edge:

volumes:
  caddy_data:
  caddy_config:
```

Note that the Node container uses `expose:` (Docker-internal) rather than `ports:` (published to the host). The only thing reachable from outside the Pi is Caddy on 80/443.

Bring it up:

```bash
cd ~/stack
docker compose up -d
docker compose ps
docker compose logs -f caddy
```

If you're staying LAN-only for now, add `192.168.1.50 api.example.com` to `/etc/hosts` on your laptop and curl it.

### 9.3 Open the host firewall to Caddy

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp     # HTTP/3
```

(Skip this entirely if you choose the tunnel option in §10.)

---

## 10. Public access — the safe options

You have **three** realistic choices. They are listed best → most-effort. Pick **one**.

### Option A (recommended): Cloudflare Tunnel

**No open ports on your router.** The Pi makes an outbound connection to Cloudflare; Cloudflare publishes `api.example.com` on the public internet and forwards encrypted traffic down that tunnel.

Why this is the safe default for a home network:
- Your home IP is never exposed.
- DDoS protection, WAF, bot detection, and rate limiting are included free.
- You don't change router config.
- If the Pi is compromised, the attacker still can't pivot to your LAN via inbound packets — the tunnel is outbound-only.

Setup (high level):
1. Move your domain's nameservers to Cloudflare (free).
2. In Cloudflare Zero Trust → Networks → Tunnels, create a tunnel and copy the install command.
3. Run the `cloudflared` container on the Pi:

   ```yaml
   cloudflared:
     image: cloudflare/cloudflared:latest
     restart: unless-stopped
     command: tunnel --no-autoupdate run --token ${CF_TUNNEL_TOKEN}
     networks: [edge]
   ```

   Put the token in `~/stack/.env` with mode `600`.
4. In the tunnel UI, add a public hostname: `api.example.com` → `http://caddy:80`.
5. Add a Cloudflare Access **Service Auth** policy (mTLS or service tokens) if you want only your mobile app to reach it.

You can now **close ports 80 and 443 on UFW** — Cloudflare reaches Caddy through the Docker network only.

### Option B: Tailscale (private, peer-to-peer VPN)

Best when **only you** (and your phone) need access — no public exposure at all.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh
sudo tailscale cert pi-api.<your-tailnet>.ts.net   # free HTTPS cert for the tailnet name
```

Install Tailscale on your phone, sign in with the same account, and the Pi appears as `pi-api` reachable from anywhere — Wi-Fi or cellular — over WireGuard. **No router changes**, no public exposure. The only downside is that anyone you want to reach the API needs Tailscale installed.

### Option C: Port forwarding (only if A and B don't fit)

This is the riskiest path. Only do it if:
- Your ISP gives you a real public IPv4 (no CGNAT — test at [whatismyip](https://www.whatismyip.com/) and compare with your router's WAN IP).
- You're prepared to monitor logs.

Steps:
1. In your router admin page → **Port forwarding**:
   - External 443 → internal `192.168.1.50:443` (TCP & UDP).
   - External 80 → internal `192.168.1.50:80` (TCP) — needed for Let's Encrypt HTTP-01 challenge.
   - **Do not forward 22, 3000, or any other port.**
2. Use a Dynamic DNS provider (Cloudflare DNS API, DuckDNS, etc.) to keep `api.example.com` pointing at your changing residential IP. Run `ddclient` in a container alongside the others.
3. Put the Pi on a **separate VLAN / guest network** if your router supports it, with firewall rules allowing only outbound, and inbound only on 80/443 to the Pi. This is what stops a compromised Pi from reaching your laptop / NAS / smart bulbs.
4. Add aggressive rate limiting in Caddy and run [CrowdSec](https://www.crowdsec.net/) or fail2ban watching Caddy logs.
5. Disable IPv6 on the forward unless you've audited it — many routers leak IPv6 past the firewall.

Honestly: **prefer Option A**. Port forwarding is a pager waiting to ring.

---

## 11. Authentication for the mobile client

Even with TLS and a tunnel, the API itself must verify the caller. A minimal, sane scheme:

1. The mobile app obtains a long-lived **device key** during a one-time registration (e.g. paste a code shown by `docker compose logs` the first time you set it up).
2. The app exchanges that for short-lived **JWTs** (15 min) via `POST /auth/token`.
3. Every other request sends `Authorization: Bearer <jwt>`.
4. Sign JWTs with a 256-bit secret stored in `~/stack/.env` (chmod 600), loaded into the Node container as an env var.
5. Pin the TLS certificate (or Cloudflare's cert) in your mobile app — prevents a hostile Wi-Fi from MITM'ing even if a CA is compromised.
6. On the Node side, add `helmet`, `express-rate-limit`, and validate every body with `zod` or similar.

Treat the device key like a password. If the phone is lost, rotate the secret in `.env` and `docker compose up -d` — every issued JWT is invalidated.

---

## 12. Always-on: power, watchdogs, auto-restart

- **Container restart**: `restart: unless-stopped` (already in the compose file) brings containers back after crashes and reboots.
- **Docker on boot**: `sudo systemctl enable docker` (the install script does this).
- **Hardware watchdog** (reboots the Pi if the kernel hangs):

  ```bash
  sudo sh -c 'echo "dtparam=watchdog=on" >> /boot/firmware/config.txt'
  sudo apt install -y watchdog
  sudo sed -i 's|#watchdog-device|watchdog-device|' /etc/watchdog.conf
  sudo sed -i 's|#max-load-1.*|max-load-1 = 24|' /etc/watchdog.conf
  sudo systemctl enable --now watchdog
  ```
- **UPS** (optional): a Pi-compatible UPS HAT prevents SD-card corruption during power blips.
- **SSD over USB 3** instead of microSD for write-heavy workloads (logs, DBs) — single biggest reliability upgrade.

---

## 13. Backups & updates

### Backups

- App config: `~/stack/` — push to a private Git repo (with `.env` in `.gitignore`).
- Caddy data (certs): `caddy_data` named volume — `docker run --rm -v caddy_data:/d -v $PWD:/b alpine tar czf /b/caddy_data.tgz -C /d .`
- Any database volume: same pattern.
- A nightly `cron` job that rsyncs the tarballs to another machine or B2/S3 bucket is enough for a home setup.

### Updates

```bash
# Weekly
cd ~/stack
docker compose pull
docker compose up -d
docker image prune -f
sudo apt update && sudo apt full-upgrade -y
```

Watchtower can automate container updates but I'd avoid auto-pulling `:latest` for the Node app you wrote — pin a version, bump it deliberately.

---

## 14. Testing matrix (LAN, cellular, failure modes)

Run these in order.

### 14.1 Container-level

```bash
docker compose ps                         # all 'healthy'
docker compose exec api wget -qO- localhost:3000/health
docker compose exec caddy wget -qO- http://api:3000/health
```

### 14.2 LAN

From your laptop (same Wi-Fi):

```bash
curl -v https://api.example.com/health    # if DNS points at LAN IP, or use --resolve
```

Or open it on your phone connected to the same Wi-Fi.

### 14.3 Cellular / external

- Turn off Wi-Fi on the phone, use the cellular connection.
- Hit the same URL.
- If you're using **Tailscale**, the phone must have Tailscale active.
- If you're using **Cloudflare Tunnel**, no client changes needed.
- If you're using **port forwarding**, this also tests that DDNS is updating.

A useful sanity test: from a coffee-shop laptop, run `curl -I https://api.example.com/health`. You should get `200`. Then try `curl -I https://api.example.com:3000` — you should get connection refused. And `nmap -Pn -p 22,80,443,3000 your.public.ip` should show only 80/443 open (or *nothing* under Cloudflare/Tailscale).

### 14.4 Failure-mode tests

| Test | Expected |
|---|---|
| `docker compose restart api` while curling | brief 502 from Caddy, then 200 |
| `sudo reboot` the Pi | service back within ~60s |
| Pull the Ethernet cable for 30s | Tunnel re-establishes; mobile reconnects |
| Delete the Caddy volume | new cert issued automatically on next start (don't do this on a busy LE rate-limit) |
| Send 1000 req/s with `hey` from outside | Cloudflare rate-limits / your `express-rate-limit` returns 429 |

---

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker: permission denied` | User not in `docker` group | `sudo usermod -aG docker $USER` and re-login |
| Caddy stuck on `obtaining certificate` | Port 80 not reachable from Let's Encrypt | Check router forward / use Cloudflare DNS-01 challenge |
| 502 from Caddy | API container unhealthy | `docker compose logs api` |
| Works on Wi-Fi, not cellular | DNS resolves to LAN IP | Use a public DNS A-record (or Cloudflare/Tailscale) |
| Random Pi reboots | Under-volting (yellow lightning icon) | Use the official 5V/3A PSU |
| SD card read-only after weeks | Card died from writes | Move to SSD over USB 3 |
| Cloudflare Tunnel keeps dropping | `cloudflared` resource limits | Remove memory limits on its container |
| Port scan shows 22 open externally | A misconfigured forward | Remove that forward; UFW already blocks externally if not forwarded |

---

## 16. Appendix: file layout reference

`~/stack` is a git working copy of your `pi-server` branch. Everything except `.env` is tracked.

```
~/stack/                    # = git clone of your repo, on branch pi-server
├── .git/
├── .env                    # secrets (chmod 600), gitignored
├── .env.example            # template, in git
├── deploy.sh               # pull + compose up, in git
├── docker-compose.yml
├── Caddyfile
└── api/
    └── app/
        ├── Dockerfile
        ├── .dockerignore
        ├── package.json
        ├── package-lock.json
        └── server.js
```

`.env` example (never commit):

```
CF_TUNNEL_TOKEN=eyJhIjoi...
JWT_SECRET=replace-with-32-bytes-of-random
```

---

## TL;DR shortest safe path

1. Pi 4/5 + SSD + official PSU + Ethernet.
2. Pi OS Lite, non-default user, key-only SSH, UFW, fail2ban, unattended-upgrades.
3. DHCP reservation for the Pi.
4. Docker Engine + Compose on the Pi (not Docker Desktop).
5. Read-only deploy key on the Pi; `git clone --branch pi-server ...` into `~/stack`; redeploy with `git pull && docker compose up -d --build`.
6. Node app in a non-root, read-only container; only `expose:` it internally.
7. Caddy in front for TLS + headers.
8. **Cloudflare Tunnel** for public access — no router ports opened.
9. JWT auth + cert pinning in the mobile app.
10. Watchdog, restart policies, weekly updates, off-box backups.
11. Test on Wi-Fi, on cellular, and with the network unplugged.

That's it — a Pi you can leave on a shelf for a year, that your mobile app can hit from anywhere, without putting your home network on the public internet.
