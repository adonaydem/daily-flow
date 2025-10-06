-- Add a nullable notes column to deliverables for mid-work notes
ALTER TABLE public.deliverables
ADD COLUMN IF NOT EXISTS notes text;

-- Optional: backfill or defaults are not required; keep nulls allowed
