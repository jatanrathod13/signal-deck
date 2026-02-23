/**
 * Orchestrator CLI
 *
 * Examples:
 *   npm run cli -- health
 *   npm run cli -- readiness-review
 *   npm run cli -- submit-task --agent agent-1 --type chat --prompt "Hello"
 */

import { OrchestrationClient } from '../sdk';

interface ParsedArgs {
  command: string;
  options: Record<string, string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = 'help', ...rest] = argv;
  const options: Record<string, string> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = 'true';
    }
  }

  return { command, options };
}

function printHelp(): void {
  console.log(`\nOrchestrator CLI\n\nCommands:\n  health\n  readiness-review\n  submit-task --agent <id> --type <type> --prompt <text>\n`);
}

async function run(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === 'help') {
    printHelp();
    return;
  }

  const client = new OrchestrationClient({
    baseUrl: process.env.ORCHESTRATOR_BASE_URL ?? 'http://localhost:3001',
    workspaceId: process.env.ORCHESTRATOR_WORKSPACE_ID,
    apiKey: process.env.ORCHESTRATOR_API_KEY
  });

  if (parsed.command === 'health') {
    const result = await client.getHealth();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (parsed.command === 'readiness-review') {
    const result = await client.getReadinessReview();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (parsed.command === 'submit-task') {
    const agentId = parsed.options.agent;
    const type = parsed.options.type;

    if (!agentId || !type) {
      throw new Error('submit-task requires --agent and --type');
    }

    const result = await client.submitTask({
      agentId,
      type,
      data: {
        prompt: parsed.options.prompt ?? ''
      }
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printHelp();
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
