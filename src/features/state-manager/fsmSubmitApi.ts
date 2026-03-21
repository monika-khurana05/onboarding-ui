import {
  getFsmOperationStatus as getFsmOperationStatusRequest,
  submitFsm as submitFsmRequest
} from '../../api/client';
import type {
  FsmOperationStatusResponseDto,
  SubmitFsmRequestDto,
  SubmitFsmResponseDto
} from '../../api/types';
import type { FlowDirection } from './types';

export type SubmitFsmPayload = SubmitFsmRequestDto;
export type SubmitFsmResponse = SubmitFsmResponseDto;
export type FsmOperationStatusResponse = FsmOperationStatusResponseDto;

export function buildFsmFilePath(countryCode: string, direction: FlowDirection): string {
  const normalizedCountryCode = countryCode.trim().toLowerCase();
  const normalizedDirection = direction.trim().toLowerCase();
  return `fsm-service/src/main/resources/${normalizedCountryCode}/${normalizedDirection}/${normalizedCountryCode}-${normalizedDirection}-fsm.yaml`;
}

export function buildSubmitPayload(
  countryCode: string,
  direction: FlowDirection,
  workflowKey: string,
  yamlContent: string,
  commitMessage: string,
  branchName?: string
): SubmitFsmPayload {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  const normalizedWorkflowKey = workflowKey.trim();
  const normalizedCommitMessage = commitMessage.trim();
  const normalizedBranchName = branchName?.trim();

  return {
    countryCode: normalizedCountryCode,
    direction,
    workflowKey: normalizedWorkflowKey,
    yamlContent,
    commitMessage: normalizedCommitMessage,
    ...(normalizedBranchName ? { branchName: normalizedBranchName } : {})
  };
}

export async function submitFsm(payload: SubmitFsmPayload): Promise<SubmitFsmResponse> {
  return submitFsmRequest(payload);
}

export async function getFsmOperationStatus(
  operationId: string
): Promise<FsmOperationStatusResponse> {
  return getFsmOperationStatusRequest(operationId);
}
