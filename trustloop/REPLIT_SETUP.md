# TrustLoop Setup for Replit

## Quick Start (3 Steps)

### Step 1: Install Dependencies

In the Replit Shell, run:
```bash
cd trustloop/apps/web
npm install
```

### Step 2: Build the Widget

```bash
npm run build
```

This builds the React app to `public/trustloop/` directory.

### Step 3: Add Route to Server

Add this to your `server.js` to serve the TrustLoop widget:

```javascript
// TrustLoop Widget Route (add before other routes)
app.get('/experience/:token', async (req, res) => {
  const { token } = req.params;

  // Fetch customer data using token
  const customer = await pool.query(
    'SELECT c.*, us.business_name, s.google_review_link FROM customers c ' +
    'JOIN users u ON c.user_id = u.id ' +
    'LEFT JOIN user_settings us ON u.company_email = us.user_email ' +
    'LEFT JOIN subscriptions s ON u.company_email = s.email ' +
    'WHERE c.tracking_token = $1',
    [token]
  );

  if (customer.rows.length === 0) {
    return res.status(404).send('Link expired or invalid');
  }

  const data = customer.rows[0];

  // Inject config and serve widget
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>How was your experience? - ${data.business_name}</title>
      <script>
        window.__TRUSTLOOP_CONFIG__ = {
          businessName: "${data.business_name || 'Our Business'}",
          googleReviewUrl: "${data.google_review_link || '#'}",
          supportEmail: "${data.support_email || ''}",
          supportPhone: "${data.support_phone || ''}"
        };
      </script>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/trustloop/assets/index.js"></script>
      <link rel="stylesheet" href="/trustloop/assets/index.css">
    </body>
    </html>
  `);
});
```

---

## Development Mode

To develop with hot reload:

```bash
cd trustloop/apps/web
npm run dev
```

This starts a dev server on port 3001 with API proxy to port 5000.

---

## File Structure After Build

```
public/
├── trustloop/
│   └── assets/
│       ├── index.js      ← React widget bundle
│       └── index.css     ← Tailwind styles
```

---

## Replit Workflow

1. **Development**: Edit files in `trustloop/apps/web/src/`
2. **Build**: Run `npm run build` in `trustloop/apps/web/`
3. **Deploy**: The built files are in `public/trustloop/` - Replit serves them automatically
4. **Restart**: Click "Run" to restart the main server

---

## Environment Variables Needed

Make sure these are in your Replit Secrets:

```
DATABASE_URL=...
SESSION_SECRET=...
ADMIN_EMAIL=...
```

---

## Switching from Old Widget to TrustLoop

**Old URL**: `/r/:token` → `views/star-filter.html`
**New URL**: `/experience/:token` → TrustLoop React Widget

You can run both side-by-side during migration!
