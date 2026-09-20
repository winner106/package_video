# External APIs

Patterns for calling external HTTP APIs from Tauri applications.

> **Note:** Rust HTTP client dependencies are not installed by default. Install `reqwest` (Rust) and optionally `tauri-plugin-keyring` (for token storage) when your app needs backend API calls. For frontend HTTP calls inside the Tauri webview, use `tauri-plugin-http`.

## Rust vs Frontend: When to Use Which

**Default recommendation: Use Rust backend (reqwest)**

| Approach         | Pros                                           | Cons                            |
| ---------------- | ---------------------------------------------- | ------------------------------- |
| Rust (reqwest)   | CORS bypass, secure token storage, type safety | More code per endpoint          |
| Frontend (fetch) | Less boilerplate, familiar API                 | CORS restrictions, exposed keys |

### Use Rust Backend For

- All authenticated API calls (keeps tokens out of WebView)
- APIs with CORS restrictions (desktop apps bypass CORS from Rust)
- Calls requiring response caching to local storage
- Production applications

### Use Frontend Fetch For

- Public APIs with no authentication
- Rapid prototyping before moving to Rust
- Third-party SDKs requiring browser context

### Use Tauri HTTP Plugin For

- APIs blocked by browser CORS/CSP in production builds
- Calls that must work from the webview without exposing browser fetch limitations
- Desktop-only integrations where a simple frontend wrapper is enough

## Setup

```bash
# Rust HTTP client
cd src-tauri && cargo add reqwest --features json,rustls-tls
```

## Tauri HTTP Plugin (Frontend Fetch)

Use the Tauri HTTP plugin when you need HTTP from the webview in production builds.
It runs requests through Rust (bypassing browser CORS) but requires capabilities.

### 1) Add dependencies

```bash
# frontend
pnpm -C apps/manager-ui add @tauri-apps/plugin-http

# Rust (src-tauri/Cargo.toml)
tauri-plugin-http = { version = "2.5.6", features = ["unsafe-headers"] }
```

### 2) Register the plugin

```rust
// apps/manager-ui/src-tauri/src/lib.rs
tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    // ...
    .run(tauri::generate_context!())?;
```

### 3) Allow permissions + URL scope

```json
// apps/manager-ui/src-tauri/capabilities/default.json
{
  "permissions": [
    "http:allow-fetch",
    "http:allow-fetch-send",
    "http:allow-fetch-read-body",
    "http:allow-fetch-cancel",
    "http:allow-fetch-cancel-body",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "http://localhost:*" },
        { "url": "http://127.0.0.1:*" },
        { "url": "http://192.168.*:*" }
      ]
    }
  ]
}
```

### 4) Use plugin fetch in the app

```ts
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const httpFetch = isTauri ? tauriFetch : fetch

const response = await httpFetch('http://localhost:18080/health')
```

### Common pitfalls

- Version mismatch: the JS plugin and Rust plugin must be the same major/minor (e.g. 2.5.x).
  Mismatches can trigger "permission not found" or missing commands such as
  `http.fetch_cancel_body not allowed`.
- Missing permissions: `fetch_cancel_body` is required for streamed responses. Add
  `http:allow-fetch-cancel-body`.
- URL allow list: the HTTP plugin enforces URL scopes in capabilities. Add every origin you need.
- CSP: browser `fetch` is still subject to CSP and CORS. Use the plugin when those block requests.

For secure token storage, see the Authentication section below.

## Architecture Pattern

Follow the same pattern as local data: Tauri commands wrap API calls, TanStack Query provides caching.

```
React Component → TanStack Query → Tauri Command (reqwest) → External API
```

### Rust Command

```rust
use reqwest;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct User {
    pub id: u32,
    pub name: String,
    pub email: String,
}

#[tauri::command]
#[specta::specta]
pub async fn fetch_user(user_id: u32) -> Result<User, String> {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("https://api.example.com/users/{user_id}"))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    response.json::<User>()
        .await
        .map_err(|e| format!("Parse error: {e}"))
}
```

### React Service

```typescript
// src/services/users.ts
export const userQueryKeys = {
  all: ['users'] as const,
  user: (id: number) => [...userQueryKeys.all, id] as const,
}

export function useUser(userId: number) {
  return useQuery({
    queryKey: userQueryKeys.user(userId),
    queryFn: async () => unwrapResult(await commands.fetchUser(userId)),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: Partial<User> }) => {
      const result = await commands.updateUser(userId, data)
      if (result.status === 'error') throw new Error(result.error)
      return result.data
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.user(userId) })
    },
  })
}
```

## Authentication

### Token Storage Options

| Option                    | Security            | Use When                          |
| ------------------------- | ------------------- | --------------------------------- |
| `keyring` crate           | High (OS keychain)  | API tokens, credentials           |
| `tauri-plugin-stronghold` | High (encrypted DB) | Multiple secrets, encryption keys |
| `tauri-plugin-store`      | Low (plain JSON)    | Non-sensitive data only           |

For OS keychain access, use the `keyring` crate directly:

```bash
cd src-tauri && cargo add keyring
```

```rust
use keyring::Entry;

#[tauri::command]
#[specta::specta]
pub fn save_auth_token(token: String) -> Result<(), String> {
    let entry = Entry::new("myapp", "auth_token")
        .map_err(|e| format!("Keyring error: {e}"))?;
    entry.set_password(&token)
        .map_err(|e| format!("Failed to save token: {e}"))
}

#[tauri::command]
#[specta::specta]
pub fn get_auth_token() -> Result<Option<String>, String> {
    let entry = Entry::new("myapp", "auth_token")
        .map_err(|e| format!("Keyring error: {e}"))?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get token: {e}")),
    }
}
```

### Authenticated Requests

```rust
#[tauri::command]
#[specta::specta]
pub async fn fetch_protected_data() -> Result<Data, String> {
    let entry = Entry::new("myapp", "auth_token")
        .map_err(|e| format!("Keyring error: {e}"))?;
    let token = entry.get_password()
        .map_err(|_| "Not authenticated")?;

    let client = reqwest::Client::new();
    client
        .get("https://api.example.com/protected")
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?
        .json::<Data>()
        .await
        .map_err(|e| format!("Parse error: {e}"))
}
```

## Error Handling

See [error-handling.md](./error-handling.md) for complete patterns. Key points for API calls:

```typescript
// Configure retry for network errors, not validation errors
const { data } = useQuery({
  queryKey: ['api-data'],
  queryFn: fetchData,
  retry: (failureCount, error) => {
    if (error.message.includes('validation')) return false
    return failureCount < 3
  },
})
```

## Offline Handling

For apps that need to work offline, cache API responses to SQLite:

```rust
#[tauri::command]
#[specta::specta]
pub async fn fetch_with_cache(app: tauri::AppHandle, id: u32) -> Result<Data, String> {
    // Try network first
    match fetch_from_api(id).await {
        Ok(data) => {
            cache_to_db(&app, &data)?;  // Cache for offline
            Ok(data)
        }
        Err(_) => {
            // Fallback to cache on network error
            load_from_cache(&app, id)
        }
    }
}
```

See [data-persistence.md](./data-persistence.md) for SQLite setup.

## Quick Reference

| Task            | Pattern                                  |
| --------------- | ---------------------------------------- |
| Basic API call  | Rust command with reqwest                |
| Caching         | TanStack Query (frontend) or SQLite      |
| Token storage   | `keyring` crate (OS keychain)            |
| Type safety     | tauri-specta (same as local commands)    |
| Error handling  | Result types, see error-handling.md      |
| Offline support | Cache to SQLite, fallback on network err |
