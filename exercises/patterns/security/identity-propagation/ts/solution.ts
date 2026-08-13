export interface Principal {
  principal: string;
  scopes: string[];
}

export interface Act {
  allowed: boolean;
  principal: string | null;
  reason: string | null;
}

export function act(user: Principal | null, need: string, service: Principal): Act {
  if (user === null) return { allowed: false, principal: null, reason: 'no_identity' };

  if (!user.scopes.includes(need)) {
    return { allowed: false, principal: user.principal, reason: 'outside_user_scope' };
  }
  if (!service.scopes.includes(need)) {
    return { allowed: false, principal: user.principal, reason: 'outside_service_scope' };
  }

  return { allowed: true, principal: user.principal, reason: null };
}
