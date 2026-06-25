# VPS Deployment Guide: OmniAI Assistant

This guide explains how to deploy the application on a Linux VPS (Ubuntu/Debian recommended).

## Prerequisites
- VPS with Docker and Docker Compose installed.
- Domain name with A-record pointing to your VPS IP (optional, for SSL).

## Option 1: Docker Deployment (Recommended)

1. **Clone/Upload Files**:
   Upload the project folder to `/var/www/omniai-assistant` (or any other directory of your choice).

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Add your `GEMINI_API_KEY`.

3. **Launch**:
   By default, the internal application runs on port `3000`. To expose it on port `5555`, open `docker-compose.yml` and change the port mapping:
   ```yaml
   ports:
     - "5555:3000"
   ```
   Then start the container:
   ```bash
   docker-compose up -d --build
   ```
   The app will be available on `http://your_vps_ip:5555`.

## Option 2: PM2 Deployment (Manual)

1. **Install Node.js 20+**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Install PM2**:
   ```bash
   sudo npm install -g pm2
   ```

3. **Install and Build**:
   ```bash
   npm install
   npm run build
   ```

4. **Start Application**:
   Since the source code hardcodes port 3000 for the AI Studio preview environment, if you are running outside of Docker via PM2, you can either manually edit `server.ts` to change `const PORT = 3000;` to `const PORT = 5555;` before building, or use a reverse proxy to route 5555 to 3000:
   ```bash
   pm2 start dist/server.cjs --name "omniai-app"
   pm2 save
   pm2 startup
   ```

## Security & SSL
It is highly recommended to use **Nginx** as a reverse proxy with **Certbot** for SSL:
```bash
sudo apt install nginx certbot python3-certbot-nginx
```
Configure Nginx to proxy your custom port (`5555`) or web ports (`80/443`) to `http://localhost:3000`.
