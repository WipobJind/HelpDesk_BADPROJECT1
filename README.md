# HelpDesk — Internal Campus IT Ticketing System

A university IT support portal where students/faculty log in via Microsoft Entra ID (Active Directory) to submit tickets, and technicians claim and resolve them. Tickets are auto-categorized by Google Gemini, and urgent tickets trigger a SendGrid email to on-call technicians.

Live deployment: https://helpdesk-badproject1.duckdns.org/helpdesk

## Architecture Overview

Client -> Nginx (reverse proxy, /helpdesk path, Let's Encrypt SSL) -> Express REST API (Node.js)

The Express API connects to:
- Auth: Microsoft Entra ID (MSAL) -> app-issued JWT (RBAC: STUDENT / FACULTY / TECHNICIAN / ADMIN)
- Prisma ORM -> MySQL (Users, Tickets, Categories, TicketUpdates)
- Google Gemini API -> auto-categorizes ticket text on creation
- SendGrid API -> emails technicians when a ticket is created
- Azure Key Vault -> fetches DB connection string, JWT secret, Gemini/SendGrid keys, and the AD client secret at runtime via the VM's Managed Identity (no production secrets stored in .env)

## Peer API Requirement - Waived

Per the instructor's note on the project brief, the Service-to-Service (Peer API) requirement is not required for this project. It is replaced by the External Integration requirement below, satisfied via two independent public APIs (Gemini + SendGrid).

## External Integrations

- Google Gemini API: Classifies each new ticket's description into a category (Hardware, Software, Network, Account, Other)
- SendGrid API: Emails technicians when a new ticket is submitted

## Authentication

Login is handled entirely through Microsoft Entra ID (Azure AD) using MSAL Node:

1. GET /helpdesk/api/auth/login - redirects the user to Microsoft's login page
2. User signs in with their university account (@au.edu)
3. Microsoft redirects back to GET /helpdesk/api/auth/callback with an auth code
4. The backend exchanges that code for the user's AD identity, finds or creates a matching User row (keyed on their AD Object ID), and issues the app's own JWT
5. That JWT is used as a Bearer token on all subsequent requests

## Secrets Management

No production secrets are stored in .env. At startup, app.js calls services/keyvault.js, which authenticates to Azure Key Vault using the VM's system-assigned Managed Identity (no credentials needed) and fetches: DATABASE-URL, JWT-SECRET, GEMINI-API-KEY, SENDGRID-API-KEY, SENDGRID-FROM-EMAIL, AZURE-AD-CLIENT-SECRET.

.env is only used as a local-development fallback when AZURE_KEY_VAULT_URL isn't configured.

## Setup (local development)

1. Install dependencies: npm install
2. Copy .env.example to .env and fill in a local MySQL connection string, a JWT secret, and your Gemini/SendGrid keys.
3. Run migrations: npx prisma migrate dev
4. Start the dev server: npm start
5. Health check: GET http://localhost:3000/helpdesk/api/health

## Deployment

- Infrastructure: Azure VM (Ubuntu 24.04 LTS), hardened with UFW (ports 22/80/443 only)
- Process manager: PM2, configured to auto-restart on crash and auto-start on VM reboot (pm2 startup + pm2 save)
- Reverse proxy: Nginx, routing /helpdesk to the Node app on port 3000
- Domain: Free DuckDNS subdomain (helpdesk-badproject1.duckdns.org), since Let's Encrypt requires a real domain name rather than a bare IP
- SSL: Let's Encrypt via Certbot, with automatic HTTP to HTTPS redirect
- Secrets: Azure Key Vault, accessed via the VM's Managed Identity (see above)

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
