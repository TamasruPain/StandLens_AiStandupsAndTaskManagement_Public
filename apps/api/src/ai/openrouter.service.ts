import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface GeneratedDigestOutput {
  summary: string;
  highlights: string;
  concerns: string;
  aiModel: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  // Updated free-tier models (July 2026)
  // Falls back through the list if a model is rate-limited or unavailable
  private readonly freeModels = [
    'nvidia/nemotron-3-super-49b-v1:free',
    'inclusionai/ling-3.0-flash:free',
    'google/gemma-3-27b-it:free',
    'deepseek/deepseek-r1:free',
  ];

  /**
   * Extracts a JSON object from AI response text.
   * Handles cases where the model wraps JSON in markdown code fences
   * or includes thinking/reasoning text before/after the JSON.
   */
  private extractJson(text: string): Record<string, string> {
    // Try direct parse first
    try {
      return JSON.parse(text) as Record<string, string>;
    } catch {
      // Not pure JSON — try to extract from code fences or embedded JSON
    }

    // Try extracting from markdown code fences: ```json ... ``` or ``` ... ```
    const codeFenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeFenceMatch) {
      try {
        return JSON.parse(codeFenceMatch[1].trim()) as Record<string, string>;
      } catch {
        // Code fence content wasn't valid JSON
      }
    }

    // Try finding the first { ... } block in the text
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(text.substring(braceStart, braceEnd + 1)) as Record<
          string,
          string
        >;
      } catch {
        // Embedded braces weren't valid JSON
      }
    }

    throw new Error('Could not extract valid JSON from AI response');
  }

  async generateStandupDigest(
    teamName: string,
    companyName: string,
    standups: Array<{
      userName: string;
      yesterday: string;
      today: string;
      blockers?: string | null;
    }>,
  ): Promise<GeneratedDigestOutput> {
    const formattedStandups = standups
      .map(
        (s, i) => `
Developer #${i + 1}: ${s.userName}
- Yesterday: ${s.yesterday}
- Today: ${s.today}
- Blockers: ${s.blockers || 'None reported'}
`,
      )
      .join('\n---\n');

    const systemPrompt = `You are an elite Agile Technical Lead and Project Manager for ${teamName} at ${companyName}.
Your job is to read daily team standups and generate a concise, high-value Executive Digest.

You MUST return ONLY a valid JSON object with EXACTLY these three keys (no extra text, no markdown fences):
{
  "summary": "A 2-3 sentence high-level overview of team progress and direction today.",
  "highlights": "- Bullet points of major accomplishments and planned tasks for today.",
  "concerns": "- Bullet points of active blockers, risks, or items needing manager attention. If none, write 'No active blockers reported.'"
}`;

    const userPrompt = `Here are today's standup entries for ${teamName} (${standups.length} developers):\n${formattedStandups}\n\nPlease generate the JSON digest now.`;

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      this.logger.error(
        'OPENROUTER_API_KEY is not set. Falling back to local summary.',
      );
      return this.buildFallback(teamName, standups);
    }

    for (const model of this.freeModels) {
      try {
        this.logger.log(
          `Attempting AI digest generation using model: ${model}`,
        );

        const response = await axios.post<OpenRouterResponse>(
          this.apiUrl,
          {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'StandLens',
              'Content-Type': 'application/json',
            },
            timeout: 60000,
          },
        );

        const content = response.data.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response content from OpenRouter');
        }

        this.logger.log(
          `Received AI response from ${model} (${content.length} chars)`,
        );

        const parsed = this.extractJson(content);

        return {
          summary: parsed.summary || 'Team completed daily updates.',
          highlights: parsed.highlights || '- Daily standups recorded.',
          concerns: parsed.concerns || '- No blockers reported.',
          aiModel: model,
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Model ${model} failed or rate-limited: ${errorMessage}`,
        );
      }
    }

    this.logger.error(
      'All OpenRouter free models failed. Using local fallback summary.',
    );
    return this.buildFallback(teamName, standups);
  }

  private buildFallback(
    teamName: string,
    standups: Array<{
      userName: string;
      today: string;
      blockers?: string | null;
    }>,
  ): GeneratedDigestOutput {
    return {
      summary: `Team ${teamName} submitted ${standups.length} standup entries today.`,
      highlights: standups
        .map((s) => `- **${s.userName}**: ${s.today}`)
        .join('\n'),
      concerns:
        standups
          .filter((s) => s.blockers && s.blockers !== 'None')
          .map((s) => `- **${s.userName}**: ${s.blockers}`)
          .join('\n') || '- No blockers reported.',
      aiModel: 'local-fallback',
    };
  }
}
