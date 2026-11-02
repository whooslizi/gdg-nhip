-- The gate between the waiting room and the seat map. An admitted tab must pass a Turnstile
-- check (verified by the API) before the gate opens, and the public hold API only accepts
-- seats from a tab that passed it and is still inside its 10 minutes. This is what stops a
-- script from skipping the queue by calling POST /holds directly.
ALTER TABLE public.waiting_room ADD COLUMN gatepassedat timestamptz;

CREATE OR REPLACE FUNCTION public.waiting_room_pass_gate(p_event_id bigint, p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.waiting_room
    SET gatepassedat = now(), lastseen = now()
    WHERE sessionid = p_session_id
      AND eventid = p_event_id
      AND admittedat > now() - interval '10 minutes';
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.waiting_room_may_hold(p_session_id uuid, p_showtime_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.waiting_room w
        JOIN public.showtimes s ON s.eventid = w.eventid
        WHERE w.sessionid = p_session_id
          AND s.showtimeid = p_showtime_id
          AND w.gatepassedat IS NOT NULL
          AND w.admittedat > now() - interval '10 minutes'
    );
$$;

REVOKE EXECUTE ON FUNCTION public.waiting_room_pass_gate(bigint, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.waiting_room_may_hold(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waiting_room_pass_gate(bigint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.waiting_room_may_hold(uuid, bigint) TO service_role;
