CREATE TABLE public.areas (
    areaid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    areaname TEXT NOT NULL
);

CREATE TABLE public.cinemas (
    cinemaid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cinemaname TEXT NOT NULL,
    areaid BIGINT NOT NULL REFERENCES public.areas(areaid),
    locate TEXT NOT NULL
);

CREATE TABLE public.rooms (
    roomid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    roomname TEXT NOT NULL,
    cinemaid BIGINT NOT NULL REFERENCES public.cinemas(cinemaid)
);

CREATE TABLE public.events (
    eventid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    eventname TEXT NOT NULL,
    directors TEXT[] NOT NULL DEFAULT '{}',
    actors TEXT[] NOT NULL DEFAULT '{}',
    types TEXT[] NOT NULL DEFAULT '{}',
    languages TEXT[] NOT NULL DEFAULT '{}',
    poster TEXT NOT NULL,
    duration INTEGER NOT NULL CHECK (duration > 0),
    startat DATE NOT NULL,
    endat DATE NOT NULL,
    CHECK (endat >= startat)
);

CREATE TABLE public.seats (
    seatid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rowlabel CHAR(1) NOT NULL,
    seatnumber INTEGER NOT NULL CHECK (seatnumber > 0),
    seattype TEXT NOT NULL,
    UNIQUE (rowlabel, seatnumber)
);

CREATE TABLE public.showtimes (
    showtimeid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    eventid BIGINT NOT NULL REFERENCES public.events(eventid),
    roomid BIGINT NOT NULL REFERENCES public.rooms(roomid),
    startat TIMESTAMPTZ NOT NULL,
    endat TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    CHECK (endat > startat)
);

CREATE TABLE public.bookings (
    bookingid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bookingtoken TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    price BIGINT NOT NULL CHECK (price >= 0),
    username TEXT NOT NULL,
    userphone TEXT NOT NULL,
    useremail TEXT NOT NULL
);

CREATE TABLE public.showtime_seats (
    showtimeid BIGINT NOT NULL
        REFERENCES public.showtimes(showtimeid),
    seatid BIGINT NOT NULL
        REFERENCES public.seats(seatid),
    roomid BIGINT NOT NULL
        REFERENCES public.rooms(roomid),
    bookingid BIGINT
        REFERENCES public.bookings(bookingid),
    status TEXT NOT NULL,
    holdtoken TEXT NOT NULL UNIQUE,
    holdexpiresat TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (showtimeid, seatid)
);

CREATE TABLE public.payments (
    paymentid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bookingid BIGINT NOT NULL
        REFERENCES public.bookings(bookingid),
    method TEXT NOT NULL,
    createdat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);