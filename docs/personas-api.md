# Personas API — vibe-studio sidecar

Contract for persona CRUD + image storage. Implemented by the Node sidecar at
[server/](../server/), consumed by the vibe-studio web client.

- **Base URL:** `http://localhost:8787/api/v1`
- **Database:** Postgres `semantix-image-editor-db` (configured via `server/.env`)
- **Storage root (server disk):** `data/users/<user_id>/personas/<persona_id>/` (repo-relative, gitignored)
- **Static file mount:** `http://localhost:8787/static/users/<user_id>/personas/<persona_id>/<slot>.<ext>`
- **Auth:** none yet. `user_id` defaults to `"default"` until multi-user lands.
- **Transport:** the sidecar is intentionally thin. When the Python backend replaces it, the HTTP contract below stays the same — only the implementation language changes.

---

## Data model

```ts
type ImageSlot = 'face' | 'body' | 'ref_1' | 'ref_2' | 'ref_3'

type PersonaImage = {
  slot: ImageSlot
  url: string              // absolute URL the client can put into an <img src>
  mime: string             // "image/png" | "image/jpeg" | "image/webp"
  width: number
  height: number
  bytes: number
  updated_at: string       // ISO-8601
}

type Persona = {
  id: string               // UUID v4
  user_id: string          // "default" for now
  name: string
  facial_details: string   // free text, from vision model or hand-written
  body_shape: string       // free text
  images: PersonaImage[]   // 0..5 entries, keyed by slot
  created_at: string       // ISO-8601
  updated_at: string       // ISO-8601
}
```

### On-disk layout
```
data/
  users/
    <user_id>/
      personas/
        <persona_id>/
          face.png
          body.png
          ref_1.png
          ref_2.png
          ref_3.png
```

File extension follows the uploaded mime (`png` / `jpg` / `webp`). Only one file per slot — re-uploading replaces.

---

## Endpoints

### `GET /personas`

List personas for the current user.

**Query params**
- `user_id` — optional, defaults to `"default"`
- `limit` — optional, default `50`, max `200`
- `cursor` — optional, opaque string from prior response

**200 Response**
```json
{
  "personas": [ /* Persona[] */ ],
  "next_cursor": null
}
```

---

### `POST /personas`

Create a persona. Images are **not** uploaded here — use the image endpoint afterward with the returned `id`.

**Request body**
```json
{
  "user_id": "default",
  "name": "Aria",
  "facial_details": "…",
  "body_shape": "…"
}
```

**201 Response** — the full `Persona` (with `images: []`).

**400** — missing/empty `name`.

---

### `GET /personas/{id}`

**200 Response** — full `Persona`.
**404** — persona not found.

---

### `PATCH /personas/{id}`

Partial update of text fields only. Images are managed via the image endpoints.

**Request body** — any subset of:
```json
{ "name": "…", "facial_details": "…", "body_shape": "…" }
```

**200 Response** — updated `Persona`.
**404** — persona not found.

---

### `DELETE /personas/{id}`

Deletes the persona row **and** its on-disk image folder (`data/users/<user_id>/personas/<id>/`).

**204** — on success.
**404** — persona not found.

---

### `PUT /personas/{id}/images/{slot}`

Upload or replace the image at a slot. Multipart — single `file` field.

**Path params**
- `id` — persona id
- `slot` — one of `face | body | ref_1 | ref_2 | ref_3`

**Request** — `multipart/form-data`
- `file` — the image (required). Mime must start with `image/`. Max size: **8 MB**.

**200 Response**
```json
{
  "slot": "face",
  "url": "http://localhost:8787/static/users/default/personas/<id>/face.png",
  "mime": "image/png",
  "width": 1024,
  "height": 1024,
  "bytes": 812344,
  "updated_at": "2026-04-18T12:34:56Z"
}
```

**400** — wrong mime, file too large, invalid `slot`.
**404** — persona not found.
**413** — file exceeds 8 MB.

**Server behavior**
- Writes file to `data/users/<user_id>/personas/<id>/<slot>.<ext>` atomically (write temp + rename).
- Deletes any previously-stored file at the same slot but different extension (e.g. replacing `face.jpg` with `face.png`).
- Updates the `images` entry on the persona.
- Bumps `updated_at`.

---

### `DELETE /personas/{id}/images/{slot}`

Remove a single image slot.

**204** — on success (also if the slot was already empty).
**404** — persona not found.

---

### `GET /static/users/{user_id}/personas/{id}/{filename}`

Static file serving for the uploaded images. Clients should use the absolute URL returned in `PersonaImage.url`, not construct paths manually.

- `Cache-Control: private, max-age=3600`
- `Content-Type` — matches stored file.
- **404** on missing file.

---

## Error shape (applies to all 4xx/5xx)

```json
{
  "error": {
    "code": "persona_not_found",
    "message": "Persona <id> not found"
  }
}
```

Codes in use:
- `validation_failed` — request body failed schema check
- `persona_not_found`
- `invalid_slot`
- `unsupported_media_type`
- `file_too_large`
- `internal_error`

---

## Client flow (vibe-studio)

1. **Create:** `POST /personas` → get `persona.id`.
2. **Upload each image the user picked:** `PUT /personas/{id}/images/face` with multipart `file`. Repeat for `body`, `ref_1..3`.
3. **Store locally:** vibe-studio caches `Persona` rows in Dexie for offline list/edit UX. Source of truth is the server.
4. **Edit:** `PATCH /personas/{id}` for text, `PUT /personas/{id}/images/{slot}` to change an image, `DELETE /personas/{id}/images/{slot}` to clear one.
5. **Generation** (`applyPersonaToParams`): read `persona.images`, append each `PersonaImage.url` to the outgoing `input_images[]`.

## Open questions (not blocking server-side work, but flag before shipping)

- **Concurrency:** if two tabs edit the same persona, last write wins. Add `If-Match`/ETag later if that becomes a real problem.
- **Auth:** all endpoints currently trust the caller. Gate behind an auth middleware once users exist.
- **Cleanup:** orphaned image folders (persona deleted but folder survives a crash) — add a janitor sweep on server boot.
