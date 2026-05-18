import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../commands.js'

const optimize: Command = {
  type: 'prompt',
  name: 'optimize',
  description: 'Optimize a vague prompt into a clear, structured task',
  progressMessage: 'optimizing prompt',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args: string): Promise<ContentBlockParam[]> {
    const userInput = args.trim() || 'PLEASE DESCRIBE YOUR TASK HERE'

    return [
      {
        type: 'text',
        text: `You are a Prompt Optimization Specialist. The user has provided a vague or unstructured task description. Your job is to:

1. **Analyze the intent**: Understand what the user really wants to accomplish
2. **Clarify the scope**: Identify what's in scope and what's out of scope
3. **Structure the task**: Break it down into clear, actionable steps
4. **Set quality criteria**: Define what "done" looks like
5. **Execute**: After outputting the optimized prompt, immediately begin working on it

## Original User Input
${userInput}

## Your Response Format

First, output the optimized prompt in a collapsible format:

\`\`\`optimized-prompt
## Task: [Clear one-line summary]

### Background
[Context and why this matters]

### Requirements
1. [Specific requirement 1]
2. [Specific requirement 2]
...

### Technical Constraints
- [Constraint 1]
- [Constraint 2]

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

### Files to Modify
- \`path/to/file1\`
- \`path/to/file2\`
\`\`\`

Then immediately start executing the task. DO NOT ask the user to confirm — go ahead and build it.`,
      },
    ]
  },
}

export default optimize
