# VPS Deployment Guide: OmniAI Assistant

This guide explains how to deploy the application on a Linux VPS (Ubuntu/Debian recommended).

## Prerequisites
- VPS with Docker and Docker Compose installed.
- Domain name with A-record pointing to your VPS IP (optional, for SSL).

## Option 1: Docker Deployment (Recommended)

1. **Clone/Upload Files**:
   Upload the project folder to `/opt/omniai-assistant`.

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Add your `GEMINI_API_KEY`.

3. **Launch**:
   ```bash
   docker-compose up -d --build
   ```
   The app will be available on `http://your_vps_ip:3000`.

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
Configure Nginx to proxy `80/443` to `http://localhost:3000`.
