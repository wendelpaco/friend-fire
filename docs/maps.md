# Maps

Known map **ids** (see `src/domains/world/maps/registry.ts` → `MAP_IDS` / `listMaps()` / `getMapById`):

| id | Display name | File |
|----|--------------|------|
| `dust` | Dust FF | `maps/dust.ts` (default) |
| `favela` | Favela FF | `maps/favela.ts` |
| `yard` | Yard FF | `maps/yard.ts` |

## Client helpers

```ts
import {
  getMapById,
  listMaps,
  getLastMapId,
  setLastMapId,
  LAST_MAP_STORAGE_KEY, // "ff_last_map"
} from "@/domains/world";

setLastMapId("favela");       // on map picker change
const last = getLastMapId();  // → "dust" if unset / invalid
const map = getMapById(last);
```

- **Solo / quick play:** `/play?map=dust|favela|yard` or last pick from `ff_last_map`.
- **Rooms:** create with `mapId`; guests load map from server state.
- **Invite link:** `/play?mode=room&code=XXXXXX&host=0` via `buildInviteUrl` / `CopyInviteLink`.

Call **`setLastMapId(id)`** from any map select UI (RoomPanel create, solo pick).
