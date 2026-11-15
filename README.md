# FlashBack

A self-hosted, real-time live event photo-sharing web application and projector slideshow system. Guests scan an event QR code or enter a 5-character event code on their phones to capture or upload photos directly from their browser—automatically optimized to 1080p and broadcast live to the venue's projector screen via WebSockets.

---

## Features

- **Frictionless Guest Uploads:** Guests join immediately via QR code or 5-character event code with per-guest upload quotas—no guest account registration required.
- **Real-Time Projector Slideshow:** Instant live photo streaming powered by `Socket.IO` and server-side 1080p progressive JPEG optimization via `Sharp`.
- **Host Dashboard:** Registered hosts can create events, generate shareable QR codes, monitor upload counts, and launch projector slideshows.
- **System Administration:** Protected admin control panel featuring a 15-minute active guest window metric, event pause/resume toggles, and safe user deletion (automatically reassigning events and photos to the system administrator account).
- **Resilient Hybrid UI:** Mobile-first responsive interface built with pure JavaScript/JSX, Tailwind CSS, and embedded inline CSS fallbacks.

---

## Project Structure

```text
/data/FlashBack/
├── docker-compose.yml          # Multi-container stack (frontend, backend, gallery)
├── README.md                   # Project documentation
├── filebrowser-data/           # Mounted gallery database storage
├── uploads/                    # Shared root volume for event photo directories
├── flashback-backend/          # Node.js, Express, Socket.IO & MariaDB API
│   ├── .dockerignore
│   ├── .env                    # Local secrets (git-ignored)
│   ├── .env.example            # Required environment variables template
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   ├── db.js                   # MariaDB connection pool & session/reassignment queries
│   └── server.js               # REST API, Multer/Sharp image pipeline & WebSockets
└── flashback-frontend/         # React + Vite SPA (pure JS/JSX, no frontend .env)
    ├── .dockerignore
    ├── .gitignore
    ├── Dockerfile
    ├── eslint.config.js
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx             # Client-side router & ErrorBoundary
        ├── main.jsx            # React entry point
        ├── LandingPage.jsx     # Event code entry & navigation hub
        ├── GuestUpload.jsx     # Mobile camera/gallery uploader & quota tracker
        ├── UserDashboard.jsx   # Host authentication, event creation & QR modals
        ├── Slideshow.jsx       # Live WebSocket projector slideshow
        └── AdminPanel.jsx      # System metrics & user/event moderation

```

---

## Prerequisites

* **Docker** & **Docker Compose**
* **MariaDB / MySQL** database instance with pre-configured tables (`users`, `events`, `photos`, `sessions`)
* Reverse proxy (such as **Cloudflare Tunnel** or **Nginx**) to route `/api` and `/uploads` to the backend and `/` to the frontend

   I have used my own home-server to launch this website, The site is ascessible to public via my personal sub-domain "flashback.tmgutsav.com.np". In order to run this project one needs to configure the server for hosting and storage.
---

## Setup & Docker Deployment

### 1. Clone the Repository

```bash
git clone https://github.com/Ecchisen/FlashBack_BackUp.git
cd FlashBack_BackUp

```

### 2. Configure Backend Environment Variables

Copy the template file in `flashback-backend/` and populate all required values. The backend performs strict startup validation without fallback defaults and will exit if any required key is missing:

```bash
cp flashback-backend/.env.example flashback-backend/.env
nano flashback-backend/.env

```

Required variables in `flashback-backend/.env`:

| Variable | Description | Example |
| --- | --- | --- |
| `PORT` | Express & Socket.IO server port | `5000` |
| `JWT_SECRET` | Secret key for signing host JWT tokens | `your_random_hex_secret` |
| `ADMIN_KEY` | Master key for `/adminpanel` authentication | `your_admin_master_key` |
| `UPLOAD_DIR` | Relative path to the shared uploads volume | `../uploads` |
| `DB_HOST` | MariaDB / MySQL host address | `mariadb` |
| `DB_USER` | Database username | `flashback` |
| `DB_PASSWORD` | Database password | `your_db_password` |
| `DB_NAME` | Database name | `flashback_db` |

*(Note: `flashback-frontend` intentionally uses no `.env` file and communicates directly via relative `/api` endpoints.)*

### 3. Initialize the MariaDB / MySQL Database Schema

Because db.js intentionally does not run schema creation DDL on startup, execute the following SQL commands in your MariaDB / MySQL instance (via CLI or phpMyAdmin) before launching the site.
```sql
CREATE DATABASE IF NOT EXISTS flashback_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE flashback_db;

-- 1. Registered Hosts & Administrators
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Photo Sharing Events
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_code VARCHAR(10) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  created_by INT NULL,
  status ENUM('active', 'paused') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_events_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

-- 3. Uploaded Event Photos
CREATE TABLE IF NOT EXISTS photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  guest_token VARCHAR(128) NOT NULL DEFAULT 'anon',
  file_name VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_photos_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE
);

-- 4. Active Guest & Session Heartbeat Tracking (15-Minute Admin Metric)
CREATE TABLE IF NOT EXISTS sessions (
  guest_token VARCHAR(128) PRIMARY KEY,
  event_id INT NULL,
  user_id INT NULL,
  ip_address VARCHAR(45) NULL,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

```

### 4. Build and Start the Docker Stack

```bash
docker compose up -d --build

```

Check container status and logs:

```bash
docker compose ps
docker logs flashback-backend --tail 20

```

### 5. Reverse Proxy / Cloudflare Tunnel Routing

Configure your reverse proxy or `cloudflared` ingress rules so API and static media traffic route to the backend while UI traffic routes to the frontend:

```yaml
ingress:
  - hostname: custom domain/sub-domain
    path: /api
    service: http://localhost:5000
  - hostname: custom domain/sub-domain
    path: /uploads
    service: http://localhost:5000
  - hostname: custom domain/sub-domain
    service: http://localhost:5173
  - service: http_status:404

```

---

## Tech Stack

* **Frontend:** React, Vite, Tailwind CSS + inline CSS fallbacks, `lucide-react`, `qrcode.react`
* **Backend:** Node.js, Express, Socket.IO, `mysql2`, `bcryptjs`, `jsonwebtoken`, `multer`, `sharp`
* **Infrastructure:** Docker Compose, MariaDB, Cloudflare Tunnel
EOF
