# Storage Provider Contract

## Purpose

Every storage provider must implement the exact same interface.

Business logic must never depend on provider-specific APIs.

---

## Provider Interface

interface StorageProvider {

testConnection()

upload()

download()

delete()

generateViewUrl()

generateStreamUrl()

generateDownloadUrl()

getStorageInfo()

}

---

## testConnection()

Purpose:

Verify provider credentials.

Returns:

```json
{
  "success": true
}
```

Used when:

* Adding node
* Updating credentials

---

## upload()

Input:

```txt
File
Node Credentials
```

Output:

```json
{
  "providerFileId": "...",
  "size": 12345
}
```

Requirements:

* Must support images
* Must support videos
* Must return provider identifier

---

## download()

Input:

```txt
Provider File ID
```

Output:

```txt
Readable Stream
```

---

## delete()

Input:

```txt
Provider File ID
```

Output:

```json
{
  "success": true
}
```

---

## generateViewUrl()

Used for images.

Returns temporary access URL.

Requirements:

* Expiring URL
* Not permanent

---

## generateStreamUrl()

Used for videos.

Requirements:

* Supports HTTP Range Requests
* Supports Seeking
* Supports Pause/Resume

Returns:

```txt
Temporary URL
```

---

## generateDownloadUrl()

Returns temporary URL for downloads.

Expiration:

15 minutes.

---

## getStorageInfo()

Returns:

```json
{
  "totalSpaceMb": 20000,
  "usedSpaceMb": 5000
}
```

Used by:

* Storage Dashboard
* Storage Manager

---

## Provider Rules

Provider implementation must not:

* Access database
* Access authentication
* Access business logic

Provider only handles storage operations.

---

## Supported Providers

V1:

```txt
MEGA
pCloud
```

Future:

```txt
TeraBox
Dropbox
Google Drive
```

Adding a provider should only require creating a new adapter.
