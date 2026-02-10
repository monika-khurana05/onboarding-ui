import { Box, Skeleton, Stack } from '@mui/material';
type SkeletonStateVariant = 'card' | 'form' | 'table';

type SkeletonStateProps = {
  variant?: SkeletonStateVariant;
  rows?: number;
};

function renderCardSkeleton() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        gap: 2
      }}
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <Stack key={`card-skeleton-${index}`} spacing={1.25}>
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="text" width="68%" />
          <Skeleton variant="text" width="82%" />
        </Stack>
      ))}
    </Box>
  );
}

function renderTableSkeleton(rows: number) {
  return (
    <Stack spacing={1}>
      <Skeleton variant="rounded" height={44} />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={`table-row-skeleton-${index}`} variant="rounded" height={38} />
      ))}
    </Stack>
  );
}

function renderFormSkeleton(rows: number) {
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2
        }}
      >
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={`form-input-skeleton-${index}`} variant="rounded" height={56} />
        ))}
      </Box>
      <Stack direction="row" justifyContent="flex-end">
        <Skeleton variant="rounded" height={38} width={150} />
      </Stack>
    </Stack>
  );
}

export function SkeletonState({ variant = 'card', rows = 5 }: SkeletonStateProps) {
  return (
    <Box role="status" aria-live="polite" sx={{ width: '100%' }}>
      {variant === 'card' ? renderCardSkeleton() : null}
      {variant === 'table' ? renderTableSkeleton(rows) : null}
      {variant === 'form' ? renderFormSkeleton(rows) : null}
    </Box>
  );
}


