-- Waiting room in front of the seat map. Every browser tab is one row: it waits in joinedat
-- order until one of the event's p_capacity slots is free, then has 10 minutes on the seat map.
-- Tabs send a heartbeat every few seconds; one that goes quiet for 30 s leaves the queue.

-- An earlier draft of this feature created these; drop them if they were applied.
DROP FUNCTION IF EXISTS public.touch_presence(bigint, uuid);
DROP TABLE IF EXISTS public.event_presence;

CREATE TABLE public.waiting_room (
    sessionid uuid PRIMARY KEY,
    eventid bigint NOT NULL REFERENCES public.events(eventid) ON DELETE CASCADE,
    joinedat timestamptz NOT NULL DEFAULT now(),
    lastseen timestamptz NOT NULL DEFAULT now(),
    admittedat timestamptz
);

CREATE INDEX waiting_room_event_joined_idx ON public.waiting_room (eventid, joinedat);

ALTER TABLE public.waiting_room ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waiting_room FROM PUBLIC, anon, authenticated;

-- p_join = true adds the tab to the queue (the API checks Turnstile first);
-- p_join = false is a heartbeat and only works for a tab that is already queued.
CREATE OR REPLACE FUNCTION public.waiting_room(
    p_event_id bigint,
    p_session_id uuid,
    p_join boolean,
    p_capacity integer
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_row public.waiting_room%ROWTYPE;
    v_free integer;
    v_ahead integer := 0;
BEGIN
    -- One event's queue changes one call at a time, so two tabs can't take the same free slot.
    PERFORM pg_advisory_xact_lock(p_event_id);

    -- Quiet tabs leave the queue; guests whose 10 minutes are over give their slot back.
    DELETE FROM public.waiting_room
    WHERE eventid = p_event_id
      AND (lastseen < now() - interval '30 seconds'
           OR admittedat < now() - interval '10 minutes');

    IF p_join THEN
        INSERT INTO public.waiting_room (sessionid, eventid)
        VALUES (p_session_id, p_event_id)
        ON CONFLICT (sessionid) DO UPDATE
        SET lastseen = now(),
            -- Same event (e.g. a reload): keep the place in line. Another event: start at the back.
            joinedat = CASE WHEN waiting_room.eventid = EXCLUDED.eventid
                            THEN waiting_room.joinedat ELSE now() END,
            admittedat = CASE WHEN waiting_room.eventid = EXCLUDED.eventid
                              THEN waiting_room.admittedat ELSE NULL END,
            eventid = EXCLUDED.eventid;
    ELSE
        UPDATE public.waiting_room
        SET lastseen = now()
        WHERE sessionid = p_session_id AND eventid = p_event_id;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('result', 'not_in_queue', 'ahead', 0,
                                      'expiresAt', NULL, 'serverTime', now());
        END IF;
    END IF;

    SELECT p_capacity - count(*) INTO v_free
    FROM public.waiting_room
    WHERE eventid = p_event_id AND admittedat IS NOT NULL;

    IF v_free > 0 THEN
        UPDATE public.waiting_room
        SET admittedat = now()
        WHERE sessionid IN (
            SELECT sessionid
            FROM public.waiting_room
            WHERE eventid = p_event_id AND admittedat IS NULL
            ORDER BY joinedat, sessionid
            LIMIT v_free
        );
    END IF;

    SELECT * INTO v_row FROM public.waiting_room WHERE sessionid = p_session_id;

    IF v_row.admittedat IS NULL THEN
        SELECT count(*) INTO v_ahead
        FROM public.waiting_room
        WHERE eventid = p_event_id
          AND admittedat IS NULL
          AND (joinedat, sessionid) < (v_row.joinedat, v_row.sessionid);
    END IF;

    RETURN jsonb_build_object(
        'result', CASE WHEN v_row.admittedat IS NULL THEN 'waiting' ELSE 'admitted' END,
        'ahead', v_ahead,
        'expiresAt', v_row.admittedat + interval '10 minutes',
        'serverTime', now()
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.waiting_room(bigint, uuid, boolean, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waiting_room(bigint, uuid, boolean, integer) TO service_role;
