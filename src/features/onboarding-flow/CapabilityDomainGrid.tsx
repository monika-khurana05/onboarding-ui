import { Grid, Stack, Typography } from '@mui/material';
import { capabilityDomains } from './domains';

import { Card } from '@ui/Card';
import { Badge } from '@ui/Badge';
type CapabilityDomainGridProps = {
  compact?: boolean;
};

export function CapabilityDomainGrid({ compact = false }: CapabilityDomainGridProps) {
  return (
    <Grid container spacing={2}>
      {capabilityDomains.map((domain) => (
        <Grid key={domain.slug} size={{ xs: 12, md: compact ? 6 : 4 }}>
          <Card
            variant="outlined"
            sx={{
              p: 2,
              height: '100%'
            }}
            className="border-l-4 border-primary"
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {domain.label}
                </Typography>
                <Badge size="small" variant="outlined" label="Domain" tone="primary" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {domain.description}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Repo hint: {domain.repositoryHint}
              </Typography>
            </Stack>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}


