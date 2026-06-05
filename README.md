# 🔒 Personal Media Vault

[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.8.0-2D3748?style=flat-square&logo=prisma)](https://prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)

Personal Media Vault is a lightweight, cloud-based media storage platform designed for personal use and a small group of trusted users. The application allows users to upload, organize, view, stream, search, share, and download photos and videos from anywhere through a modern web browser.

Unlike traditional cloud storage, files are automatically distributed across multiple connected storage providers (treated as **Storage Nodes**) based on available capacity while appearing as a single, unified storage system to the user.

---

## 🚀 Key Features

* **📦 Unified Storage Node Management**: Add, enable, disable, and monitor storage accounts dynamically from the Admin Dashboard. Files are automatically uploaded to the node with the highest available capacity.
* **⚡ Media Processing & Thumbnails**: 
  * Automatically resizes and compresses image uploads (via **Sharp**).
  * Automatically extracts frames from video uploads to generate video preview thumbnails (via **FFmpeg**).
* **🔄 Automated Cold Backups**: Image uploads and video uploads ($\le$ 1 GB) are backed up automatically in the background to a secure Telegram channel/chat.
* **🎞️ Progressive Video Streaming**: Stream uploaded videos without downloading them completely. Supports seek, pause, resume, and progressive loading via temporary pre-signed URLs.
* **🗑️ Soft Delete & Trash System**: Safely delete files by moving them to the Trash. Files are permanently purged from the storage provider, backup destination, and database after **30 days**.
* **🔗 Temporary Sharing Links**: Generate shareable links to media that automatically expire after **15 minutes**.
* **🔑 Device-Aware Auth & Extended Sessions**: JWT-based authentication with device tracking (User-Agent, Device Name, Last Active Time) and hashed refresh tokens valid for 90 days to prevent frequent re-login.

---

## 🛠️ Technology Stack

* **Frontend & Backend**: [Next.js 16](https://nextjs.org/) (App Router, React 19)
* **Styling**: Vanilla CSS with [Tailwind CSS v4](https://tailwindcss.com/)
* **ORM & Database**: [Prisma ORM](https://prisma.io/) with [PostgreSQL](https://www.postgresql.org/)
* **Media Processing**: [FFmpeg](https://ffmpeg.org/) (video frames) & [Sharp](https://sharp.pixelplumbing.com/) (image manipulation)
* **Storage Drivers**: AWS SDK S3 client (configured for Backblaze B2)
* **Backups**: Telegram Bot API
* **Form & Validation**: `react-hook-form` & `zod`

---

## 🏗️ System Architecture & Engineering Rules

The application enforces a strict modular layer design to separate business logic, data models, and API interfaces:

```mermaid
graph TD
    Client[Next.js Client UI] -->|HTTP Request| API[API Routes /app/api/*]
    API -->|Validation & Auth| Service[Services /lib/services/*]
    Service -->|Database Operations| DB[(PostgreSQL Database via Prisma)]
    Service -->|Upload/Download| Manager[Storage Manager /lib/storage/manager.ts]
    Manager -->|Selects Best Node| B2[Backblaze B2 Adapter /lib/storage/providers/b2.provider.ts]
    
    %% Background Job Workflow
    Worker1[Backup Worker] -->|Polls Queue / Every 10s| TG[Telegram Provider /lib/storage/providers/telegram.provider.ts]
    Worker2[Trash Cleanup] -->|Daily purge| Service
    Worker3[Storage Sync] -->|Every 6 hours| Manager
```

### Layer Responsibilities

1. **API Routes (`app/api/*`)**: Validate requests, verify JWT tokens, and hand over tasks to Services. *Must NOT query the database or call providers directly.*
2. **Services (`lib/services/*`)**: House all business logic, enforce permission boundaries, and interact with the database. *Must NOT know provider implementation details.*
3. **Storage Manager (`lib/storage/manager.ts`)**: Responsible for node selection (highest remaining space) and routing download/view requests to the correct adapter.
4. **Provider Adapters (`lib/storage/providers/*`)**: Handle raw API communications with external storage solutions. *Must NOT access the database or check user authentication.*
5. **Workers (`lib/jobs/*`)**: Run background operations decoupled from HTTP requests. Triggered on intervals via Next.js instrumentation.

### Automatic Scheduled Jobs

All workers run inside the Node.js server runtime and start automatically when the Next.js server starts (using `instrumentation.ts`):

| Worker | Frequency | Purpose |
| :--- | :--- | :--- |
| **Backup Worker** | Every 10 seconds | Uploads pending images and videos ($\le$ 1 GB) from the queue to Telegram. |
| **Backup Retry Worker** | Every 15 minutes | Resets failed backup tasks back to `PENDING` (max 3 retry attempts). |
| **Storage Sync Worker** | Every 6 hours | Queries storage nodes for updated metrics (`usedSpaceMb`, `totalSpaceMb`). |
| **Trash Cleanup Worker** | Daily | Permanently deletes files soft-deleted more than 30 days ago. |
| **Session Cleanup Worker** | Daily | Cleans up expired user sessions and tokens from the database. |

---

## ⚙️ Environment Variables Setup

Create a `.env` file in the root directory and populate it with the following configuration keys (refer to `.env.example`):

```bash
# Database Connection URL (PostgreSQL)
DATABASE_URL="postgresql://username:password@hostname:port/database?sslmode=require"

# JWT Secrets for Authentication Session Signing (generate random 64-byte hex values)
JWT_ACCESS_SECRET="generate-a-secure-random-64-byte-hex-string-for-access-token"
JWT_REFRESH_SECRET="generate-a-secure-random-64-byte-hex-string-for-refresh-token"
JWT_SHARE_SECRET="generate-a-secure-random-64-byte-hex-string-for-sharing-token"

# AES-256-GCM Encryption Key for encrypting Storage Node Credentials (generate random 32-byte hex value)
ENCRYPTION_KEY="generate-a-secure-random-32-byte-hex-string-for-credentials"

# Telegram Bot API Credentials for Cold Storage Backups
TELEGRAM_BOT_TOKEN="your-telegram-bot-token-here"
TELEGRAM_CHAT_ID="your-telegram-chat-or-channel-id-here"
```

---

## 🏁 Getting Started

### Prerequisites

* **Node.js** (v18.x or newer)
* **PostgreSQL** database instance
* **FFmpeg** installed on the server environment (accessible via `ffmpeg` in system path)
* **Telegram Bot** token and **Chat ID** (where backups will be sent)
* **Backblaze B2** account/bucket credentials to add as a storage node

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd vault-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in the required keys.

4. **Sync Prisma Database Schema**:
   Apply migrations or push the schema directly to your PostgreSQL database:
   ```bash
   npx prisma db push
   ```

5. **Bootstrap Admin User**:
   Seed the database with the initial admin account (`rakadmin@gmail.com` / `rakadmin05`):
   ```bash
   npx tsx seed-admin.ts
   ```

6. **Run the Application locally**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the interface.

---

## 👥 User Roles & Permissions

### Regular User
* **Upload**: Single or bulk drag-and-drop file uploads (Images $\le$ 20 MB, Videos $\le$ 2 GB).
* **Gallery**: View personal images and stream videos smoothly (Gallery uses lazy loading and cursor pagination to open in under 1 second).
* **Actions**: Favorite/unfavorite files, search by name/type/date, download (single or bulk), delete files (sends to trash).
* **Trash**: Restore deleted files, or manually trigger permanent deletions.
* **Sharing**: Generate 15-minute temporary URLs for external sharing (WhatsApp, Telegram, etc.).
* **Restrictions**: Cannot access other users' files, admin views, or storage node secrets.

### Administrator
* All regular user actions.
* **Moderation**: Access, view, search, and delete all user-uploaded files.
* **Node Management**: View active/inactive nodes, add new storage accounts, toggle node status, and monitor capacity usage.
* **System Monitoring**: Monitor upload jobs, backup progress, retry failed backup jobs, and view logs.

---

## 🔌 API Quick Reference

All API routes are prefixed with `/api`. Main endpoints include:

### Authentication
* `POST /api/auth/register` - Register a new account.
* `POST /api/auth/login` - Authenticate a user and set cookies.
* `POST /api/auth/refresh` - Refresh access tokens using refresh tokens.
* `POST /api/auth/logout` - Invalidate current session.
* `POST /api/auth/logout-all` - Invalidate all active sessions.
* `GET /api/auth/me` - Fetch details of the current logged-in user.

### File Operations
* `POST /api/files/upload` - Endpoint for single/multipart file uploads.
* `GET /api/files` - Fetch paginated file metadata (returns thumbnails, never original files).
* `GET /api/files/:id` - Fetch metadata for a specific file.
* `GET /api/files/:id/thumbnail` - Download or display the thumbnail image.
* `GET /api/files/:id/view` - Returns a temporary URL to view the original file.
* `GET /api/files/:id/stream` - Progressive video stream endpoint (supports range headers).
* `GET /api/files/:id/download` - Download a file directly.
* `POST /api/files/download` - Initiate bulk download URLs.
* `DELETE /api/files/:id` - Soft delete a file (moves to trash).

### Sharing & Trash
* `POST /api/files/:id/share` - Generate a 15-minute temporary share link.
* `GET /api/trash` - Retrieve files currently in trash.
* `POST /api/trash/:id/restore` - Restore a file from trash back to the gallery.
* `DELETE /api/trash/:id` - Permanently delete a file immediately.

### Admin Tools
* `GET /api/admin/users` - List all users and their storage utilization.
* `GET /api/admin/storage-nodes` - Retrieve all configured storage nodes.
* `POST /api/admin/storage-nodes` - Add a new storage node configuration.
* `PATCH /api/admin/storage-nodes/:id` - Enable or disable a storage node.
* `POST /api/admin/storage-nodes/:id/test` - Test adapter connectivity.
