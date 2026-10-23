CREATE TABLE public.booking_seats (
    bookingid BIGINT NOT NULL
        REFERENCES public.bookings(bookingid) ON DELETE CASCADE,
    showtimeid BIGINT NOT NULL
        REFERENCES public.showtimes(showtimeid),
    seatid BIGINT NOT NULL
        REFERENCES public.seats(seatid),
    rowlabel CHAR(1) NOT NULL,
    seatnumber INTEGER NOT NULL,
    seattype TEXT NOT NULL,
    PRIMARY KEY (bookingid, showtimeid, seatid)
);

INSERT INTO public.booking_seats (
    bookingid,
    showtimeid,
    seatid,
    rowlabel,
    seatnumber,
    seattype
)
SELECT
    showtime_seats.bookingid,
    showtime_seats.showtimeid,
    seats.seatid,
    seats.rowlabel,
    seats.seatnumber,
    seats.seattype
FROM public.showtime_seats
JOIN public.seats ON seats.seatid = showtime_seats.seatid
WHERE showtime_seats.bookingid IS NOT NULL
  AND showtime_seats.status = 'booked'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.process_mock_payment(
    p_hold_token text,
    p_user_name text,
    p_user_phone text,
    p_user_email text,
    p_price bigint,
    p_result text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_booking_id bigint;
    v_payment_id bigint;
    v_booking_token text;
    v_seat_count integer;
    v_updated_count integer;
BEGIN
    IF p_hold_token IS NULL OR trim(p_hold_token) = ''
       OR p_user_name IS NULL OR trim(p_user_name) = ''
       OR p_user_phone IS NULL OR trim(p_user_phone) = ''
       OR p_user_email IS NULL OR trim(p_user_email) = ''
       OR p_price IS NULL OR p_price < 0
       OR p_result IS NULL
       OR p_result NOT IN ('success', 'failed')
    THEN
        RAISE EXCEPTION 'Invalid payment input';
    END IF;

    PERFORM 1
    FROM public.showtime_seats
    WHERE holdtoken = p_hold_token
    ORDER BY showtimeid, seatid
    FOR UPDATE;

    SELECT COUNT(*)
    INTO v_seat_count
    FROM public.showtime_seats
    WHERE holdtoken = p_hold_token
      AND status = 'holding'
      AND holdexpiresat > now();

    IF v_seat_count = 0 THEN
        RAISE EXCEPTION 'Hold token is invalid or expired';
    END IF;

    v_booking_token := gen_random_uuid()::text;

    INSERT INTO public.bookings (
        bookingtoken,
        status,
        price,
        username,
        userphone,
        useremail
    )
    VALUES (
        v_booking_token,
        CASE WHEN p_result = 'success' THEN 'confirmed' ELSE 'pending' END,
        p_price,
        trim(p_user_name),
        trim(p_user_phone),
        lower(trim(p_user_email))
    )
    RETURNING bookingid INTO v_booking_id;

    INSERT INTO public.payments (bookingid, method, createdat, status)
    VALUES (v_booking_id, 'mock', now(), p_result)
    RETURNING paymentid INTO v_payment_id;

    IF p_result = 'success' THEN
        UPDATE public.showtime_seats
        SET status = 'booked',
            bookingid = v_booking_id,
            holdtoken = NULL,
            holdexpiresat = NULL
        WHERE holdtoken = p_hold_token
          AND status = 'holding'
          AND holdexpiresat > now();

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        IF v_updated_count <> v_seat_count THEN
            RAISE EXCEPTION 'Could not book all held seats';
        END IF;

        INSERT INTO public.booking_seats (
            bookingid,
            showtimeid,
            seatid,
            rowlabel,
            seatnumber,
            seattype
        )
        SELECT
            v_booking_id,
            showtime_seats.showtimeid,
            seats.seatid,
            seats.rowlabel,
            seats.seatnumber,
            seats.seattype
        FROM public.showtime_seats
        JOIN public.seats ON seats.seatid = showtime_seats.seatid
        WHERE showtime_seats.bookingid = v_booking_id
          AND showtime_seats.status = 'booked';
    END IF;

    RETURN jsonb_build_object(
        'success', p_result = 'success',
        'message', CASE
            WHEN p_result = 'success' THEN 'Payment successful'
            ELSE 'Mock payment failed'
        END,
        'data', jsonb_build_object(
            'paymentId', v_payment_id,
            'bookingId', v_booking_id,
            'bookingToken', v_booking_token,
            'bookingStatus', CASE
                WHEN p_result = 'success' THEN 'confirmed'
                ELSE 'pending'
            END,
            'paymentStatus', p_result,
            'seatCount', v_seat_count
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking(
    p_booking_id bigint,
    p_user_email text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_released_count integer;
BEGIN
    IF p_booking_id IS NULL OR p_booking_id <= 0
       OR p_user_email IS NULL OR trim(p_user_email) = ''
    THEN
        RAISE EXCEPTION 'Invalid booking ID or email';
    END IF;

    SELECT *
    INTO v_booking
    FROM public.bookings
    WHERE bookingid = p_booking_id
    FOR UPDATE;

    IF NOT FOUND OR lower(trim(v_booking.useremail)) <> lower(trim(p_user_email)) THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    IF v_booking.status = 'cancelled' THEN
        RAISE EXCEPTION 'Booking is already cancelled';
    END IF;

    IF v_booking.status <> 'confirmed' THEN
        RAISE EXCEPTION 'Only confirmed bookings can be cancelled';
    END IF;

    UPDATE public.showtime_seats
    SET status = 'available',
        holdtoken = NULL,
        holdexpiresat = NULL,
        bookingid = NULL
    WHERE bookingid = p_booking_id
      AND status = 'booked';

    GET DIAGNOSTICS v_released_count = ROW_COUNT;

    UPDATE public.bookings
    SET status = 'cancelled'
    WHERE bookingid = p_booking_id;

    UPDATE public.payments
    SET status = 'refunded'
    WHERE bookingid = p_booking_id
      AND status = 'success';

    RETURN jsonb_build_object(
        'success', true,
        'bookingId', p_booking_id,
        'bookingStatus', 'cancelled',
        'refund', v_booking.price,
        'releasedSeats', v_released_count
    );
END;
$$;
