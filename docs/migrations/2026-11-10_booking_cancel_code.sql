-- Secret cancellation code for real bookings.
-- The backend generates the code, returns it once in the payment response and passes only
-- its salted SHA-256 hash here. Bookings made before this migration keep NULL and cannot be
-- cancelled through the public API.
--
-- Run this on Supabase (SQL editor) BEFORE deploying the backend that sends p_cancel_code_hash.
-- Body copied from 20261024130000_add_public_booking_codes.sql; only the hash parameter and
-- the bookings INSERT changed.

BEGIN;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS cancel_code_hash text;

-- The signature changes, so drop the 6-argument version instead of leaving an overload
-- that would still create bookings without a hash.
DROP FUNCTION IF EXISTS public.process_mock_payment(text, text, text, text, bigint, text);

CREATE FUNCTION public.process_mock_payment(
    p_hold_token text,
    p_user_name text,
    p_user_phone text,
    p_user_email text,
    p_price bigint,
    p_result text,
    p_cancel_code_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_booking_id bigint;
    v_booking_code text;
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
       OR p_cancel_code_hash IS NULL OR trim(p_cancel_code_hash) = ''
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
        useremail,
        cancel_code_hash
    )
    VALUES (
        v_booking_token,
        CASE WHEN p_result = 'success' THEN 'confirmed' ELSE 'pending' END,
        p_price,
        trim(p_user_name),
        trim(p_user_phone),
        lower(trim(p_user_email)),
        p_cancel_code_hash
    )
    RETURNING bookingid, bookingcode INTO v_booking_id, v_booking_code;

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
            'bookingId', v_booking_code,
            'bookingDbId', v_booking_id,
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

REVOKE EXECUTE ON FUNCTION public.process_mock_payment(text, text, text, text, bigint, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_mock_payment(text, text, text, text, bigint, text, text)
    TO service_role;

COMMIT;
