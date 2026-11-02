# CogniTrack AI — VM Deployment & Handoff Guide

This document contains instructions for deploying the **CogniTrack AI** platform on any Linux Virtual Machine (AWS EC2, GCP Compute Engine, Azure VM, DigitalOcean, or on-premise server).

---

## 1. Quick Architecture Overview

- **Backend**: FastAPI (Python 3.10) with OpenCV, MediaPipe, Tesseract OCR, SQLite.
- **Frontend**: Single-page application served directly by FastAPI from `/frontend` on port `8002`.
- **Single-port deployment**: No separate Node.js server is needed in production; FastAPI handles both the UI and API endpoints.

---

## 2. Recommended Deployment: Docker & Docker Compose

Docker is strongly recommended because OpenCV and MediaPipe require specific Linux shared libraries (`libgl1`, `libgles2`, `libglib2.0-0`, etc.). Containerization eliminates system dependency mismatches.

### Prerequisites on the VM
- OS: Ubuntu 22.04 LTS or 24.04 LTS (recommended)
- Specs: Minimum 2 vCPU, 4GB RAM, 20GB Disk
- Docker Engine & Docker Compose Plugin installed

To install Docker on Ubuntu:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and log back in, or run:
newgrp docker
```

---

## 3. Step-by-Step Deployment Steps

### Step 1: Copy Project Files to the VM
Transfer the project archive or clone via Git to the VM:
```bash
# Example if using SCP:
scp cognitrack-handoff.zip user@<VM_IP>:~/
ssh user@<VM_IP>
unzip cognitrack-handoff.zip -d cognitrack
cd cognitrack
```

### Step 2: Configure Environment Variables
Copy the template and fill in your secrets:
```bash
cp .env.example .env
nano .env
```
Ensure the following keys are set:
- `GROQ_API_KEY`: Your Groq API key (`gsk_...`)
- `OPENAI_API_KEY`: Your OpenAI API key (`sk_...`)
- `ADMIN_PASSWORD`: A secure password for the Admin dashboard
- `PARTICIPANT_TOKEN_SECRET`: A long random secret string (e.g. run `openssl rand -hex 32`)

### Step 3: Build & Launch Container
```bash
docker compose up -d --build
```

Check container status and logs:
```bash
docker compose ps
docker compose logs -f cognitrack-app
```

The app will be accessible at: `http://<VM_IP>:8002`

---

## 4. CRITICAL: HTTPS / SSL Requirement for Camera Tracking

> ⚠️ **Browser Security Requirement**:
> Modern web browsers (Google Chrome, Firefox, Safari, Edge) strictly forbid webcam access (`navigator.mediaDevices.getUserMedia`) over unencrypted `http://` IP addresses. Webcams only activate on **`localhost`** or **`https://`**.

If candidates access `http://<VM_IP>:8002` directly, the webcam telemetry will not start.

### Solution A: Use Nginx Reverse Proxy with Free Let's Encrypt SSL (Production Standard)
1. Point your domain (e.g., `assessment.yourdomain.com`) to the VM's public IP in your DNS settings.
2. Install Nginx and Certbot:
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

3. Create Nginx site configuration (`/etc/nginx/sites-available/cognitrack`):
```nginx
server {
    server_name assessment.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

4. Enable the site and obtain SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/cognitrack /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d assessment.yourdomain.com
```

### Solution B: Quick Testing via SSH Local Tunnel (No Domain Needed)
For private evaluation without setting up a domain:
```bash
# Run this on your local machine:
ssh -L 8002:localhost:8002 user@<VM_IP>
```
Then open `http://localhost:8002` in your local browser. Browsers treat `localhost` as a secure origin, allowing full webcam permissions.

---

## 5. Alternative: Bare-Metal Deployment (Without Docker)

If you must run directly on the VM without Docker:

```bash
# 1. Install system C-libraries required by OpenCV & MediaPipe
sudo apt update
sudo apt install -y python3-pip python3-venv \
    libgles2 libgl1 libegl1 libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    tesseract-ocr tesseract-ocr-eng

# 2. Setup Python Virtual Environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 3. Configure .env
cp .env.example .env
nano .env

# 4. Run application
uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8002
```

To run continuously as a background service, configure a systemd service at `/etc/systemd/system/cognitrack.service`.

---

## 6. Data Persistence & Backups

All state is stored inside the `./data/` folder:
- `data/cognitrack.db`: SQLite database holding participants, sessions, and telemetry.
- `data/users.csv`: User registration credentials.
- `data/tasks_dataset.csv`: Dynamic domain questions and tasks.

Because `./data` is mounted as a volume in `docker-compose.yml`, data persists across container updates and restarts. Back up the `data/` directory periodically.

