# TrustLoop

**Customer Experience Resolution Engine** - FTC-Compliant Feedback Collection

TrustLoop helps businesses collect customer feedback using binary sentiment (Great! / I had an issue) and resolve concerns before they become negative reviews. Fully FTC-compliant: Google review links are always visible.

## Quick Start on Replit

### 1. Create New Replit

1. Go to [replit.com](https://replit.com) and create a new Repl
2. Choose "Import from GitHub" or "Blank Repl (Node.js)"
3. Copy all files from this `trustloop-standalone` folder

### 2. Set Up Database

In the Replit sidebar, go to **Database** and create a new PostgreSQL database.
Replit will automatically set the `DATABASE_URL` environment variable.

### 3. Configure Secrets

In the Replit sidebar, go to **Secrets** and add:

| Key | Value |
|-----|-------|
| `SESSION_SECRET` | Random 32+ character string |
| `ADMIN_EMAIL` | Your admin email (optional) |

### 4. Initialize Database

In the Shell, run:

```bash
npm install
npm run db:init
```

### 5. Start the App

Click the **Run** button. Your TrustLoop app is now live!

---

## Features

### FTC-Compliant Design

- **Binary Sentiment**: "Great!" or "I had an issue" - no confusing star ratings
- **Google Link Always Visible**: Customers can always access public review options
- **Resolution First**: Address concerns before they become negative reviews
- **No Review Gating**: We guide, we never block

### Business Dashboard

- Add customers and generate unique experience links
- Track customer journeys and sentiment
- View analytics and resolution rates
- Configure business settings

### Customer Experience Widget

- Clean, mobile-friendly interface
- Binary sentiment selection
- Positive → Guided to Google review
- Negative → Offered resolution options
- Google link visible on ALL steps (FTC compliance)

---

## Project Structure

```
trustloop-standalone/
├── src/
│   ├── server.js           # Express server entry point
│   ├── config/
│   │   └── database.js     # PostgreSQL connection
│   ├── routes/
│   │   ├── auth.js         # Login/Register/Logout
│   │   ├── dashboard.js    # Business dashboard
│   │   ├── experience.js   # Customer experience widget
│   │   └── api.js          # REST API endpoints
│   ├── middleware/
│   │   └── auth.js         # Authentication middleware
│   └── views/
│       ├── home.ejs        # Landing page
│       ├── error.ejs       # Error page
│       ├── auth/           # Login/Register pages
│       ├── dashboard/      # Dashboard pages
│       └── experience/     # Customer widget
├── db/
│   ├── schema.sql          # Database schema
│   └── init.js             # Database initializer
├── package.json
├── .replit                 # Replit configuration
├── replit.nix              # Nix packages
├── .env.example            # Environment template
└── README.md               # This file
```

---

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/experience/:token` | Customer experience widget |
| POST | `/experience/:token/sentiment` | Record sentiment |
| POST | `/experience/:token/google-click` | Track Google click |
| POST | `/experience/:token/resolution` | Accept resolution |

### Authenticated (requires login)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List all customers |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers/:id` | Get customer details |
| DELETE | `/api/customers/:id` | Delete customer |
| GET | `/api/analytics` | Get analytics data |
| POST | `/api/bulk-invite` | Create multiple customers |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session encryption key |
| `ADMIN_EMAIL` | No | Admin user email |
| `NODE_ENV` | No | `production` or `development` |
| `PORT` | No | Server port (default: 3000) |

---

## FTC Compliance Notes

TrustLoop is designed to be fully FTC-compliant:

1. **No Review Gating**: We never hide or delay access to Google reviews based on sentiment
2. **Binary Sentiment**: Simple "Great!" / "I had an issue" avoids gaming star ratings
3. **Always-Visible Option**: Google review link appears on EVERY step of the journey
4. **Resolution Focus**: Negative sentiment triggers resolution offers, not review blocking
5. **Database Constraint**: Schema enforces `google_link_shown = TRUE` for all terminal states

---

## Development

For local development:

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your values

# Initialize database
npm run db:init

# Start dev server with auto-reload
npm run dev
```

---

## License

MIT License - Free for commercial use

---

## Support

For issues or questions, please open a GitHub issue.
