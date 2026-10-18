# Cooky: agent guide

Read docs/AGENT_RULES.md before writing code. Specs live in docs/ (index: docs/README.md). Build order: docs/ROADMAP.md.
Run `pnpm check` before handing off. Never commit or push unless asked.

## Next.js 16 gotchas (learned the hard way)

- `await headers()` returns a sealed `HeadersAdapter`: a `Headers` subclass that also has its own non-Headers `.headers` property. Never duck-type with `"headers" in x`; use `x instanceof Request`.
- In tests, mock `next/headers` with `nextHeaders()` from `tests/setup/next-headers.ts` (the real adapter), never with `new Headers()`. A native mock once hid a crash in every public Server Action.
- `proxy.ts` replaces `middleware.ts`. Error boundaries receive `retry` (not `reset`) and `error: unknown`.
- `cacheComponents` / PPR stay off: they're incompatible with the nonce CSP (see docs/ARCHITECTURE.md §2).
- Green tests aren't enough: exercise changed flows in `pnpm dev` before handing off.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
