# Shree Enterprises

An enquiry-led purifier catalogue and local service website for Shree Enterprises, Chikkamagaluru. The project uses the supplied frame archive for a scroll-scrubbed hero and brochure-derived purifier images and MRPs.

## Run locally

Requires Node.js 18 or later. No packages need to be installed.

```powershell
npm start
```

Open http://127.0.0.1:4173.

## Customer enquiries

The enquiry form posts customer name, phone, address, requested service and details to the included Node server. The server writes each enquiry to the `public.enquiries` table in the `Shree_Enterprises_website` Supabase project, then saves a date-stamped UTF-8 CSV backup under `data/enquiries/`. The table also stores the database timestamp and the submission time formatted in India Standard Time. After the database save succeeds, the page opens WhatsApp with the same details prefilled for the customer to review and send.

Local development reads `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from `.env` (see `.env.example`). For a hosted deployment, set those values as host environment variables, use a Node.js host, and bind to `0.0.0.0` with the `HOST` environment variable if required. The publishable key is intentionally low-privilege; the database grants it insert access only, and row-level security prevents public reads. Never put a Supabase secret or service-role key in this website. Persistent disk is only needed if you also want the local CSV backups to survive redeploys. The WhatsApp message is prefilled, not sent automatically. The contact details are personal data, so restrict access to CSV backups and provide the site's privacy notice before collecting live enquiries.

## Catalog and source notes

- The displayed product model names, brochure MRP and product features come from the supplied KENT, Havells and Livpure PDFs.
- The 20% enquiry offer is calculated from the brochure MRP. Confirm today's stock and final price with the store.
- The supplied brochures list 18 KENT and 17 Livpure models, plus 8 Havells purifier entries (two Havells names are clipped in the supplied pages and are shown by their visible item codes). The site does not invent extra models to fill out a larger count.
- RO component descriptions and store details are based on the information provided for this project.
