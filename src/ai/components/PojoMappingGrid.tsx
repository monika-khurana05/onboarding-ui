import { Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { PojoMappingSheet } from '../types';

type PojoMappingGridProps = {
  rows: PojoMappingSheet['rows'];
  renderRowActions?: (row: PojoMappingSheet['rows'][number], index: number) => ReactNode;
};

const columns = [
  { key: 'description', label: 'Description' },
  { key: 'inputPain001v6Field', label: 'Input: PAIN001V6 Field' },
  { key: 'outputFndtMessage', label: 'Output: FNDT Message' },
  { key: 'ccapiJsonTags', label: 'CCAPI JSON Tags' },
  { key: 'xpayCanonicalPojoMapping', label: 'XPAY Canonical POJO Mapping' },
  { key: 'transformation', label: 'Transformation' },
  { key: 'logic', label: 'Logic' },
  { key: 'sampleValue', label: 'Sample value' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'openQuestion', label: 'Open Question' }
] as const;

function formatCellValue(row: PojoMappingSheet['rows'][number], key: (typeof columns)[number]['key']) {
  if (key === 'ccapiJsonTags') {
    return row.ccapiJsonTags?.length ? row.ccapiJsonTags.join(', ') : '-';
  }
  if (key === 'confidence') {
    const confidence = Number.isFinite(row.confidence) ? row.confidence : 0;
    return `${Math.round(confidence * 100)}%`;
  }
  if (key === 'openQuestion') {
    return row.openQuestion?.trim() ? row.openQuestion : '-';
  }
  const value = row[key];
  return value ? String(value) : '-';
}

export function PojoMappingGrid({ rows, renderRowActions }: PojoMappingGridProps) {
  return (
    <TableContainer
      component={Box}
      sx={(theme) => ({
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        maxWidth: '100%',
        overflowX: 'auto'
      })}
    >
      <Table
        size="small"
        stickyHeader
        sx={{
          minWidth: 1200,
          '& th, & td': {
            px: 1,
            py: 0.75,
            whiteSpace: 'nowrap'
          }
        }}
      >
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.key}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {column.label}
                </Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => {
            const rowKey = `${row.description}-${index}`;
            return (
              <TableRow key={rowKey} hover>
                {columns.map((column) => {
                  const actions = column.key === 'description' ? renderRowActions?.(row, index) : null;
                  return (
                    <TableCell key={`${rowKey}-${column.key}`}>
                      {actions ? (
                        <Stack spacing={0.5}>
                          <Typography variant="body2">{formatCellValue(row, column.key)}</Typography>
                          <Box>{actions}</Box>
                        </Stack>
                      ) : (
                        <Typography variant="body2">{formatCellValue(row, column.key)}</Typography>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <Typography variant="body2" color="text.secondary">
                  No mapping rows available.
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
