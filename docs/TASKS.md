# TASKS.md

# Personal Media Vault - Implementation Roadmap

## Purpose

This file defines the exact implementation order.

IMPORTANT:

The AI must NOT skip phases.

The AI must NOT build future phases before the current phase is complete.

Each phase should produce a working, testable system.

The goal is iterative development.

---

# Global Rules

Before starting any phase:

1. Read:

   * ADR.md
   * DATABASE.md
   * API_SPEC.md
   * STORAGE_PROVIDER_CONTRACT.md

2. Follow architecture decisions exactly.

3. Do not introduce:

   * Redis
   * Elasticsearch
   * Microservices
   * GraphQL
   * Additional databases

4. Use:

   * Next.js
   * PostgreSQL
   * Prisma

5. Every phase must compile successfully before proceeding.

---

# Phase 0 - Project Setup

Goal:

Create the foundation.

Deliverables:

* Next.js project
* TypeScript
* Tailwind
* Prisma
* PostgreSQL connection
* Environment variable setup
* Folder structure from ADR

Tasks:

* Initialize Next.js
* Configure ESLint
* Configure Prettier
* Configure Prisma
* Configure PostgreSQL
* Create base folder structure
* Create constants directory
* Create types directory
* Create utility functions

Success Criteria:

```txt
Project runs locally.
Database connects successfully.
No application features yet.
```

STOP.

Do not continue automatically.

---

# Phase 1 - Database Layer

Goal:

Create database schema.

Tasks:

Create tables:

* users
* user_sessions
* storage_nodes
* files
* backups
* upload_jobs

Create:

* indexes
* constraints
* foreign keys

Create:

* Prisma schema

Create:

* migrations

Success Criteria:

```txt
All tables created.

Prisma migration succeeds.

Prisma client generated.
```

STOP.

---

# Phase 2 - Authentication

Goal:

Users can register and login.

Tasks:

Implement:

* Register API
* Login API
* Refresh API
* Logout API
* Logout All API

Implement:

* JWT
* Refresh tokens
* Session creation

Create:

* Login page
* Register page

Create middleware:

* Auth protection

Success Criteria:

```txt
User can:

Register
Login
Refresh session
Logout

Session persists across refreshes.
```

STOP.

---

# Phase 3 - Core Layout

Goal:

Create application shell.

Tasks:

Create:

* Navbar
* Sidebar
* Mobile Navigation
* Dashboard Layout

Pages:

* Home
* Upload
* Favorites
* Trash
* Settings

Add:

* Responsive design

Success Criteria:

```txt
User can navigate application.

No file functionality yet.
```

STOP.

---

# Phase 4 - Storage Provider Foundation

Goal:

Implement provider architecture.

Tasks:

Create:

StorageProvider interface

Implement:

* MegaProvider
* PCloudProvider

Create:

StorageManager

Create:

StorageService

Implement:

* testConnection()
* upload()
* delete()
* getStorageInfo()

No UI yet.

Success Criteria:

```txt
Can manually upload a test file through code.

Storage Manager selects provider correctly.
```

STOP.

---

# Phase 5 - Storage Node Management

Goal:

Admin can manage storage accounts.

Tasks:

Admin APIs:

* Add Node
* Disable Node
* Test Node
* View Nodes

Admin UI:

* Storage Nodes Page
* Add Node Modal

Implement:

* Credential encryption
* Connection validation

Success Criteria:

```txt
Admin can add:

MEGA Account
pCloud Account

without code changes.
```

STOP.

---

# Phase 6 - File Upload System

Goal:

Upload photos and videos.

Tasks:

Implement:

POST /files/upload

Create:

UploadService

Validate:

* image <= 20MB
* video <= 2GB

Create:

upload_jobs

Track:

* uploading
* success
* failure

Success Criteria:

```txt
User uploads file.

File stored on provider.

Metadata saved.
```

STOP.

---

# Phase 7 - Thumbnail System

Goal:

Generate thumbnails.

Tasks:

Install:

FFmpeg

Images:

* resize
* compress

Videos:

* extract frame

Store:

* thumbnail as file

Create:

thumbnail relationships

Success Criteria:

