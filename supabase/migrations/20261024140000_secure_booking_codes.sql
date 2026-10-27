CREATE OR REPLACE FUNCTION public.generate_booking_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_alphabet CONSTANT text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    v_positions CONSTANT integer[] := ARRAY[0, 1, 2, 3, 4, 5, 7, 9];
    v_bytes bytea;
    v_chars text;
    v_code text;
BEGIN
    LOOP
        v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
        v_chars := '';
        FOR i IN 1..8 LOOP
            v_chars := v_chars || substr(
                v_alphabet,
                get_byte(v_bytes, v_positions[i]) % length(v_alphabet) + 1,
                1
            );
        END LOOP;
        v_code := 'BK-' || substr(v_chars, 1, 4) || '-' || substr(v_chars, 5, 4);
        EXIT WHEN NOT EXISTS (
            SELECT 1
            FROM public.bookings
            WHERE bookingcode = v_code
        );
    END LOOP;
    RETURN v_code;
END;
$$;

-- Codes issued by the old generator are guessable; reissue them.
UPDATE public.bookings
SET bookingcode = public.generate_booking_code();
