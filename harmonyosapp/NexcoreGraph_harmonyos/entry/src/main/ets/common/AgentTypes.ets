export class AgentAction {
  id: string = '';
  kind: string = '';
  target: string = '';
  qty: number = 0;
  payload: string = '';
  risk: string = 'low';
  status: string = 'proposed';
}

export class PolicyDecision {
  allowed: boolean = false;
  requiresConfirmation: boolean = true;
  reason: string = '';
}

export class AgentTraceStep {
  name: string = '';
  status: string = 'pending';
  detail: string = '';
  startedAt: number = 0;
  endedAt: number = 0;
}
