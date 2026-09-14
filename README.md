# HelpDesk — Internal Campus IT Ticketing System

A university IT support portal where students/faculty log in via Microsoft Entra ID (Active Directory) to submit tickets, and technicians claim and resolve them. Tickets are auto-categorized by Google Gemini, and new tickets trigger a SendGrid email to technicians.

Live deployment: https://helpdesk-badproject1.duckdns.org/helpdesk/

## Architecture Overview

Client (browser or curl/Postman)
↓
Nginx (reverse proxy, /helpdesk path, Let's Encrypt SSL)
↓
Express REST API (Node.js), which connects to:
- Static frontend (public/index.html) served at /helpdesk/
- Auth: Microsoft Entra ID (MSAL) → app-issued JWT (RBAC: STUDENT / FACULTY / TECHNICIAN / ADMIN)
- Prisma ORM → MySQL (Users, Tickets, Categories, TicketUpdates)
- Google Gemini API → auto-categorizes ticket text on creation
- SendGrid API → emails technicians when a ticket is created
- Azure Key Vault → fetches DB connection string, JWT secret, Gemini/SendGrid keys, and the AD client secret at runtime via the VM's Managed Identity (no production secrets stored in .env)

## Peer API Requirement - Waived

Per the instructor's note on the project brief, the Service-to-Service (Peer API) requirement is not required for this project. It is replaced by the External Integration requirement below, satisfied via two independent public APIs (Gemini + SendGrid).

## External Integrations

- Google Gemini API: Classifies each new ticket's description into a category (Hardware, Software, Network, Account, Other)
- SendGrid API: Emails technicians when a new ticket is submitted

## Authentication

Login is handled entirely through Microsoft Entra ID (Azure AD) using MSAL Node - no email/password accounts exist.

1. GET /helpdesk/api/auth/login - redirects to Microsoft's login page
2. User signs in with their university account (@au.edu) - any account in the university's tenant can log in
3. Microsoft redirects back to GET /helpdesk/api/auth/callback
4. The backend finds or creates a User row (keyed on AD Object ID) and issues the app's own JWT
5. The frontend receives the token via a redirect to /helpdesk/?token=... and stores it; API clients (curl/Postman) receive it the same way and should copy it manually

## Testing the Live System

### Option A - Web frontend (easiest)

1. Visit https://helpdesk-badproject1.duckdns.org/helpdesk/
2. Click Login with Microsoft, sign in with any @au.edu account
3. Submit a ticket, see it auto-categorized
4. If your account is promoted to TECHNICIAN or ADMIN in the database, you'll also see Claim/Status controls on tickets

### Option B - Direct API testing (curl / Postman)

Since AD login is a browser redirect flow, curl/Postman can't complete login on their own. Get a token first via the browser, then use it manually.

1. Get a token: open https://helpdesk-badproject1.duckdns.org/helpdesk/api/auth/login in a browser, sign in, then copy the token value from the URL you're redirected to (?token=...).

2. Get your user info:
```
curl https://helpdesk-badproject1.duckdns.org/helpdesk/api/auth/me -H "Authorization: Bearer YOUR_TOKEN"
```

3. Create a ticket:
```
curl -X POST https://helpdesk-badproject1.duckdns.org/helpdesk/api/tickets -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" -d '{"title":"Wifi not working","description":"Cannot connect to campus wifi in the library"}'
```

4. List tickets:
```
curl https://helpdesk-badproject1.duckdns.org/helpdesk/api/tickets -H "Authorization: Bearer YOUR_TOKEN"
```

5. Claim a ticket (requires a TECHNICIAN or ADMIN account):
```
curl -X PATCH https://helpdesk-badproject1.duckdns.org/helpdesk/api/tickets/TICKET_ID/claim -H "Authorization: Bearer YOUR_TOKEN"
```

6. Update ticket status (requires a TECHNICIAN or ADMIN account):
```
curl -X PATCH https://helpdesk-badproject1.duckdns.org/helpdesk/api/tickets/TICKET_ID/status -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" -d '{"status":"IN_PROGRESS"}'
```

## Secrets Management

No production secrets are stored in .env. At startup, app.js calls services/keyvault.js, which authenticates to Azure Key Vault using the VM's system-assigned Managed Identity (no credentials needed) and fetches: DATABASE-URL, JWT-SECRET, GEMINI-API-KEY, SENDGRID-API-KEY, SENDGRID-FROM-EMAIL, AZURE-AD-CLIENT-SECRET.

.env is only used as a local-development fallback when AZURE_KEY_VAULT_URL isn't configured.

## Setup (local development)

1. Install dependencies: npm install
2. Copy .env.example to .env and fill in a local MySQL connection string, a JWT secret, and your Gemini/SendGrid keys.
3. Run migrations: npx prisma migrate dev
4. Start the dev server: npm start
5. Visit http://localhost:3000/helpdesk/ or health check GET /helpdesk/api/health

## Deployment

- Infrastructure: Azure VM (Ubuntu 24.04 LTS), hardened with UFW (ports 22/80/443 only)
- Process manager: PM2, auto-restarts on crash and auto-starts on VM reboot (pm2 startup + pm2 save)
- Reverse proxy: Nginx, routing /helpdesk to the Node app on port 3000
- Domain: Free DuckDNS subdomain (helpdesk-badproject1.duckdns.org), since Let's Encrypt requires a real domain rather than a bare IP
- SSL: Let's Encrypt via Certbot, with automatic HTTP to HTTPS redirect
- Secrets: Azure Key Vault, accessed via the VM's Managed Identity

## RBAC Roles

- STUDENT / FACULTY: Submit tickets, view/comment on own tickets
- TECHNICIAN: View all tickets, claim tickets, update status
- ADMIN: Full access, manage technician accounts

## Database Schema

Core entities - full schema in prisma/schema.prisma:
- User: adObjectId, name, email, role
- Ticket: title, description, status, priority, roomLocation, relations to requester/technician/category
- Category: auto-populated by Gemini categorization
- TicketUpdate: comment/audit trail on a ticket

## Peer API Documentation

N/A - the Service-to-Service (Peer API) requirement was waived for this project (see note above). External Integrations (Gemini + SendGrid) are documented in the section above.
