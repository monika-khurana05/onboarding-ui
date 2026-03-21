import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createAppTheme } from '../../app/theme';
import { createDefaultStateManagerConfig } from './defaultScenarios';
import { StateManagerPanel } from './StateManagerPanel';

function TestHarness({
  onGenerateFsm = vi.fn()
}: {
  onGenerateFsm?: (config: ReturnType<typeof createDefaultStateManagerConfig>) => Promise<void> | void;
}) {
  const [value, setValue] = useState(createDefaultStateManagerConfig('BR', 'OUTGOING'));

  return (
    <ThemeProvider theme={createAppTheme('dark')}>
      <StateManagerPanel value={value} onChange={setValue} onGenerateFsm={onGenerateFsm} />
    </ThemeProvider>
  );
}

describe('StateManagerPanel', () => {
  it('renders scenario tabs and the seeded row count summary', () => {
    render(<TestHarness />);

    expect(screen.getByRole('tab', { name: /Happy Flow Non BOOK/i })).toBeInTheDocument();
    expect(screen.getByText('105 total rows')).toBeInTheDocument();
  });

  it(
    'supports adding rows and sub-flows',
    async () => {
      render(<TestHarness />);
      const user = userEvent.setup();

      await user.click(screen.getAllByRole('button', { name: /add row/i })[0]!);
      await waitFor(() => expect(screen.getByText('106 total rows')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /add sub-flow/i }));
      await waitFor(() => expect(screen.getByLabelText('Sub-flow 3')).toBeInTheDocument());
    },
    20000
  );

  it(
    'opens the generate dialog and confirms generation',
    async () => {
      const onGenerateFsm = vi.fn();
      render(<TestHarness onGenerateFsm={onGenerateFsm} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /save & generate fsm/i }));

      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      expect(screen.getByText('19 discovered states')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^generate$/i }));

      await waitFor(() => expect(onGenerateFsm).toHaveBeenCalledTimes(1));
    },
    20000
  );
});
