CREATE OR REPLACE FUNCTION public.cancel_hold(
    p_hold_token text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_released_count integer;
BEGIN
    IF p_hold_token IS NULL OR trim(p_hold_token) = '' THEN
        RAISE EXCEPTION 'Hold token is required';
    END IF;

    PERFORM 1
    FROM public.showtime_seats
    WHERE holdtoken = p_hold_token
    ORDER BY showtimeid, seatid
    FOR UPDATE;

    UPDATE public.showtime_seats
    SET status = 'available',
        holdtoken = NULL,
        holdexpiresat = NULL,
        bookingid = NULL
    WHERE holdtoken = p_hold_token
      AND status = 'holding';

    GET DIAGNOSTICS v_released_count = ROW_COUNT;

    IF v_released_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No held seats found for this token',
            'releasedCount', 0
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Hold cancelled successfully',
        'releasedCount', v_released_count
    );
END;
$$;