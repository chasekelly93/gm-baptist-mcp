# gm-baptist-mcp Development Conventions

## Adding New GHL Tools

1. **Tag the description** with `[Agency]` or `[Location]` to indicate which credential level the tool uses:
   - `[Agency]` = uses `agencyClient()` (GHL_API_KEY) — for cross-location operations like listing sub-accounts, managing locations, billing
   - `[Location]` = uses `locationClient(locationId)` (GHL_LOCATION_API_KEY for primary location, GHL_API_KEY for others) — for location-scoped data like contacts, conversations, calendars

2. **Wrap the handler** with `ghlWrap()` so errors return clear diagnostics (HTTP method, URL, status code, response body)

3. **Never send `skip: 0`** as a query param — GHL rejects it with 422 on many endpoints. Only include `skip` when it's non-zero:
   ```js
   const params = { locationId, limit };
   if (skip) params.skip = skip;
   ```

4. **Use the correct client** based on the GHL endpoint:
   - `agencyClient()` for `/locations/search`, `/locations/` CRUD, `/users/search`, billing
   - `locationClient(locationId)` for everything scoped to a specific location

## Adding New DO Tools

1. Wrap the handler with `doWrap()` for error diagnostics
2. DO tools are prefixed with `do_` in the tool name

## Environment Variables

- `GHL_API_KEY` — Agency-level Private Integration Token
- `GHL_LOCATION_API_KEY` — Location-level Private Integration Token (for PRIMARY_LOCATION_ID)
- `PRIMARY_LOCATION_ID` — The location ID that uses GHL_LOCATION_API_KEY
- `COMPANY_ID` — Agency company ID
- `DIGITALOCEAN_API_TOKEN` — DO API token (full access)
