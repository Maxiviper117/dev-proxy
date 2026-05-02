# Express.js

Express applications work with DevProxy whether they run in WSL, Docker, or natively on Windows.

## Start the server

Make sure your Express app listens on the expected port. For example, in `server.js` or `app.js`:

```js
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```

Start the server:

```bash
node server.js
```

## Register with DevProxy

From Windows:

```bash
devproxy add api.myapp --port 3000
```

This creates:

```text
https://api.myapp.local -> 127.0.0.1:3000, localhost:3000
```

## Trust the proxy (optional)

If your Express app needs to know it is behind a reverse proxy, enable `trust proxy` so headers such as `X-Forwarded-Proto` are respected:

```js
app.set("trust proxy", true);
```

## Open the site

```bash
devproxy open api.myapp
```

Or navigate to `https://api.myapp.local` in your browser.
