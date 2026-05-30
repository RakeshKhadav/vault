# Personal Media Vault - API Specification v1

## Base URL

```http
/api/v1
```

All endpoints return JSON unless explicitly returning media streams.

---

# Authentication

## POST /auth/register

Create new account.

Request:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Success:

```json
{
  "message": "Account created"
}
```

Errors:

```json
400 Invalid email
400 Weak password
409 Email already exists
```

---

## POST /auth/login

Login user.

Request:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "user": {
    "id": "...",
    "email": "...",
    "role": "USER"
  }
}
```

Sets:

```txt
Access Token Cookie
Refresh Token Cookie
```

---

## POST /auth/refresh

Refresh session.

Response:

```json
{
  "success": true
}
```

Errors:

```json
401 Session expired
401 Invalid refresh token
```

---

## POST /auth/logout

Logout current device.

Response:

```json
{
  "success": true
}
```

---

## POST /auth/logout-all

Logout all devices.

Response:

```json
{
  "success": true
}
```

---

## GET /auth/me

Get current user.

Response:

```json
{
  "id": "...",
  "email": "...",
  "role": "USER",
  "storageUsed": 123456789
}
```

---

# Upload APIs

## POST /files/upload

Single or bulk upload.

Multipart Form Data:

```txt
files[]
```

Rules:

```txt
Image <= 20MB
Video <= 2GB
```

Response:

```json
{
  "jobIds": [
    "...",
    "..."
  ]
}
```

Edge Cases:

```json
413 File too large
415 Unsupported file type
507 Storage full
503 No active storage node
```

---

## GET /upload-jobs

Get upload history.

Query:

```txt
page
limit
status
```

Response:

```json
{
  "jobs": [],
  "hasMore": true
}
```

---

## GET /upload-jobs/:id

Get upload status.

Response:

```json
{
  "id": "...",
  "status": "SUCCESS",
  "error": null
}
```

---

# Files

## GET /files

Main gallery endpoint.

Query:

```txt
cursor
limit=50
type=image|video
favorite=true
search=text
```

Response:

```json
{
  "files": [],
  "nextCursor": "..."
}
```

Important:

```txt
Always return thumbnails.
Never return original media.
```

---

## GET /files/:id

Get file metadata.

Response:

```json
{
  "id": "...",
  "name": "...",
  "type": "image",
  "size": 12345,
  "uploadedAt": "...",
  "favorite": false
}
```

---

## GET /files/:id/thumbnail

Returns thumbnail image.

Content-Type:

```txt
image/jpeg
```

Errors:

```json
404 Thumbnail missing
403 Unauthorized
```

---

## GET /files/:id/view

Open image.

Returns:

```txt
Temporary Provider URL
```

Flow:

```txt
Permission Check
↓
Generate URL
↓
Return URL
```

---

## GET /files/:id/stream

Video streaming endpoint.

Requirements:

```txt
Supports HTTP Range Requests
Supports Seeking
```

Flow:

```txt
Permission Check
↓
Generate Temporary URL
↓
Return Stream
```

Errors:

```json
404 File not found
403 Unauthorized
503 Provider unavailable
```

---

## GET /files/:id/download

Download single file.

Response:

```txt
File Stream
```

---

## POST /files/download

Bulk download.

Request:

```json
{
  "fileIds": [
    "...",
    "..."
  ]
}
```

Response:

```json
{
  "downloads": [
    {
      "fileId": "...",
      "url": "..."
    }
  ]
}
```

Client downloads individually.

---

## DELETE /files/:id

Move file to trash.

Response:

```json
{
  "success": true
}
```

Actions:

```txt
Mark deleted_at
Hide from gallery
```

---

# Favorites

## POST /files/:id/favorite

Response:

```json
{
  "favorite": true
}
```

---

## DELETE /files/:id/favorite

Response:

```json
{
  "favorite": false
}
```

---

# Trash

## GET /trash

Response:

```json
{
  "files": []
}
```

---

## POST /trash/:id/restore

Restore file.

Response:

```json
{
  "success": true
}
```

---

## DELETE /trash/:id

Permanent delete.

Actions:

```txt
Delete Original
Delete Thumbnail
Delete Backup
Delete Metadata
```

Response:

```json
{
  "success": true
}
```

---

# Sharing

## POST /files/:id/share

Generate temporary share link.

Response:

```json
{
  "url": "...",
  "expiresAt": "..."
}
```

Expiration:

```txt
15 minutes
```

---

# Storage Usage

## GET /storage/usage

Response:

```json
{
  "usedBytes": 123456789
}
```

---

# Backup APIs

## GET /backups

Admin only.

Response:

```json
{
  "backups": []
}
```

---

## POST /backups/:id/retry

Retry failed backup.

Response:

```json
{
  "success": true
}
```

---

# Admin APIs

Admin only.

---

## GET /admin/users

Response:

```json
{
  "users": []
}
```

Pagination required.

---

## GET /admin/users/:id

Response:

```json
{
  "id": "...",
  "email": "...",
  "storageUsed": 123
}
```

---

## GET /admin/files

View all files.

Filters:

```txt
userId
type
search
```

Response:

```json
{
  "files": []
}
```

---

## GET /admin/files/:id

View any file metadata.

---

## GET /admin/files/:id/download

Download any file.

---

## DELETE /admin/files/:id

Delete any file.

---

# Storage Nodes

## GET /admin/storage-nodes

Response:

```json
{
  "nodes": []
}
```

Example:

```json
{
  "provider": "MEGA",
  "usedSpaceMb": 12000,
  "totalSpaceMb": 20000
}
```

---

## POST /admin/storage-nodes

Add new storage account.

Request:

```json
{
  "name": "Mega Main",
  "provider": "MEGA",
  "credentials": {
    "email": "...",
    "password": "..."
  }
}
```

Flow:

```txt
Encrypt Credentials
Test Connection
Save Node
```

---

## PATCH /admin/storage-nodes/:id

Enable / Disable node.

Request:

```json
{
  "isActive": false
}
```

---

## DELETE /admin/storage-nodes/:id

Remove node.

Rules:

```txt
Cannot remove node if active files exist.
```

---

## POST /admin/storage-nodes/:id/test

Test connection.

Response:

```json
{
  "success": true
}
```

---

# Performance Rules

## Gallery

Must use:

```txt
Cursor Pagination
```

Never:

```txt
SELECT *
```

---

## File Loading

Gallery returns:

```txt
Metadata
Thumbnail
```

Only.

Never originals.

---

## Images

Lazy load thumbnails.

---

## Videos

Use HTTP Range Requests.

Support:

```txt
Seek
Pause
Resume
```

---

## Uploads

Bulk uploads processed asynchronously.

---

## Background Jobs

Database-backed queue.

Handles:

```txt
Thumbnail Generation
Telegram Backup
Storage Sync
Trash Cleanup
```

---

# Automatic Scheduled Jobs

## Backup Retry

Every 15 minutes.

Retry failed backups.

Maximum:

```txt
3 attempts
```

---

## Trash Cleanup

Daily.

Delete files older than:

```txt
30 days
```

---

## Storage Sync

Every 6 hours.

Update:

```txt
used_space_mb
total_space_mb
```

for all nodes.

---

# Global Error Format

```json
{
  "success": false,
  "message": "Human readable message",
  "code": "ERROR_CODE"
}
```

Examples:

```json
{
  "success": false,
  "message": "Storage full",
  "code": "STORAGE_FULL"
}
```

```json
{
  "success": false,
  "message": "File not found",
  "code": "FILE_NOT_FOUND"
}
```
