import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { PhoneData } from "@/lib/csv-loader";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Sanitize JSON string by escaping control characters
 */
function sanitizeJSON(text: string): string {
  // Escape control characters properly for JSON
  return text
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/\n/g, '\\n')     // Escape newlines
      .replace(/\r/g, '\\r')     // Escape carriage returns
      .replace(/\t/g, '\\t')     // Escape tabs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');  // Remove other control chars
}

// ============================================
// SCHEMAS FOR GEMINI COMPARISON OUTPUT
// ============================================

const PhoneComparisonSchema = z.object({
  selected_phone: z.object({
    phone_id: z.string(),
    phone_name: z.string(),
    reason_for_selection: z.string(),
    how_it_matches_priorities: z.string(),
  }),
  
  runner_up: z.object({
    phone_id: z.string(),
    phone_name: z.string(),
    why_not_selected: z.string(),
  }).optional(),

  all_phones_evaluated: z.array(z.object({
    phone_id: z.string(),
    phone_name: z.string(),
    price_inr: z.number(),
    key_strengths: z.array(z.string()),
    key_weaknesses: z.array(z.string()),
    score_by_priority: z.record(z.string(), z.number()),
  })),

  tradeoff_analysis: z.array(z.object({
    phone_a: z.string(),
    phone_b: z.string(),
    what_a_gains: z.string(),
    what_a_loses: z.string(),
    recommendation: z.string(),
  })),

  specification_comparison: z.array(z.object({
    spec_name: z.string(),
    values: z.record(z.string(), z.union([z.string(), z.number()])),
    winner: z.string(),
    analysis: z.string(),
  })),

  budget_analysis: z.object({
    selected_phone_price: z.number(),
    price_range: z.string(),
    value_for_money_explanation: z.string(),
    alternative_if_budget_increases: z.string().nullable().optional(),
    alternative_if_budget_decreases: z.string().nullable().optional(),
  }),

  summary: z.string(),
});

export type PhoneComparison = z.infer<typeof PhoneComparisonSchema>;

// ============================================
// MAIN COMPARISON FUNCTION
// ============================================

export interface ComparisonRequest {
  phones: PhoneData[];
  budget?: number;
  priorities: string[];
  additionalRequirements?: string;
}

/**
 * Have Gemini compare phones and select the best one based on priorities
 */
