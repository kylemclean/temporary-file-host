# Temporary File Host

This is a full-stack web service that allows users to upload files through a
web page to be temporarily and securely stored in cloud storage.

When a user selects a file for upload, they can select an amount of time for
it to be available before it expires. The file is encrypted in their browser
using a client-side generated key before it is uploaded by the user to an S3
bucket through a pre-signed URL.

The user is then given a download URL containing the decryption key in the
hash portion. Anyone who visits the link before the file expires can download
the encrypted file from the S3 bucket and decrypt it in their browser without
the server ever seeing the contents of the file, since the key never leaves the
browser.

## Backend

The backend consists of several parts: a user-facing API that runs on
Cloudflare Pages Functions, a Cloudflare D1 SQLite database for storing info
about uploaded files, an S3 bucket to store encrypted uploads, and a Cloudflare
worker that runs on a schedule to clean up expired files.

> [!NOTE]
> You must intialize a local development database for uploads to work on the
> development server.

To initialize a local development database, run

```
npm run initdb:local
```

The API is located in the `functions` directory and is started along with the
frontend dev server when you run `npm run dev`.

To locally run the worker that cleans up expired files, run

```
npm run worker:dev
```

You must set the following environment variables on the backend:

- `S3_BUCKET_URL`: S3 bucket URL to store encrypted files in
- `AWS_ACCESS_KEY_ID`: id of an AWS token to access the S3 bucket
- `AWS_SECRET_ACCESS_KEY`: secret key of an AWS token to access the S3 bucket
- `TURNSTILE_SECRET`: secret key of a Cloudflare Turnstile widget

## Frontend

The frontend is written in React using Vite.

To start the frontend dev server, run

```
npm run dev
```

This will run the Vite dev server through Wrangler, also making the backend API
functions available.

To build the frontend, run

```
npm run build
```

You must set the environment variable `VITE_TURNSTILE_SITE_KEY` with the site
key for a Cloudflare Turnstile widget.

## License

This project is licensed under the MIT license.
