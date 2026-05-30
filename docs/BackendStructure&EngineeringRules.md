# Backend Structure & Engineering Rules

## Folder Structure

src/

app/

api/

auth/

files/

admin/

storage/

backups/

trash/

lib/

auth/

db/

storage/

manager.ts

providers/

mega.provider.ts

pcloud.provider.ts

telegram.provider.ts

services/

auth.service.ts

file.service.ts

upload.service.ts

storage.service.ts

backup.service.ts

jobs/

backup.worker.ts

trash-cleanup.worker.ts

storage-sync.worker.ts

types/

constants/

---

## Layer Responsibilities

### API Routes

Responsibilities:

* Validate request
* Authenticate user
* Call service
* Return response

Must NOT:

* Query database directly
* Call providers directly

---

### Services

Responsibilities:

* Business logic
* Validation
* Permissions
* Database operations

Must NOT:

* Know provider implementation details

---

### Storage Manager

Responsibilities:

* Select storage node
* Select provider adapter
* Route storage requests

Every upload must pass through Storage Manager.

---

### Provider Adapters

Responsibilities:

* Communicate with provider APIs

Must NOT:

* Query database
* Check permissions
* Handle authentication

---

### Workers

Responsibilities:

* Telegram backups
* Storage sync
* Trash cleanup

Workers run independently from API requests.

---

## Query Rules

Allowed:

```sql
LIMIT 50
Cursor Pagination
Indexed Queries
```

Forbidden:

```sql
SELECT *
No Pagination
N+1 Queries
```

---

## File Loading Rules

Gallery:

Always return:

```txt
Metadata
Thumbnail
```

Never:

```txt
Original Images
Original Videos
```

---

## Upload Rules

Flow:

User

↓

Storage Manager

↓

Provider

↓

Metadata Save

↓

Thumbnail Generation

↓

Backup Queue

---

## Security Rules

Users:

Can access only their own files.

Admin:

Can access every file.

Provider credentials:

Never sent to client.

Refresh tokens:

Always hashed.

Provider URLs:

Always temporary.

---

## Performance Rules

Must Use:

* Lazy Loading
* Infinite Scroll
* Cursor Pagination
* Thumbnail Previews

Avoid:

* Large Client Bundles
* Heavy Animations
* Unnecessary Re-renders

Target:

Gallery opens in under 1 second on average mobile connections.

---

## Coding Rule

If a developer or AI is unsure where code belongs:

Question:

"Does this contain business logic?"

Yes:

```txt
services/
```

No:

Continue evaluating.

Question:

"Does this communicate with provider APIs?"

Yes:

```txt
storage/providers/
```

Question:

"Does this choose a storage node?"

Yes:

```txt
storage/manager.ts
```

Question:

"Is this an HTTP endpoint?"

Yes:

```txt
api/
```

This rule must be followed throughout the project.
