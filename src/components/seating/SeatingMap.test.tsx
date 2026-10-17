import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderRoute, seatMap } from '@/test/utils';
import { SeatingMap } from './SeatingMap';

function Harness({ interactive = true }: { interactive?: boolean }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  return (
    <>
      <SeatingMap
        map={seatMap()}
        selected={selected}
        interactive={interactive}
        onToggle={(s) =>
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(s.id)) next.delete(s.id);
            else next.add(s.id);
            return next;
          })
        }
      />
      <output>{[...selected].join(',')}</output>
    </>
  );
}

const seatButton = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`^Seat ${label},`) });

describe('SeatingMap', () => {
  it('renders the stage, sections, rows and accessible seat labels', () => {
    renderRoute(<Harness />);
    expect(screen.getByText('Stage')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Floor' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Row A' })).toBeInTheDocument();
    expect(seatButton('A1')).toHaveAccessibleName(/Premium, .*250[.,]000.*Available/);
    expect(seatButton('A3')).toHaveAccessibleName(/On hold/);
    expect(seatButton('B2')).toHaveAccessibleName(/Sold/);
    expect(seatButton('B3')).toHaveAccessibleName(/Unavailable/);
  });

  it('selects and deselects available seats', async () => {
    renderRoute(<Harness />);
    await userEvent.click(seatButton('A1'));
    await userEvent.click(seatButton('B1'));
    expect(document.querySelector('output')).toHaveTextContent('A1-id,B1-id');
    expect(seatButton('A1')).toHaveAttribute('aria-pressed', 'true');
    expect(seatButton('A1')).toHaveAccessibleName(/Your selection/);

    await userEvent.click(seatButton('A1'));
    expect(document.querySelector('output')).toHaveTextContent('B1-id');
  });

  it('ignores clicks on held, sold and blocked seats, and when not interactive', async () => {
    renderRoute(<Harness />);
    for (const label of ['A3', 'B2', 'B3']) {
      expect(seatButton(label)).toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(seatButton(label));
    }
    expect(document.querySelector('output')).toHaveTextContent('');
  });

  it('does not select when the map is read-only', async () => {
    renderRoute(<Harness interactive={false} />);
    await userEvent.click(seatButton('A1'));
    expect(document.querySelector('output')).toHaveTextContent('');
  });
});
