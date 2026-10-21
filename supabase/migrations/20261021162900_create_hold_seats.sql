CREATE OR REPLACE FUNCTION public.hold_seats(
    p_showtime_id integer,
    p_seat_ids integer[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_hold_token text;
    v_expires_at timestamptz;
    v_found_count integer;
    v_unique_count integer;
    v_available_count integer;
BEGIN
    IF p_showtime_id IS NULL
       OR p_seat_ids IS NULL
       OR cardinality(p_seat_ids) = 0
       OR array_position(p_seat_ids, NULL) IS NOT NULL
    THEN
        RAISE EXCEPTION 'Invalid showtime or seat list';
    END IF;

    SELECT COUNT(DISTINCT seat_id)
    INTO v_unique_count
    FROM unnest(p_seat_ids) AS t(seat_id);

    IF v_unique_count <> cardinality(p_seat_ids) THEN
        RAISE EXCEPTION 'Duplicate seat IDs';
    END IF;

    PERFORM 1
    FROM public.showtimes
    WHERE showtimeid = p_showtime_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Showtime not found';
    END IF;

    PERFORM 1
    FROM public.showtime_seats
    WHERE showtimeid = p_showtime_id
      AND seatid = ANY(p_seat_ids)
    ORDER BY seatid
    FOR UPDATE;

    SELECT COUNT(*)
    INTO v_found_count
    FROM public.showtime_seats
    WHERE showtimeid = p_showtime_id
      AND seatid = ANY(p_seat_ids);

    IF v_found_count <> cardinality(p_seat_ids) THEN
        RAISE EXCEPTION 'One or more seats do not exist';
    END IF;

    SELECT COUNT(*)
    INTO v_available_count
    FROM public.showtime_seats
    WHERE showtimeid = p_showtime_id
      AND seatid = ANY(p_seat_ids)
      AND (
          status = 'available'
          OR (
              status = 'holding'
              AND hold_expires_at <= now()
          )
      );

    IF v_available_count <> cardinality(p_seat_ids) THEN
        RAISE EXCEPTION 'One or more seats are unavailable';
    END IF;

    v_hold_token := gen_random_uuid()::text;
    v_expires_at := now() + interval '10 minutes';

    UPDATE public.showtime_seats
    SET status = 'holding',
        hold_token = v_hold_token,
        hold_expires_at = v_expires_at
    WHERE showtimeid = p_showtime_id
      AND seatid = ANY(p_seat_ids);

    RETURN jsonb_build_object(
        'success', true,
        'holdToken', v_hold_token,
        'showtimeId', p_showtime_id,
        'seatIds', to_jsonb(p_seat_ids),
        'expiresAt', v_expires_at
    );
END;
$$;
