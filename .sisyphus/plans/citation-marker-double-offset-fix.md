# Fix: CitationMarker Double Offset Bug

**Severity**: ⚠️ Low Risk — regression from audit fix #10
**File**: `apps/web/src/components/MessageBubble.tsx`
**Line**: 47

## Problem

`CitationMarker` already converts its `number` prop to 0-based inside its own `onClick` handler:
```tsx
// CitationMarker.tsx
onClick={() => onClick(number - 1)}  // passes 0-based index up
```

In `MessageBubble.tsx` line 47, the handler receives that already-0-based value (`num`) and subtracts 1 again:
```tsx
onClick={(num) => onCitationClick(chatResponse?.sources ?? [], num - 1)}
//                                                                ^^^ double subtraction
```

Result: citation [1] passes `index = -1` instead of `0`. Sidebar opens but no card highlights (`isActive` check never matches).

## Fix

**File**: `apps/web/src/components/MessageBubble.tsx`, line 47

Change:
```tsx
onClick={(num) => onCitationClick(chatResponse?.sources ?? [], num - 1)}
```

To:
```tsx
onClick={(num) => onCitationClick(chatResponse?.sources ?? [], num)}
```

`num` is already 0-based (CitationMarker already subtracted 1). No further subtraction needed.

## QA

- Click citation chip [1] → `activeCitation === 0` → first SourceCard `isActive: true` → card highlighted ✓
- Click citation chip [2] → `activeCitation === 1` → second SourceCard highlighted ✓
- Sidebar auto-scrolls to the correct card ✓
