import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { createAppTheme } from '../app/theme';
import { CatalogSelector, type CatalogColumn } from './CatalogSelector';

type ValidationItem = {
  id: string;
  className: string;
  keyStatus: string;
  description: string;
};

const items: ValidationItem[] = [
  {
    id: 'validation:AlphaRule',
    className: 'AlphaRule',
    keyStatus: 'ALPHA_STATUS',
    description: 'Alpha validation description'
  },
  {
    id: 'validation:BetaRule',
    className: 'BetaRule',
    keyStatus: 'BETA_STATUS',
    description: 'Beta validation description'
  }
];

const columns: CatalogColumn<ValidationItem>[] = [
  { id: 'className', label: 'Class Name', render: (item) => item.className },
  { id: 'keyStatus', label: 'Key/Status', render: (item) => item.keyStatus },
  { id: 'description', label: 'Description', render: (item) => item.description }
];

function TestHarness() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const handleToggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  return (
    <ThemeProvider theme={createAppTheme('dark')}>
      <CatalogSelector
        items={items}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        searchPlaceholder="Search validations..."
        columns={columns}
        getSearchText={(item) => `${item.className} ${item.keyStatus} ${item.description}`}
      />
    </ThemeProvider>
  );
}

describe('CatalogSelector', () => {
  it('filters items based on the search input', async () => {
    render(<TestHarness />);
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: /search validations/i }), 'BETA_STATUS');

    expect(screen.getByText('BetaRule')).toBeInTheDocument();
    expect(screen.queryByText('AlphaRule')).not.toBeInTheDocument();
  });

  it('updates selection count when toggling items', async () => {
    render(<TestHarness />);
    const user = userEvent.setup();
    const checkbox = screen.getByRole('checkbox', { name: /select AlphaRule/i });

    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(screen.getByText(/Selected: 1/i)).toBeInTheDocument();
  });
});
