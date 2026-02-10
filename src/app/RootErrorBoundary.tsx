import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { Alert, AlertTitle, Box, Container, Stack, Typography } from '@mui/material';
import { Component, type ErrorInfo, type PropsWithChildren } from 'react';

import { Button } from '@ui/Button';
import { Card } from '@ui/Card';
type RootErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export class RootErrorBoundary extends Component<PropsWithChildren, RootErrorBoundaryState> {
  override state: RootErrorBoundaryState = {
    hasError: false,
    message: undefined
  };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return {
      hasError: true,
      message: error.message
    };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Root error boundary caught an error', error, info);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        className="bg-background"
      >
        <Container maxWidth="sm">
          <Card elevation={0} variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Alert icon={<ReportProblemOutlinedIcon />} severity="error">
                <AlertTitle>Application Error</AlertTitle>
                The app encountered an unrecoverable issue.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                {this.state.message ?? 'Unknown error'}
              </Typography>
              <Button variant="primary" onClick={() => window.location.reload()}>
                Reload Application
              </Button>
            </Stack>
          </Card>
        </Container>
      </Box>
    );
  }
}


