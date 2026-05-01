# Laravel

DevProxy works with Laravel running in WSL, Docker, or natively on Windows.

## Start the server

From your Laravel project directory:

```bash
php artisan serve --port=8000
```

## Register with DevProxy

From Windows, register a domain for the service:

```bash
devproxy add api.myapp --port 8000
```

This creates:

```text
https://api.myapp.local -> localhost:8000, 127.0.0.1:8000
```

## Configure Laravel

Update your `.env` so Laravel generates correct URLs and accepts cookies on the `.local` domain:

```text
APP_URL=https://api.myapp.local
SESSION_DOMAIN=.myapp.local
```

Clear the config cache if you are caching configuration files:

```bash
php artisan config:clear
```

## Open the site

```bash
devproxy open api.myapp
```

Or navigate to `https://api.myapp.local` in your browser.
