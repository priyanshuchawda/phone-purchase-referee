"use server";

import {
  loadPhonesFromCSV,
  getPhonesInBudget,
  getPhonesByPriceRange,
  PhoneData,
} from "@/lib/csv-loader";
import {
  compareAndSelectPhone,
  compareWithGrounding,
  PhoneComparison,
} from "@/ai/gemini-comparison";

export interface CompareState {
  comparison: PhoneComparison | null;
  phones: PhoneData[];
  sources: Array<{ title: string; uri: string }>;
  error: string | null;
  processingTime: number;
}

/**
 * Server Action: Load all phones from CSV
 */
export async function loadPhones(): Promise<PhoneData[]> {
  return loadPhonesFromCSV();
}

/**
 * Server Action: Compare phones based on budget and priorities (AI does the selection)
 */
export async function comparePhones(
  _prevState: CompareState,
  formData: FormData
): Promise<CompareState> {
  const startTime = Date.now();
  
  try {
    // Parse budget
    const budgetStr = formData.get("budget") as string;
    const budget = budgetStr ? parseFloat(budgetStr) : undefined;

    // Parse priorities
    const prioritiesStr = formData.get("priorities") as string;
    const priorities = prioritiesStr
      ? prioritiesStr.split(",").map(p => p.trim()).filter(Boolean)
      : [];

    if (priorities.length === 0) {
      return {
        comparison: null,
        phones: [],
        sources: [],
        error: "Please select at least one priority (battery, camera, performance, etc.)",
        processingTime: 0,
      };
    }

    // Parse additional requirements
    const additionalRequirements = formData.get("requirements") as string;
    const require5G = formData.get("require_5g") === "on";
    const useGrounding = formData.get("use_grounding") === "on";

    // Load phones from CSV
    let phones: PhoneData[];
    
    if (budget) {
      phones = getPhonesInBudget(budget);
      
      // If no phones in exact budget, get slightly above
      if (phones.length < 3) {
        phones = loadPhonesFromCSV().filter(p => p.price_inr <= budget * 1.2);
      }
    } else {
      // No budget specified, load all phones
      phones = loadPhonesFromCSV();
    }

    // Filter by 5G if required
    if (require5G) {
      phones = phones.filter(p => p.has_5g);
    }

    if (phones.length === 0) {
      return {
        comparison: null,
        phones: [],
        sources: [],
        error: `No phones found within budget ₹${budget?.toLocaleString('en-IN')}. Try increasing your budget.`,
        processingTime: Date.now() - startTime,
      };
    }

    // Limit to top 10 phones by price relevance for faster comparison
    if (phones.length > 10) {
      phones = phones.slice(0, 10);
    }

    console.log(`Comparing ${phones.length} phones with priorities: ${priorities.join(", ")}`);

    // Have AI compare and select
    let comparison: PhoneComparison;
    let sources: Array<{ title: string; uri: string }> = [];

    if (useGrounding) {
      console.log("Using Google Search grounding...");
      const result = await compareWithGrounding({
        phones,
        budget,
        priorities,
        additionalRequirements: require5G 
          ? `Must have 5G. ${additionalRequirements || ''}`
          : additionalRequirements,
      });
      comparison = result.comparison;
      sources = result.sources;
    } else {
      comparison = await compareAndSelectPhone({
        phones,
        budget,
        priorities,
        additionalRequirements: require5G
          ? `Must have 5G. ${additionalRequirements || ''}`
          : additionalRequirements,
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`Comparison complete in ${processingTime}ms`);

    return {
      comparison,
      phones,
      sources,
      error: null,
      processingTime,
    };
  } catch (error) {
    console.error("Comparison error:", error);
    return {
      comparison: null,
      phones: [],
      sources: [],
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Server Action: Get phones by price range
 */
export async function getPhonesByRange(priceRange: string): Promise<PhoneData[]> {
  try {
    return getPhonesByPriceRange(priceRange);
  } catch (error) {
    console.error("Error loading phones by range:", error);
    return [];
  }
}

/**
 * Server Action: Get all available phones
 */
export async function getAllPhones(): Promise<PhoneData[]> {
  try {
    return loadPhonesFromCSV();
  } catch (error) {
    console.error("Error loading phones:", error);
    return [];
  }
}

/**
 * Server Action: Run AI comparison on specific phones
 */
export async function runAIComparison(
  phones: PhoneData[],
  budget: number | undefined,
  priorities: string[]
): Promise<PhoneComparison> {
  return await compareAndSelectPhone({
    phones,
    budget,
    priorities,
    additionalRequirements: "",
  });
}
