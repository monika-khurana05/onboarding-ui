import type { PropsWithChildren, ReactNode } from 'react';
import { CardSection } from './CardSection';

type SectionCardProps = PropsWithChildren<{
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}>;

export function SectionCard({ title, subtitle, actions, children }: SectionCardProps) {
  return <CardSection title={title} subtitle={subtitle} actions={actions}>{children}</CardSection>;
}


