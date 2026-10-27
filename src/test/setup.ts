import '@testing-library/jest-dom/vitest';
import { clearEventsCache } from '@/services/events';

// The shared /events request is module state; each test mocks fetch differently.
afterEach(clearEventsCache);
