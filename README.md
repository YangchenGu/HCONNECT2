# HCONNECT2

HCONNECT is a healthcare monitoring and management web app with:

- `hconnect-frontend`: React + Vite SPA
- `hconnect-backend`: Node.js + Express API
- PostgreSQL database
- Auth0 authentication
- Twilio SMS verification

---

## 1) Project Structure

```text
HCONNECT2/
  hconnect-frontend/   # React app (Vite)
  hconnect-backend/    # Express API
```

---

## 2) Local Development

### Prerequisites

- Node.js 18+ (recommended 20+)
- npm
- PostgreSQL 12+

### Backend

```bash
cd hconnect-backend
npm install
cp .env.example .env
# fill .env values
npm run dev
```

Backend runs at `http://localhost:3000`.

### Frontend

```bash
cd hconnect-frontend
npm install
cp .env.example .env
# default works for local (VITE_API_BASE_URL=http://localhost:3000)
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## 3) Environment Variables

### Backend (`hconnect-backend/.env`)

See `hconnect-backend/.env.example` for full template.

Required groups:

- Database: `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`
- Auth0: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_DB_CONNECTION`
- Auth0 M2M (for user creation): `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

Optional:

- `CORS_ORIGIN` (comma-separated origins)
- `SMS_CODE_LENGTH` (default 6; supports 4-8)
- `SMS_CODE_TTL_MS` (default 300000)
- `ALLOW_ALL_PHONES_FOR_TESTING` (`true`/`false`, default false)
- `BYPASS_SMS_VERIFICATION_FOR_TESTING` (`true`/`false`, default false; skips actual SMS and auto-issues verification token)

### Frontend (`hconnect-frontend/.env` / `.env.production`)

`VITE_API_BASE_URL`

- Local: `http://localhost:3000`
- Nginx same-domain deploy: `/`
- Separate API domain: `https://api.yourdomain.com`

---

## 4) Database Setup

Create DB and apply schema:

```bash
psql -U hconnect_user -h localhost -d hconnect_db -f hconnect-backend/src/db/schema.sql
```

To allow a doctor phone number for strict registration mode, insert into `healthcare_providers`:

```sql
INSERT INTO healthcare_providers (country, phone_number, provider_name, institution, specialty)
VALUES ('CA', '+14165551234', 'Test Doctor', 'HCONNECT Test Clinic', 'General');
```

---

## 5) Production Deployment on GCP VM (Ubuntu)

### 5.1 Install runtime

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

### 5.2 Backend process

```bash
cd /home/<user>/hconnect/hconnect-backend
npm install
pm2 start src/server.js --name hconnect-backend
pm2 save
```

### 5.3 Frontend build

```bash
cd /home/<user>/hconnect/hconnect-frontend
npm install
# for same-domain nginx reverse proxy:
echo "VITE_API_BASE_URL=/" > .env.production
npm run build
```

### 5.4 Serve static files from `/var/www`

```bash
sudo mkdir -p /var/www/hconnect
sudo rm -rf /var/www/hconnect/*
sudo cp -a /home/<user>/hconnect/hconnect-frontend/dist/. /var/www/hconnect/
sudo chown -R www-data:www-data /var/www/hconnect
sudo find /var/www/hconnect -type d -exec chmod 755 {} \;
sudo find /var/www/hconnect -type f -exec chmod 644 {} \;
```

### 5.5 Nginx config

Create `/etc/nginx/sites-available/hconnect`:

```nginx
server {
	listen 80;
	server_name hconnect.space www.hconnect.space;
	return 301 https://www.hconnect.space$request_uri;
}

server {
	listen 443 ssl;
	server_name hconnect.space;

	ssl_certificate /etc/letsencrypt/live/hconnect.space/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/hconnect.space/privkey.pem;

	return 301 https://www.hconnect.space$request_uri;
}

server {
	listen 443 ssl;
	server_name www.hconnect.space;

	ssl_certificate /etc/letsencrypt/live/hconnect.space/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/hconnect.space/privkey.pem;

	root /var/www/hconnect;
	index index.html;

	location / {
		try_files $uri $uri/ /index.html;
	}

	location /api/ {
		proxy_pass http://127.0.0.1:3000;
		proxy_set_header Host $host;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}

	location /public/ {
		proxy_pass http://127.0.0.1:3000;
		proxy_set_header Host $host;
	}

	location /internal/ {
		proxy_pass http://127.0.0.1:3000;
		proxy_set_header Host $host;
	}
}
```

Enable and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/hconnect /etc/nginx/sites-enabled/hconnect
sudo nginx -t
sudo systemctl restart nginx
```

### 5.6 HTTPS certificate

After DNS A records point to VM IP:

```bash
sudo certbot --nginx -d hconnect.space -d www.hconnect.space
```

---

## 6) Auth0 Configuration (Production)

In your Auth0 SPA application settings, set:

- Allowed Callback URLs: `https://www.hconnect.space`
- Allowed Logout URLs: `https://www.hconnect.space`
- Allowed Web Origins: `https://www.hconnect.space`
- Allowed Origins (CORS): `https://www.hconnect.space`

For local dev, also include:

- `http://localhost:5173`

---

## 7) Update / Deploy Cycle

### Backend code update

```bash
cd /home/<user>/hconnect/hconnect-backend
git pull
npm install
pm2 restart hconnect-backend --update-env
```

### Frontend code update

```bash
cd /home/<user>/hconnect/hconnect-frontend
git pull
npm install
npm run build
sudo rm -rf /var/www/hconnect/*
sudo cp -a dist/. /var/www/hconnect/
sudo chown -R www-data:www-data /var/www/hconnect
sudo systemctl reload nginx
```

---

## 8) Troubleshooting

### `401` on `/api/me/role`

- Without token this is expected.
- With logged-in app flow, verify Auth0 audience/origins and token acquisition.

### Login returns to role selection

- Check `users` table has a row for current user.
- API `/api/me/role` must return `{ role: ... }` for authenticated user.

### `500` + `Permission denied` in Nginx logs

- Static files likely served from `/home/...` with blocked permissions.
- Move built assets to `/var/www/hconnect` and set owner `www-data`.

### Registration error: `value too long for type character varying(2)`

- `country` values must be 2 characters (e.g., `CA`, `US`, `TS`).

### Check logs

```bash
pm2 logs hconnect-backend --lines 100
sudo tail -n 100 /var/log/nginx/error.log
```

---

## 9) Security Notes

- Never commit `.env` to git.
- Rotate secrets if exposed (Auth0, Twilio, DB).
- Keep `ALLOW_ALL_PHONES_FOR_TESTING=false` in production.


