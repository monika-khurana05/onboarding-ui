import { Chip, Grid, Paper, Stack, Typography } from '@mui/material';
import { capabilityDomains } from './domains';

type CapabilityDomainGridProps = {
  compact?: boolean;
};

export function CapabilityDomainGrid({ compact = false }: CapabilityDomainGridProps) {
  return (
    <Grid container spacing={2}>
      {capabilityDomains.map((domain) => (
        <Grid key={domain.slug} size={{ xs: 12, md: compact ? 6 : 4 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              height: '100%',
              borderLeft: '4px solid',
              borderLeftColor: 'primary.main'
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {domain.label}
                </Typography>
                <Chip size="small" variant="outlined" label="Domain" color="primary" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {domain.description}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Repo hint: {domain.repositoryHint}
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
