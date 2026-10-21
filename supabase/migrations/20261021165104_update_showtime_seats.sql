ALTER TABLE public.showtime_seats
    ALTER COLUMN bookingid DROP NOT NULL,
    ALTER COLUMN holdtoken DROP NOT NULL,
    ALTER COLUMN holdexpiresat DROP NOT NULL;