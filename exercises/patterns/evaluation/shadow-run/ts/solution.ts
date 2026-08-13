export interface Exchange {
  id: string;
  production: string;
  candidate: string | null;
}

export interface Shadow {
  served: Record<string, string>;
  divergences: Exchange[];
  agreement: number;
}

export function shadow(traffic: Exchange[]): Shadow {
  const served: Record<string, string> = {};
  const divergences: Exchange[] = [];

  for (const exchange of traffic) {
    served[exchange.id] = exchange.production;
    if (exchange.candidate !== exchange.production) divergences.push(exchange);
  }

  const agreed = traffic.length - divergences.length;
  const agreement =
    traffic.length === 0 ? 1 : Math.floor((agreed / traffic.length) * 10000 + 0.5) / 10000;

  return { served, divergences, agreement };
}
