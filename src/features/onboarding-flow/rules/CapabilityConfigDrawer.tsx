import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Stack,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { SelectedCapability } from '../../../models/snapshot';
import { ParamFormRenderer } from './ParamFormRenderer';
import type { CapabilityDto } from './types';
import { coerceParams, toDraftParams, validateParams } from './utils';

type CapabilityConfigDrawerProps = {
  open: boolean;
  capability?: CapabilityDto | null;
  selected?: SelectedCapability | null;
  onClose: () => void;
  onSave: (params: Record<string, unknown>) => void;
};

export function CapabilityConfigDrawer({
  open,
  capability,
  selected,
  onClose,
  onSave
}: CapabilityConfigDrawerProps) {
  const paramDefs = capability?.params ?? [];

  const initialDraft = useMemo(
    () => (capability ? toDraftParams(paramDefs, selected?.params) : {}),
    [capability, paramDefs, selected?.params]
  );

  const [draftParams, setDraftParams] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftParams(initialDraft);
    setErrors({});
  }, [initialDraft, open]);

  const handleFieldChange = (name: string, value: unknown) => {
    setDraftParams((prev) => {
      const next = { ...prev, [name]: value };
      setErrors(validateParams(paramDefs, next));
      return next;
    });
  };

  const handleSave = () => {
    const nextErrors = validateParams(paramDefs, draftParams);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    onSave(coerceParams(paramDefs, draftParams));
    onClose();
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: { xs: 320, sm: 420 },
          p: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6">{capability?.name ?? 'Configure Capability'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {capability?.description ?? 'Adjust parameters that drive this rule.'}
            </Typography>
          </Stack>

          {capability ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={capability.id} size="small" variant="outlined" />
                {capability.stage ? <Chip label={capability.stage} size="small" variant="outlined" /> : null}
              </Stack>
              {capability.dependencies?.length ? (
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Dependencies
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {capability.dependencies.map((dependency) => (
                      <Chip key={dependency} label={dependency} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Stack>
              ) : null}
            </Stack>
          ) : null}

          <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
            {paramDefs.length ? (
              <ParamFormRenderer
                paramDefs={paramDefs}
                values={draftParams}
                errors={errors}
                onChange={handleFieldChange}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No parameters are defined for this capability.
              </Typography>
            )}
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!capability}>
            Save
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
