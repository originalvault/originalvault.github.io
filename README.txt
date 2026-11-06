# Original Vault

A Bengali-language public media archive built with GitHub Pages and Supabase.

## Current features
- Public photo and video galleries backed by the `media_records` table.
- Admin sign-in through Supabase Auth (public sign-ups should remain disabled).
- Admin media uploads to the `originalvault-media` Storage bucket.
- SHA-256 file fingerprints saved with each media record.
- Creator, description, first-publication date, and optional original-post URL.

## Deployment
The site is served from the repository's GitHub Pages configuration. The required front-end files are `index.html`, `style.css`, `config.js`, and `app.js`.

## Supabase configuration
`config.js` contains the project URL and a publishable/anonymous public key. These values are intended for browser use. Never put a Supabase secret key, service-role key, database password, or other privileged credential in this repository.

The Supabase project must contain:
- A `media_records` table with the columns used by `app.js`.
- A Storage bucket named `originalvault-media`.
- Row-level security policies that permit public reads only for intended public records and restrict inserts to authorized administrators.

Review the actual policies in the Supabase dashboard before accepting real user data. Disabling public sign-ups is important, but an authenticated-user insert policy alone is not a strict administrator allowlist if other accounts can authenticate.

## Important security and evidence notes
- The Storage bucket is currently configured as public, so anyone who obtains a media URL may view that uploaded file. Do not upload private or sensitive media.
- SHA-256 identifies file contents and can help detect changes; it does not independently prove authorship, creation date, or legal ownership.
- An archive entry is not government copyright registration and does not guarantee that a platform will accept a takedown report.
- Keep original files, drafts, publication records, and independent backups.

## Upload limits
The browser currently enforces a 50 MB per-file limit and accepts JPEG, PNG, WEBP, GIF, MP4, WEBM, and MOV/QuickTime MIME types. Supabase project limits and bucket policies must also permit these uploads.
