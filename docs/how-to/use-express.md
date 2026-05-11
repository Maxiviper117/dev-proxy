---
title: Use DevProxy with Express
description: Run an Express app behind a stable DevProxy domain.
---

# Use DevProxy with Express

Express applications work with DevProxy whether they run in WSL, Docker, or natively on Windows.

## Start the server

Make sure the app listens on the expected port:

```js
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```

Start it:

```bash
node server.js
```

## Register with DevProxy

```bash
devproxy add api.myapp --port 3000
```

This creates:

```text
https://api.myapp.local -> 127.0.0.1:3000, localhost:3000
```

## Optional proxy headers

If your app needs to know it is behind a reverse proxy:

```js
app.set("trust proxy", true);
```

