export interface Stage {
  name: string;
  cost: number;
}

export interface Pipeline {
  settledBy: string;
  ran: string[];
  spent: number;
}

export function run(stages: Stage[], execute: (stage: string) => string): Pipeline {
  const ran: string[] = [];
  let spent = 0;

  for (const [index, stage] of stages.entries()) {
    ran.push(stage.name);
    spent += stage.cost;

    const last = index === stages.length - 1;
    if (execute(stage.name) === 'settled' || last) {
      return { settledBy: stage.name, ran, spent };
    }
  }

  throw new Error('an empty pipeline cannot settle anything');
}
