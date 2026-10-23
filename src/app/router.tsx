import { createBrowserRouter } from 'react-router';
import { EventBrowser } from '@/components/events/EventBrowser';
import { Layout } from '@/components/layout/Layout';
import { BookingPage } from '@/pages/BookingPage';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { HomePage } from '@/pages/HomePage';
import { MyBookingsPage } from '@/pages/MyBookingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SeatSelectionPage } from '@/pages/SeatSelectionPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/events', element: <EventBrowser /> },
      { path: '/events/:slug', element: <EventDetailPage /> },
      { path: '/events/:slug/seats', element: <SeatSelectionPage /> },
      { path: '/booking/:bookingId', element: <BookingPage /> },
      { path: '/my-bookings', element: <MyBookingsPage /> },
      { path: '/admin', element: <AdminDashboardPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
