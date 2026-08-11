-- ============================================================
-- Google Drive photo folders for spreadsheet-imported listings.
--
-- Agencies keep property photos in Drive: one folder per property, a subfolder
-- per room ("Room 1", "Bedroom 2") plus communal subfolders ("Kitchen",
-- "Bathroom"). The spreadsheet carries the property folder link; the importer
-- matches each row's room to a subfolder and fills the existing photo columns
-- (first_photo_url / all_photos / photos / photo_count).
-- ============================================================

-- The room's name or number as written in the spreadsheet. This is what gets
-- matched against Drive subfolder names, and it is worth keeping regardless —
-- it is how the agency refers to the room.
alter table public.scraped_listings
  add column if not exists room_label text;

-- The property's Drive folder link, straight from the sheet. Kept so the folder
-- is one click away from the listing and re-reads need no re-derivation.
alter table public.scraped_listings
  add column if not exists drive_folder_url text;

-- Which Drive subfolder supplied this row's room photos, or null when no
-- subfolder matched (the row still gets the communal photos). Purely
-- diagnostic — it answers "why did this listing get those pictures?".
alter table public.scraped_listings
  add column if not exists drive_room_folder text;
