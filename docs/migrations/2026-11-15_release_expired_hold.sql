-- Frees one expired seat hold as soon as it runs out, called by the realtime worker
-- (realtime/src/worker.js) from a delayed BullMQ job. Lazy expiry stays in place: hold_seats
-- and process_mock_payment still treat holdexpiresat <= now() as free, so nothing breaks if
-- the worker or Redis is down.
--
-- Run this on Supabase (SQL editor) BEFORE starting the realtime worker. The backend does not
-- call it, so the order relative to the Vercel deploy does not matter.

BEGIN;

CREATE OR REPLACE FUNCTION public.release_expired_hold(p_hold_token text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_showtime_id bigint;
    v_seat_ids bigint[];
BEGIN
    IF p_hold_token IS NULL OR trim(p_hold_token) = '' THEN
        RAISE EXCEPTION 'Hold token is required';
    END IF;

    -- Same lock order as cancel_hold and process_mock_payment.
    PERFORM 1
    FROM public.showtime_seats
    WHERE holdtoken = p_hold_token
    ORDER BY showtimeid, seatid
    FOR UPDATE;

    -- Only seats still held under this token and past their expiry: a booked seat or a hold
    -- that is still valid is never touched, so a second run releases nothing.
    WITH released AS (
        UPDATE public.showtime_seats
        SET status = 'available',
            holdtoken = NULL,
            holdexpiresat = NULL
        WHERE holdtoken = p_hold_token
          AND status = 'holding'
          AND holdexpiresat <= now()
        RETURNING showtimeid, seatid
    )
    SELECT min(showtimeid), array_agg(seatid ORDER BY seatid)
    INTO v_showtime_id, v_seat_ids
    FROM released;

    RETURN jsonb_build_object(
        'released', coalesce(cardinality(v_seat_ids), 0),
        'showtimeId', v_showtime_id,
        'seatIds', coalesce(to_jsonb(v_seat_ids), '[]'::jsonb)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_expired_hold(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_hold(text) TO service_role;

COMMIT;