```txt
Every uploaded file has thumbnail.

Thumbnail stored successfully.
```

STOP.

---

# Phase 8 - Gallery

Goal:

View uploaded media.

Tasks:

Implement:

GET /files

Features:

* Grid View
* Infinite Scroll
* Lazy Loading
* Thumbnail Rendering

Pagination:

Cursor-based

Never load originals.

Success Criteria:

```txt
Gallery loads thumbnails only.

Infinite scrolling works.
```

STOP.

---

# Phase 9 - File Viewing

Goal:

Open media.

Tasks:

Images:

* Fullscreen viewer

Videos:

* Streaming page

Implement:

* View endpoint
* Stream endpoint

Success Criteria:

```txt
Images open instantly.

Videos stream successfully.
```

STOP.

---

# Phase 10 - Search

Goal:

Search uploaded files.

Tasks:

Implement:

* Filename search
* Type filter
* Date filter

Optimize indexes.

Success Criteria:

```txt
Search returns correct files.
```

STOP.

---

# Phase 11 - Favorites

Goal:

Favorite media.

Tasks:

Implement:

* Favorite API
* Unfavorite API

Create:

Favorites page

Success Criteria:

```txt
Favorite files persist.
```

STOP.

---

# Phase 12 - Trash

Goal:

Safe deletion.

Tasks:

Implement:

Delete File

Restore File

Permanent Delete

Create:

Trash Page

Success Criteria:

```txt
Deleted files appear in trash.

Can restore.

Can permanently delete.
```

STOP.

---

# Phase 13 - Downloads

Goal:

Download media.

Tasks:

Implement:

Single File Download

Bulk Download URL Generation

Success Criteria:

```txt
Files download correctly.
```

STOP.

---

# Phase 14 - Sharing

Goal:

Share files.

Tasks:

Implement:

Temporary Share URLs

Expiration:

15 minutes

Create:

Share UI

Success Criteria:

```txt
User can share files.
```

STOP.

---

# Phase 15 - Backup System

Goal:

Telegram backup.

Tasks:

Create:

Backup Worker

Create:

Backups Table Logic

Implement:

Images:
Backup Always

Videos:
Backup <= 1GB

Retries:
3 Attempts

Success Criteria:

```txt
Backups created automatically.
```

STOP.

---

# Phase 16 - Admin Dashboard

Goal:

Full administration.

Tasks:

Create:

Users Page

Files Page

Storage Page

Backup Monitoring

Features:

View all files

Download all files

Delete all files

View storage usage

Success Criteria:

```txt
Admin can manage entire system.
```

STOP.

---

# Phase 17 - Scheduled Jobs

Goal:

Automation.

Tasks:

Create:

Backup Retry Worker

Storage Sync Worker

Trash Cleanup Worker

Session Cleanup Worker

Schedules:

15 Minutes:
Backup Retry

6 Hours:
Storage Sync

Daily:
Trash Cleanup

Daily:
Session Cleanup

Success Criteria:

```txt
All background jobs run successfully.
```

STOP.

---

# Phase 18 - Performance Optimization

Goal:

Fast experience.

Tasks:

Optimize:

* Queries
* Pagination
* Images
* Streaming

Audit:

* N+1 Queries
* Bundle Size
* Database Queries

Success Criteria:

```txt
Gallery loads under 1 second.

Infinite scrolling smooth.

Streaming responsive.
```

STOP.

---

# Phase 19 - Security Review

Goal:

Production readiness.

Tasks:

Verify:

* JWT Security
* Permissions
* Admin Access
* File Ownership Checks
* Credential Encryption

Perform:

* Authorization audit
* Input validation audit

Success Criteria:

```txt
No obvious security issues.
```

STOP.

---

# Phase 20 - Deployment

Goal:

Deploy application.

Tasks:

Deploy:

* Next.js
* PostgreSQL

Configure:

* Environment Variables

Verify:

* Uploads
* Streaming
* Backups

Success Criteria:

```txt
Production environment operational.
```

STOP.

---

# Final Rule For AI Agents

Never build Phase N+1 before Phase N is completed and tested.

Every phase must be:

1. Implemented
2. Tested
3. Reviewed

before proceeding.

The project should always remain in a deployable state.
