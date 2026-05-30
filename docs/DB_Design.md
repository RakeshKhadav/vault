# Personal Media Vault - Database Design Document (PostgreSQL)

# 1. Database Philosophy

The database stores metadata only.

The database NEVER stores:

* Original images
* Original videos
* Thumbnails
* Backups

Actual files live in storage providers:

* MEGA
* pCloud

The database only tracks:

* Users
* Sessions
* Files
* Storage Nodes
* Upload Jobs
* Backup Status

This keeps PostgreSQL lightweight and fast.

---

# 2. Entity Relationship Diagram

```txt
users
 │
 ├── user_sessions
 │
 ├── upload_jobs
 │
 └── files
         │
         ├── thumbnail_file_id
         │
         ├── storage_node_id
         │
         ▼
   storage_nodes
         │
         ▼
      backups
```

---

# 3. ENUMS

## UserRole

```sql
USER
ADMIN
```

---

## ProviderType

```sql
MEGA
PCLOUD
```

Future:

```sql
TERABOX
```

---

## BackupStatus

```sql
PENDING
SUCCESS
FAILED
```

---

## UploadStatus

```sql
UPLOADING
SUCCESS
FAILED
```

---

# 4. users Table

Purpose:

Stores authentication and ownership information.

---

Schema

```sql
users

id UUID PRIMARY KEY

email VARCHAR(255) UNIQUE NOT NULL

password_hash TEXT NOT NULL

role UserRole NOT NULL DEFAULT 'USER'

created_at TIMESTAMP NOT NULL

updated_at TIMESTAMP NOT NULL
```

---

Indexes

```sql
UNIQUE(email)
```

---

Constraints

```sql
email NOT NULL

password_hash NOT NULL
```

---

Relationship

```txt
1 User
↓
Many Files

1 User
↓
Many Sessions

1 User
↓
Many Upload Jobs
```

---

# 5. user_sessions Table

Purpose:

Maintains long-lived login sessions.

Supports:

* Multiple devices
* Refresh tokens
* Logout all devices

---

Schema

```sql
user_sessions

id UUID PRIMARY KEY

user_id UUID NOT NULL

refresh_token_hash TEXT NOT NULL

device_name VARCHAR(255)

user_agent TEXT

last_active_at TIMESTAMP

expires_at TIMESTAMP NOT NULL

created_at TIMESTAMP NOT NULL
```

---

Foreign Keys

```sql
user_id
REFERENCES users(id)
ON DELETE CASCADE
```

---

Indexes

```sql
INDEX(user_id)

INDEX(expires_at)
```

---

Why?

```txt
user_id
```

Fast session lookup.

```txt
expires_at
```

Fast expired-session cleanup.

---

# 6. storage_nodes Table

Purpose:

Represents storage provider accounts.

Examples:

* MEGA Main
* MEGA Backup
* pCloud Main

Every account equals one node.

---

Schema

```sql
storage_nodes

id UUID PRIMARY KEY

name VARCHAR(255) NOT NULL

provider ProviderType NOT NULL

credentials_json TEXT NOT NULL

total_space_mb BIGINT DEFAULT 0

used_space_mb BIGINT DEFAULT 0

is_active BOOLEAN DEFAULT TRUE

last_sync_at TIMESTAMP

created_at TIMESTAMP NOT NULL

updated_at TIMESTAMP NOT NULL
```

---

Notes

credentials_json contains encrypted provider credentials.

Example:

```json
{
  "email": "...",
  "password": "..."
}
```

Encrypted before database insertion.

---

Indexes

```sql
INDEX(provider)

INDEX(is_active)
```

---

Why?

Storage Manager constantly searches:

```sql
WHERE is_active = true
```

---

# 7. files Table

Most important table.

Used by:

* Gallery
* Search
* Downloads
* Streaming
* Favorites
* Trash

Nearly every screen queries this table.

---

Schema

```sql
files

id UUID PRIMARY KEY

user_id UUID NOT NULL

storage_node_id UUID NOT NULL

thumbnail_file_id UUID NULL

file_name VARCHAR(255) NOT NULL

original_name VARCHAR(255) NOT NULL

provider_file_id VARCHAR(255) NOT NULL

mime_type VARCHAR(255) NOT NULL

file_size BIGINT NOT NULL

is_favorite BOOLEAN DEFAULT FALSE

deleted_at TIMESTAMP NULL

uploaded_at TIMESTAMP NOT NULL
```

---

Foreign Keys

```sql
user_id
REFERENCES users(id)
ON DELETE CASCADE
```

---

```sql
storage_node_id
REFERENCES storage_nodes(id)
```

---

```sql
thumbnail_file_id
REFERENCES files(id)
```

Self-reference.

---

Example

```txt
Vacation.jpg
↓
Thumbnail
```

