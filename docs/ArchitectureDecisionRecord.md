# Architecture Decision Record (ADR)

## Project Name

Personal Media Vault

---

## Core Philosophy

The application is a lightweight personal media cloud focused exclusively on photos and videos.

The system should remain:

* Fast
* Lightweight
* Easy to maintain
* Easy to extend

Enterprise complexity should be avoided unless required by real usage.

---

## Decision 1: Next.js Monolith

Decision:

Use a single Next.js application for frontend and backend.

Chosen:

```txt
Next.js
PostgreSQL
Prisma
```

Rejected:

```txt
React + Spring Boot
Microservices
Separate frontend/backend repos
```

Reason:

* Smaller codebase
* Faster development
* Easier deployment
* Shared API for future Android app

---

## Decision 2: PostgreSQL Instead of MongoDB

Reason:

Data is relational.

Relationships:

```txt
Users
↓
Files
↓
Storage Nodes
↓
Backups
```

SQL queries are more natural.

---

## Decision 3: Storage Node Architecture

Files must never know provider details.

Bad:

```txt
File
↓
Stored In MEGA
```

Good:

```txt
File
↓
Stored In Storage Node
```

Storage Node:

```txt
MEGA Account #1
pCloud Account #1
```

Benefits:

* Add accounts without code changes
* Add providers without rewriting business logic

---

## Decision 4: Provider Adapter Pattern

All providers must implement the same contract.

Application code must never directly call provider APIs.

Only adapters communicate with providers.

---

## Decision 5: Thumbnails Are Files

No thumbnail table.

No thumbnail storage service.

A thumbnail is simply another file.

Benefits:

* Consistent architecture
* Easier deletion
* Easier migration
* Easier backup management

---

## Decision 6: Metadata Only Database

Database stores:

* Users
* Files
* Sessions
* Storage Nodes
* Upload Jobs
* Backup Status

Database never stores:

* Images
* Videos
* Thumbnails

---

## Decision 7: Admin Access

Admin can:

* View all files
* Download all files
* Share all files
* Delete all files
* View all users

This is intentional.

---

## Decision 8: Streaming Strategy

Videos stream directly from storage providers using temporary access URLs.

The browser performs chunked loading via HTTP range requests.

The backend should not permanently proxy video traffic.

---

## Decision 9: Backup Strategy

Primary Storage:

* MEGA
* pCloud

Backup:

* Telegram

Rules:

Images:
Always backed up.

Videos:
Back up only if <= 1GB.

Retry:
Maximum 3 attempts.

---

## Decision 10: Performance First

Always prioritize:

* Thumbnail loading
* Lazy loading
* Cursor pagination
* Infinite scrolling

Never optimize prematurely with:

* Redis
* Elasticsearch
* Microservices
* Kubernetes
