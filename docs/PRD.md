# Personal Media Vault - Product Requirements Document (PRD)

## 1. Product Overview

Personal Media Vault is a lightweight cloud-based media storage platform designed primarily for personal use and a small group of trusted users.

The application allows users to upload, organize, view, stream, search, share, and download photos and videos from anywhere through a web browser.

Unlike traditional cloud storage systems, files are automatically distributed across multiple connected storage providers while appearing as a single unified storage system to users.

Users never interact directly with storage providers.

The system manages storage allocation, backup, and retrieval automatically.

---

## 2. Goals

### Primary Goals

* Provide a single place to store photos and videos.
* Access media from any device.
* Stream videos without downloading them completely.
* Support bulk uploads.
* Support automatic backup of important media.
* Keep the application lightweight and fast.
* Allow storage expansion by adding provider accounts through the admin dashboard.

### Secondary Goals

* Support a future Android application using the same backend.
* Support additional storage providers in the future without major code changes.

---

## 3. Non-Goals

The following features are intentionally excluded from V1:

* Document editing
* Google Docs-style collaboration
* Shared folders
* Workspaces
* Team collaboration
* AI image recognition
* Facial recognition
* File version history
* Public file sharing
* Chat or comments
* Real-time collaboration

---

## 4. User Roles

### User

Can:

* Register account
* Login
* Upload photos
* Upload videos
* View own files
* Search own files
* Stream videos
* Download files
* Bulk download files
* Share files to other applications
* Delete files
* Restore files from trash
* View personal storage usage
* Manage favorites

Cannot:

* Access other users' files
* Access storage provider information
* Access admin dashboard

---

### Admin

Can perform all user actions.

Additional permissions:

* View all users
* View all uploaded files regardless of owner
* View file ownership
* View storage usage
* View storage nodes
* Add storage accounts
* Disable storage accounts
* Monitor backup status
* Monitor upload failures
* Access all user media for moderation, testing, and system administration

---

## 5. Supported Media Types

### Photos

Supported:

* JPG
* JPEG
* PNG
* WEBP

Maximum Size:

20 MB

---

### Videos

Supported:

* MP4
* MOV
* WEBM

Maximum Size:

2 GB

---

## 6. Storage Architecture

### Storage Nodes

Each connected provider account is treated as a Storage Node.

Examples:

* MEGA Account #1
* MEGA Account #2
* pCloud Account #1

The application never stores files directly.

Files are distributed among storage nodes automatically.

---

### Storage Allocation Strategy

Upload Flow:

1. User uploads file.
2. Storage Manager checks active storage nodes.
3. Storage Manager selects node with highest available storage.
4. File uploaded to selected node.
5. Metadata saved in database.

Users never know which provider stores the file.

---

### Future Expansion

Admin can add additional provider accounts through the dashboard.

No code changes should be required.

Adding a new account immediately increases available storage.

---

## 7. Backup System

### Backup Rules

All Images:

* Always backed up.

Videos:

* Back up only if file size ≤ 1 GB.

Videos larger than 1 GB:

* No backup.

---

### Backup Provider

Telegram

---

### Backup Flow

1. Upload succeeds.
2. File metadata saved.
3. Backup job created.
4. Background worker uploads file to Telegram.
5. Backup status updated.

---

### Retry Policy

Failed backup jobs:

* Retry up to 3 times.

After 3 failures:

* Mark as FAILED.

---

## 8. Thumbnail System

### Images

Upon upload:

1. Generate thumbnail.
2. Resize to approximately 300px width.
3. Compress image.
4. Upload thumbnail to same storage node.

---

### Videos

Upon upload:

1. Extract frame from video.
2. Generate thumbnail image.
3. Upload thumbnail to same storage node.

---

### Thumbnail Storage

Thumbnails are treated as files.

Each file may reference a thumbnail file.

Deleting a file automatically deletes its thumbnail.

---

## 9. Authentication

Authentication Method:

JWT

---

### Session Strategy

Access Token:

* Short-lived

Refresh Token:

* Long-lived
* Approximately 90 days

---

### User Experience

Users should remain logged in across sessions and browser restarts.

Frequent re-login should not be required.

---

## 10. Upload System

### Supported Features

* Single upload
* Bulk upload
* Drag and drop upload

---

### Upload Flow

1. User selects files.
2. Upload starts.
3. Upload status displayed.
4. Files appear in gallery after successful upload.
5. Thumbnail generation starts.
6. Backup job created.

---

### Upload Tracking

Upload jobs stored in database.

Possible states:

* UPLOADING
* SUCCESS
* FAILED

---

## 11. Gallery

Primary application interface.

Displays:

* Recent photos
* Recent videos
* Favorites
* Storage usage

---

### Gallery Features

* Grid layout
* Infinite scrolling
* Lazy loading
* Thumbnail previews

---

## 12. Search

V1 Search Fields:

* Filename
* Media Type
* Upload Date

No AI search in V1.

---

## 13. Video Streaming

Users should be able to watch videos without downloading entire files.

---

### Streaming Flow

1. User selects video.
2. Backend verifies permission.
3. Backend generates temporary provider access URL.
4. Browser streams directly from provider.

Video playback should support:

* Seeking
* Pause
* Resume
* Progressive loading

---

## 14. Downloads

### Single Download

User downloads one file.

---

### Bulk Download

User selects multiple files.

System packages and downloads selected files.

---

## 15. Sharing

Users can share media directly to other applications.

Examples:

* WhatsApp
* Telegram
* Instagram
* Gmail

The application should integrate with the browser/mobile sharing system.

---

## 16. Trash System

Deleted files are not immediately removed.

Delete Flow:

1. File moved to trash.
2. Hidden from gallery.
3. User can restore file.

---

### Permanent Deletion

After retention period:

* File removed from storage provider.
* Thumbnail removed.
* Backup removed.
* Metadata removed.

---

## 17. Admin Dashboard

### User Management

* View users
* View user storage usage
* View user uploads

---

### Storage Management

* View storage nodes
* Add storage nodes
* Disable storage nodes
* View node usage

---

### File Management

* View all files
* View file owners
* Search all files
* Open any file

---

### Backup Monitoring

* View backup status
* View failed backups
* Retry failed backups

---

### Upload Monitoring

* View failed uploads
* View upload logs

---

## 18. Performance Requirements

Application must:

* Load quickly on older phones
* Load quickly on older laptops
* Use lazy loading
* Use pagination/infinite scrolling
* Load thumbnails before originals
* Minimize network usage

---

## 19. Technical Stack

Frontend:

* Next.js

Backend:

* Next.js API Routes

Database:

* PostgreSQL

ORM:

* Prisma

Media Processing:

* FFmpeg

Storage:

* MEGA
* pCloud

Backup:

* Telegram

Hosting:

* Railway

---

## 20. Success Criteria

The product is considered successful when a user can:

1. Register.
2. Upload photos/videos.
3. View thumbnails instantly.
4. Stream videos smoothly.
5. Search files.
6. Share files.
7. Download files.
8. Access media from any device.
9. Stay logged in for extended periods.
10. Use the system without knowing or caring which storage provider holds the file.
