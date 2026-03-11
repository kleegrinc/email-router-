# n8n Inbound Message Webhook Workflow

When `N8N_INBOUND_WEBHOOK_URL` is set, the Next.js app only forwards the GHL inbound payload to n8n and returns immediately. n8n is responsible for:

1. Reading **Trigger** and **Token** from Supabase
2. Applying filter logic (optional GHL API calls for contact/tags)
3. POSTing to each trigger’s `targetUrl` with the transformed payload

This avoids 504s and connection-pool issues on Render by moving DB and concurrency to n8n.

---

## 1. Incoming payload (from Next.js → n8n)

The body your n8n Webhook node receives is the **raw GHL webhook** body, e.g.:

```json
{
  "type": "InboundMessage",
  "locationId": "kF4NJ5gzRyQF2gKFD34G",
  "body": "<div>...</div>",
  "contactId": "3bN9f8LYJFG8F232XMUbfq",
  "conversationId": "yCdNo6pwyTLYKgg6V2gj",
  "dateAdded": "2024-01-12T12:59:04.045Z",
  "direction": "inbound",
  "messageType": "Email",
  "emailMessageId": "...",
  "from": "Name <email@example.com>",
  "threadId": "...",
  "subject": "Order Confirmed",
  "to": "user@example.com",
  "conversationProviderId": "..."
}
```

Use `locationId` for all DB and GHL API calls.

---

## 2. Supabase: Triggers and Token

- **Triggers**  
  Table: `Trigger`  
  Query: rows where  
  - `locationId` = incoming `locationId`  
  - `eventType` ≠ `'DELETED'`  
  - `key` = `'email_router'`  

  Columns you need: `id`, `ghlId`, `locationId`, `key`, `filters` (JSON), `targetUrl`, `eventType`.

- **Token**  
  Table: `Token`  
  Query: one row where `locationId` = incoming `locationId` (e.g. `LIMIT 1`).  
  Use `accessToken` for GHL API and for the `Authorization: Bearer <accessToken>` header when calling `targetUrl`.

If no token or no triggers, finish the workflow (e.g. “No triggers” / “No token”).

---

## 3. GHL API (for filters that need contact/tags)

Only needed when a trigger has `filters` that use `has_tag` / `doesn't_has_tag` (contact tags).

- **Get contact**  
  `GET https://services.leadconnectorhq.com/contacts/{{contactId}}`  
  Headers: `Authorization: Bearer {{accessToken}}`, `Version: 2021-07-28`  
  Use `contact.tags` (array of tag names) for tag filters.

- **Get location tags**  
  `GET https://services.leadconnectorhq.com/locations/{{locationId}}/tags`  
  Headers: `Authorization: Bearer {{accessToken}}`, `Version: 2021-07-28`  
  Use to resolve tag names if your filter stores tag IDs.

---

## 4. Filter logic (same as app)

For each trigger, if `filters` is present, evaluate each filter; if any fails, skip this trigger.

- **`field: 'has_tag'`**  
  - Compare `filter.value` (tag name or ID) with contact’s tags (from GHL contact API).  
  - Operators: `==` / `string-contains-any-of` / `array-contains` → contact has that tag; `!=` → contact does not have it; `has_value` → contact has at least one tag; `has_no_value` → contact has no tags.

- **Other fields (e.g. `from`, `subject`, `body`)**  
  - `has_value`: value is not empty after trimming.  
  - `string-contains-any-of`: actual value (string, lowercased) contains any of the target strings (array or single value).  
  - For `from`, support "Name <email>" by matching name or email separately if the full string doesn’t match.

Only run the trigger’s action (POST to `targetUrl`) when all filters pass.

---

## 5. Outgoing payload to `targetUrl`

Build a single JSON body and POST it to the trigger’s `targetUrl` with:

- Headers: `Content-Type: application/json`, `Version: 2021-07-28`, `Authorization: Bearer {{accessToken}}`

Body shape (same as current app):

```json
{
  "type": "InboundMessage",
  "locationId": "...",
  "body": "<html>...",
  "contactId": "...",
  "conversationId": "...",
  "dateAdded": "...",
  "direction": "inbound",
  "messageType": "Email",
  "emailMessageId": "...",
  "from": "email@example.com",
  "threadId": "...",
  "subject": "...",
  "to": "...",
  "conversationProviderId": "...",
  "has_tag": "tag_name_or_fallback"
}
```

- `from`: use only the email part when the incoming `from` is `"Name <email>"`.
- `to`: if incoming `to` is an array, use the first element.
- `has_tag`: set from the tag filter value that matched (or a default like `"tag"`) when you use tag-based filters.

---

## 6. Suggested n8n flow (high level)

1. **Webhook** (POST) – receive the inbound body.
2. **Supabase** – get `Trigger` rows for `locationId`, `eventType` ≠ `'DELETED'`, `key` = `'email_router'`.
3. **Supabase** – get `Token` for `locationId`; take `accessToken`.
4. **Loop** over each trigger (e.g. SplitOut + Loop, or “Execute Workflow” per trigger).
5. For each trigger:  
   - If it has `filters` that need contact/tags: **HTTP Request** get contact, **HTTP Request** get tags.  
   - **Code** (or equivalent) to run filter logic; if any filter fails, skip to next trigger.  
   - Build the outgoing payload (transform `from`/`to`/`has_tag` as above).  
   - **HTTP Request** POST to `trigger.targetUrl` with the payload and `Authorization: Bearer {{accessToken}}`.

You can run the “per-trigger” part in parallel in n8n if you want (e.g. multiple branches or sub-workflows), which helps with concurrency.

---

## 7. Config in this repo

- In **Render** (and locally if you test forward): set `N8N_INBOUND_WEBHOOK_URL` to your n8n webhook URL (e.g. `https://your-n8n.com/webhook/inbound-email`).
- In **n8n**: add a **Webhook** node (POST), get the production URL, and use that as `N8N_INBOUND_WEBHOOK_URL`.
- Supabase: use the same DB (connection string / pooler) as the app; n8n’s connection pool is separate, so it won’t compete with the Next.js app for connections.

After this, the Next.js app only validates and forwards; n8n handles Supabase and concurrent trigger execution.
