import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createAppTheme } from '../../app/theme';
import { SnapshotRequestForm } from './SnapshotRequestForm';

function renderForm() {
  const onSubmit = vi.fn();
  render(
    <ThemeProvider theme={createAppTheme('dark')}>
      <SnapshotRequestForm submitting={false} onSubmit={onSubmit} />
    </ThemeProvider>
  );
  return { onSubmit };
}

describe('SnapshotRequestForm', () => {
  it('shows validation errors when mandatory fields are missing', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /create snapshot/i }));

    expect(await screen.findByText(/Country code must be exactly 2 uppercase letters/i)).toBeInTheDocument();
    expect(await screen.findByText(/Country name must be at least 2 characters/i)).toBeInTheDocument();
    expect(await screen.findByText(/Requester email must be valid/i)).toBeInTheDocument();
  });

  it('switches to advanced JSON mode', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /advanced json/i }));

    expect(await screen.findByText(/Advanced mode accepts strict JSON/i)).toBeInTheDocument();
  });
});
