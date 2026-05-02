# Next.js

Next.js dev server can be served through DevProxy by binding to `0.0.0.0` and registering the port with DevProxy.

## Start the server

From your Next.js project directory:

```bash
pnpm dev --hostname 0.0.0.0 --port 3000
```

Or with npm:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

## Register with DevProxy

From Windows:

```bash
devproxy add web.myapp --port 3000
```

This creates:

```text
https://web.myapp.local -> 127.0.0.1:3000, localhost:3000
```

## Configure Next.js (optional)

If you need Next.js to generate absolute URLs using the `.local` domain, set the environment variable:

```text
NEXT_PUBLIC_SITE_URL=https://web.myapp.local
```

You can place this in a `.env.local` file in your project root:

```text
NEXT_PUBLIC_SITE_URL=https://web.myapp.local
```

## Open the site

```bash
devproxy open web.myapp
```

Or navigate to `https://web.myapp.local` in your browser.
