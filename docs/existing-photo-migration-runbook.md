# Existing repair-photo migration runbook

This runbook is deliberately manual until production storage metadata and job
references have been inventoried. Do not delete, relocate or change access to
existing objects during the application rollout.

## Transition behavior

- New uploads go only to the private `repair-photos-private` bucket and jobs
  store `photo_path` using `user_id/job_id/random_filename`.
- The API signs private paths for five minutes after verifying job ownership.
- Existing `https://` values in `jobs.image_url` remain readable as
  `legacy_public` records. The API never treats arbitrary non-HTTPS values as
  images and never writes a new public URL when `photo_path` is present.
- Clients refresh private URLs through the authenticated
  `GET /jobs/{job_id}/photo-url` endpoint.

## Inventory before conversion

1. Export `jobs(id, user_id, image_url, photo_path, photo_storage)`.
2. Export the existing bucket object list, sizes, MIME types and checksums.
3. Identify missing objects, duplicate URLs, external URLs and jobs without an
   owner. Stop if any row cannot be assigned to exactly one authenticated user.
4. Back up both database rows and object bytes and test restoration.

## Staged conversion

1. Copy, never move, each verified object to
   `repair-photos-private/{user_id}/{job_id}/{random_filename}`.
2. Verify byte checksum and content type after each copy.
3. In a transaction, set that job's `photo_path` and `photo_storage='private'`.
   Retain `image_url` during the observation period for rollback, although the
   application will prefer `photo_path`.
4. Verify owner access, cross-user denial, expiry and refresh.
5. Convert in small batches with an audit log and a reversible row manifest.
6. After an agreed retention period, removing legacy URLs or old objects is a
   separate destructive change requiring explicit approval.

## Rollback

Clear `photo_path` and restore `photo_storage='legacy_public'` only for rows in
the conversion manifest. Do not make the private bucket public. Leave copied
private objects in place until the incident is understood; no deletion is
required to roll back application reads.