Both are files.

---

Indexes

```sql
INDEX(user_id)

INDEX(storage_node_id)

INDEX(uploaded_at DESC)

INDEX(deleted_at)

INDEX(is_favorite)
```

---

Composite Index

```sql
INDEX(user_id, deleted_at)

INDEX(user_id, uploaded_at DESC)
```

---

Reason

Most common query:

```sql
SELECT *
FROM files
WHERE user_id = ?
AND deleted_at IS NULL
ORDER BY uploaded_at DESC
LIMIT 50
```

Composite index makes gallery fast.

---

Search Index

```sql
INDEX(file_name)
```

---

Future

Can be upgraded to:

```sql
GIN Index
```

for advanced search.

---

Constraints

```sql
file_size > 0
```

---

```sql
provider_file_id UNIQUE
```

Prevents duplicates.

---

# 8. backups Table

Purpose:

Tracks Telegram backups.

Only metadata.

Not backup files.

---

Schema

```sql
backups

id UUID PRIMARY KEY

file_id UUID NOT NULL

backup_provider VARCHAR(50)

backup_file_id VARCHAR(255)

status BackupStatus NOT NULL

error_message TEXT

created_at TIMESTAMP

updated_at TIMESTAMP
```

---

Foreign Key

```sql
file_id
REFERENCES files(id)
ON DELETE CASCADE
```

---

Indexes

```sql
INDEX(file_id)

INDEX(status)
```

---

Reason

Worker frequently queries:

```sql
WHERE status = 'FAILED'
```

or

```sql
WHERE status = 'PENDING'
```

---

# 9. upload_jobs Table

Purpose:

Tracks upload progress.

Useful for:

* Bulk uploads
* Failures
* Debugging

---

Schema

```sql
upload_jobs

id UUID PRIMARY KEY

user_id UUID NOT NULL

file_name VARCHAR(255)

status UploadStatus NOT NULL

error_message TEXT

created_at TIMESTAMP

updated_at TIMESTAMP
```

---

Foreign Key

```sql
user_id
REFERENCES users(id)
ON DELETE CASCADE
```

---

Indexes

```sql
INDEX(user_id)

INDEX(status)

INDEX(created_at DESC)
```

---

# 10. Soft Delete Strategy

Files are never deleted immediately.

Delete action:

```sql
deleted_at = CURRENT_TIMESTAMP
```

---

Active File

```sql
deleted_at IS NULL
```

---

Trash File

```sql
deleted_at IS NOT NULL
```

---

Permanent Cleanup

Daily scheduled job:

```sql
DELETE
WHERE deleted_at < NOW() - INTERVAL '30 DAYS'
```

---

# 11. Thumbnail Strategy

Original File

```txt
id = 1
```

Thumbnail

```txt
id = 2
```

Original:

```txt
thumbnail_file_id = 2
```

---

Benefits

No thumbnail table.

No thumbnail URLs.

Everything remains a file.

---

# 12. Performance Rules

Critical.

---

Gallery Queries

Always:

```sql
LIMIT 50
```

Never:

```sql
SELECT *
```

---

Pagination

Cursor-based.

Never offset-based for gallery.

---

Example

```sql
uploaded_at < cursor
```

---

Benefits

Fast even with:

```txt
100,000 files
```

---

# 13. Storage Manager Queries

Most common query:

```sql
SELECT *
FROM storage_nodes
WHERE is_active = true
ORDER BY
(total_space_mb - used_space_mb)
DESC
LIMIT 1
```

Used for node selection.

---

Recommended Generated Column

Future optimization:

```sql
free_space_mb
```

Generated from:

```sql
total_space_mb - used_space_mb
```

---

# 14. Scheduled Jobs

Runs outside request cycle.

---

Session Cleanup

Daily.

```sql
DELETE
FROM user_sessions
WHERE expires_at < NOW()
```

---

Backup Retry

Every 15 minutes.

```sql
status = FAILED
```

and

```txt
attempt_count < 3
```

---

Trash Cleanup

Daily.

Deletes:

* original file
* thumbnail
* backup

---

Storage Sync

Every 6 hours.

Updates:

```txt
used_space_mb
total_space_mb
```

from providers.

---

# 15. Database Size Expectations

10 Users

10,000 Files

Database Size:

Likely below:

```txt
50 MB
```

because media is not stored in PostgreSQL.

---

100,000 Files

Likely below:

```txt
500 MB
```

Still extremely manageable.

---

# 16. Final Tables

```txt
users

user_sessions

storage_nodes

files

backups

upload_jobs
```

Total Tables:

```txt
6
```

This schema is intentionally small, highly performant, easy to maintain, and optimized for a media-focused application where actual files live in external storage providers while PostgreSQL acts as the source of truth for metadata.
