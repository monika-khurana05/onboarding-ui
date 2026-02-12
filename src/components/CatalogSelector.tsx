import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Checkbox
} from '@mui/material';
import { useMemo, useState, type ReactNode } from 'react';

type CatalogBaseItem = {
  id: string;
  className: string;
  description: string;
};

export type CatalogColumn<T> = {
  id: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  render: (item: T) => ReactNode;
};

type CatalogSelectorProps<T extends CatalogBaseItem> = {
  items: T[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear?: () => void;
  searchPlaceholder: string;
  columns: CatalogColumn<T>[];
  getSearchText: (item: T) => string;
  getChipLabel?: (item: T) => string;
  emptyMessage?: string;
  tableAriaLabel?: string;
};

export function CatalogSelector<T extends CatalogBaseItem>({
  items,
  selectedIds,
  onToggle,
  onClear,
  searchPlaceholder,
  columns,
  getSearchText,
  getChipLabel,
  emptyMessage = 'No catalog items match the current search.',
  tableAriaLabel = 'Catalog table'
}: CatalogSelectorProps<T>) {
  const [search, setSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedSet.has(item.id)),
    [items, selectedSet]
  );
  const searchable = search.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!searchable) {
      return items;
    }
    return items.filter((item) => getSearchText(item).toLowerCase().includes(searchable));
  }, [items, searchable, getSearchText]);

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    selectedItems.forEach((item) => onToggle(item.id));
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            inputProps={{ 'aria-label': searchPlaceholder }}
            sx={{ flex: 1, minWidth: { xs: '100%', md: 280 } }}
          />
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            <Typography variant="caption" color="text.secondary">
              Selected: {selectedItems.length}
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={handleClear}
              disabled={selectedItems.length === 0}
              aria-label="Clear catalog selection"
            >
              Clear selection
            </Button>
          </Stack>
        </Stack>
        {selectedItems.length ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            {selectedItems.map((item) => (
              <Chip
                key={item.id}
                size="small"
                variant="outlined"
                label={getChipLabel ? getChipLabel(item) : item.className}
                onDelete={() => onToggle(item.id)}
              />
            ))}
          </Stack>
        ) : null}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" stickyHeader aria-label={tableAriaLabel}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Box sx={{ width: 24 }} />
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column.id} align={column.align ?? 'left'} sx={{ width: column.width }}>
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item) => {
                const checked = selectedSet.has(item.id);
                return (
                  <TableRow key={item.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={checked}
                        onChange={() => onToggle(item.id)}
                        inputProps={{ 'aria-label': `Select ${item.className}` }}
                      />
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell key={column.id} align={column.align ?? 'left'}>
                        {column.render(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1}>
                    <Typography variant="body2" color="text.secondary">
                      {emptyMessage}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Paper>
  );
}
