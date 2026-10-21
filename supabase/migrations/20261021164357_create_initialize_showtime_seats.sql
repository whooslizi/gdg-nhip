CREATE OR REPLACE FUNCTION public.initialize_showtime_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Khởi tạo trạng thái cho toàn bộ ghế dùng chung
    INSERT INTO public.showtime_seats (
        showtimeid,
        seatid,
        status
    )
    SELECT
        NEW.showtimeid,
        s.seatid,
        'available'
    FROM public.seats AS s
    ON CONFLICT (showtimeid, seatid) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initialize_showtime_seats
ON public.showtimes;

CREATE TRIGGER trg_initialize_showtime_seats
AFTER INSERT ON public.showtimes
FOR EACH ROW
EXECUTE FUNCTION public.initialize_showtime_seats();