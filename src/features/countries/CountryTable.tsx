import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { StatusChip } from '../../components/StatusChip';
import type { Country } from './types';

import { Card } from '@ui/Card';
type CountryTableProps = {
  countries: Country[];
};

export function CountryTable({ countries }: CountryTableProps) {
  return (
    <TableContainer component={Card} variant="outlined">
      <Table aria-label="Countries table" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Country</TableCell>
            <TableCell>ISO</TableCell>
            <TableCell>Region</TableCell>
            <TableCell>Tier</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Open Tasks</TableCell>
            <TableCell>Owner</TableCell>
            <TableCell>Last Updated</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {countries.map((country) => (
            <TableRow key={country.id} hover>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {country.name}
                </Typography>
              </TableCell>
              <TableCell>{country.iso2}</TableCell>
              <TableCell>{country.region}</TableCell>
              <TableCell>{country.regulatoryTier}</TableCell>
              <TableCell>
                <StatusChip status={country.status} />
              </TableCell>
              <TableCell align="right">{country.openTasks}</TableCell>
              <TableCell>{country.owner}</TableCell>
              <TableCell>{new Date(country.lastUpdated).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}