export async function compareAndSelectPhone(
  request: ComparisonRequest
): Promise<PhoneComparison> {
  const { phones, budget, priorities, additionalRequirements } = request;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  if (phones.length === 0) {
    throw new Error("No phones to compare");
  }

  // Format phone data for Gemini
  const phoneDescriptions = phones.map(phone => `
**${phone.name}** (ID: ${phone.id})
- Price: ₹${phone.price_inr.toLocaleString('en-IN')}
- Brand: ${phone.brand}
- Price Range: ${phone.price_range}
- Battery: ${phone.battery_mah}mAh
- Camera: ${phone.camera_mp}MP main (${phone.rear_camera_details})
- Display: ${phone.screen_inches}" ${phone.display_type} at ${phone.refresh_rate}Hz
- RAM/Storage: ${phone.ram_gb}GB / ${phone.storage_gb}GB
- Processor: ${phone.processor}
- Fast Charging: ${phone.fast_charging_w}W
- 5G: ${phone.has_5g ? 'Yes' : 'No'}
- Weight: ${phone.weight_grams}g
- OS: ${phone.os}
- Key Features: ${phone.key_features}
- Front Camera: ${phone.front_camera_mp}MP
  `).join('\n\n---\n');

  const prompt = `You are a phone expert helping an Indian customer choose the best phone from the following options.

**User's Budget:** ${budget ? `₹${budget.toLocaleString('en-IN')}` : 'Not specified'}
**User's Priorities (in order of importance):** ${priorities.join(', ')}
${additionalRequirements ? `**Additional Requirements:** ${additionalRequirements}` : ''}

**Phones to Compare:**
${phoneDescriptions}

Your task:
1. **Analyze each phone** against the user's priorities
2. **Select the BEST phone** that matches the priorities and budget
3. **Explain WHY** this phone is best for this user's specific needs
4. **Show detailed trade-offs** between top contenders with SPECIFIC NUMBERS
5. **Compare specifications** across all phones
6. **Provide budget analysis** - value for money and alternatives

IMPORTANT RULES:
- Use SPECIFIC NUMBERS in comparisons (e.g., "5000mAh vs 4500mAh", "200MP vs 50MP", "₹25,999 vs ₹34,999")
- Explain HOW each phone performs for EACH priority
- Show what you GAIN and what you LOSE when choosing one phone over another
- Consider the Indian market context (value for money is important)
- If budget is specified, prioritize phones within budget but mention slightly over-budget options if significantly better
- Consider real-world usage, not just specs on paper
- Mention brand reliability and after-sales service when relevant

Respond with a JSON object matching this structure:
{
  "selected_phone": {
    "phone_id": "string (exact ID from the list)",
    "phone_name": "string",
    "reason_for_selection": "string (detailed explanation)",
    "how_it_matches_priorities": "string (explain for each priority)"
  },
  "runner_up": {
    "phone_id": "string",
    "phone_name": "string",
    "why_not_selected": "string"
  },
  "all_phones_evaluated": [{
    "phone_id": "string",
    "phone_name": "string",
    "price_inr": number,
    "key_strengths": ["string", "string", "string"],
    "key_weaknesses": ["string", "string", "string"],
    "score_by_priority": {"priority_name": number_0_to_10}
  }],
  "tradeoff_analysis": [{
    "phone_a": "string",
    "phone_b": "string",
    "what_a_gains": "string (with specific numbers)",
    "what_a_loses": "string (with specific numbers)",
    "recommendation": "string"
  }],
  "specification_comparison": [{
    "spec_name": "string",
    "values": {"phone_name": "value"},
    "winner": "string",
    "analysis": "string"
  }],
  "budget_analysis": {
    "selected_phone_price": number,
    "price_range": "string",
    "value_for_money_explanation": "string",
    "alternative_if_budget_increases": "string (optional)",
    "alternative_if_budget_decreases": "string (optional)"
  },
  "summary": "string (2-3 paragraphs)"
}`;

  // Try primary model first, fallback to lite if it fails
  const modelsToTry = ["gemini-2.0-flash-exp", "gemini-1.5-flash"];
  let lastError: Error | null = null;
  
  for (let i = 0; i < modelsToTry.length; i++) {
    const modelName = modelsToTry[i];
    
    try {
      console.log(`Attempting with model: ${modelName}`);
      
      const model = genAI.getGenerativeModel({
        model: modelName,
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = text;
      if (text.includes("```json")) {
        jsonText = text.split("```json")[1]?.split("```")[0]?.trim() || text;
      } else if (text.includes("```")) {
        jsonText = text.split("```")[1]?.split("```")[0]?.trim() || text;
      }
      
      // Log for debugging
      console.log(`Model ${modelName} - Raw response:`, text.substring(0, 500));
      console.log(`Model ${modelName} - Extracted JSON:`, jsonText.substring(0, 500));
      
      // Try parsing the response
      const parsed = JSON.parse(jsonText);
      const validated = PhoneComparisonSchema.parse(parsed);
      
      console.log(`✅ Successfully used model: ${modelName}`);
      return validated;
      
    } catch (error) {
      console.error(`❌ Model ${modelName} failed:`, error instanceof Error ? error.message : 'Unknown error');
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // If this is not the last model, continue to the next one
      if (i < modelsToTry.length - 1) {
        console.log(`Falling back to next model...`);
        continue;
      }
    }
  }
  
  // If all models failed, throw the last error
  throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Get comparison with search grounding (for latest prices/reviews)
 */
export async function compareWithGrounding(
  request: ComparisonRequest
): Promise<{
  comparison: PhoneComparison;
  sources: Array<{ title: string; uri: string }>;
}> {
  // For now, use the same function (Google Search grounding requires special API access)
  const comparison = await compareAndSelectPhone(request);
  return {
    comparison,
    sources: [],
  };
}

/**
 * Simple helper to format price in Indian rupees
 */
export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
