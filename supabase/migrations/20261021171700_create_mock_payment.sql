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
    -- 1. Validate input
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
        CASE WHEN p_result = 'success'
             THEN 'confirmed'
             ELSE 'pending'
        END,
        p_price,
        trim(p_user_name),
        trim(p_user_phone),
        trim(p_user_email)
    )
    RETURNING bookingid INTO v_booking_id;

    INSERT INTO public.payments (
        bookingid,
        method,
        createdat,
        status
    )
    VALUES (
        v_booking_id,
        'mock',
        now(),
        p_result
    )
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