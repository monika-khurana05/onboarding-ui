import { Box, Stack, Typography } from '@mui/material';
import { CardSection } from '../components/CardSection';
import { PageContainer } from '../components/PageContainer';
import { Badge } from '@ui/Badge';
import { Button } from '@ui/Button';
import { Card } from '@ui/Card';
import { Input } from '@ui/Input';
import { WizardStepper } from '@ui/Stepper';

const swatches = [
  { label: 'Background', className: 'bg-background', textClassName: 'text-foreground' },
  { label: 'Surface', className: 'bg-surface', textClassName: 'text-foreground' },
  { label: 'Surface 2', className: 'bg-surface2', textClassName: 'text-foreground' },
  { label: 'Border', className: 'bg-surface border border-border', textClassName: 'text-foreground' },
  { label: 'Text', className: 'bg-foreground', textClassName: 'text-background' },
  { label: 'Muted Text', className: 'bg-muted', textClassName: 'text-background' }
];

const previewSteps = ['Configure', 'Validate', 'Review'];

export function ThemePreviewPage() {
  return (
    <PageContainer
      title="Theme Preview"
      subtitle="Dev-only palette and component checks. Use this page to validate token changes quickly."
    >
      <Stack spacing={3}>
        <CardSection title="Token Swatches" subtitle="Core background, surface, border, and text tokens.">
          <Box className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {swatches.map((swatch) => (
              <Box key={swatch.label} className="flex items-center gap-3">
                <Box className={`h-12 w-12 rounded-[var(--radius-md)] ${swatch.className}`} />
                <Box>
                  <Typography variant="subtitle2" className={swatch.textClassName}>
                    {swatch.label}
                  </Typography>
                  <Typography variant="caption" className="text-muted">
                    {swatch.className.split(' ')[0]}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </CardSection>

        <CardSection title="Buttons" subtitle="Primary, secondary, and ghost variants with states.">
          <Stack spacing={2}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Primary</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button>Default</Button>
                <Button className="!bg-primary-hover">Hover</Button>
                <Button disabled>Disabled</Button>
              </Stack>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Secondary</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button variant="secondary">Default</Button>
                <Button variant="secondary" className="!bg-surface2 !border-border">
                  Hover
                </Button>
                <Button variant="secondary" disabled>
                  Disabled
                </Button>
              </Stack>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Ghost</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button variant="ghost">Default</Button>
                <Button variant="ghost" className="!bg-surface2">
                  Hover
                </Button>
                <Button variant="ghost" disabled>
                  Disabled
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </CardSection>

        <CardSection title="Inputs" subtitle="Default, focus, error, and disabled states.">
          <Box className="grid gap-4 md:grid-cols-2">
            <Input label="Default" placeholder="Snapshot name" />
            <Input label="Focused" placeholder="Auto-focused" autoFocus />
            <Input label="Error" placeholder="Invalid value" error helperText="This field is required." />
            <Input label="Disabled" placeholder="Disabled input" disabled />
          </Box>
        </CardSection>

        <CardSection title="Badges" subtitle="Status pill tones.">
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Badge status="validated" />
            <Badge status="warning" />
            <Badge status="failed" />
            <Badge status="generated" />
            <Badge status="draft" />
          </Stack>
        </CardSection>

        <CardSection title="Stepper" subtitle="Completed, current, and upcoming states.">
          <Card variant="outlined" className="bg-surface border-border" sx={{ p: { xs: 1.5, md: 2 } }}>
            <WizardStepper steps={previewSteps} activeStep={1} />
          </Card>
        </CardSection>

        <CardSection title="Table States" subtitle="Hover and selection preview on table rows.">
          <Card variant="outlined" className="bg-surface border-border" sx={{ p: 0 }}>
            <Box className="overflow-hidden rounded-[var(--radius-md)]">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-4 py-3">Default Row</td>
                    <td className="px-4 py-3">
                      <Badge status="draft" />
                    </td>
                    <td className="px-4 py-3 text-muted">N/A</td>
                  </tr>
                  <tr className="border-b border-border bg-surface2">
                    <td className="px-4 py-3">Hover Preview</td>
                    <td className="px-4 py-3">
                      <Badge status="generated" />
                    </td>
                    <td className="px-4 py-3 text-muted">System</td>
                  </tr>
                  <tr className="bg-selection">
                    <td className="px-4 py-3">Selected Row</td>
                    <td className="px-4 py-3">
                      <Badge status="validated" />
                    </td>
                    <td className="px-4 py-3 text-muted">Operator</td>
                  </tr>
                </tbody>
              </table>
            </Box>
          </Card>
        </CardSection>
      </Stack>
    </PageContainer>
  );
}
