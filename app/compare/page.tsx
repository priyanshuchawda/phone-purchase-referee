"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PhoneData } from "@/lib/csv-loader";
import { PhoneComparison } from "@/ai/gemini-comparison";
import { getAllPhones, runAIComparison } from "@/app/actions";

const PhoneSpecCard = React.memo(({ phone }: { phone: PhoneData }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{phone.name}</h3>
          <p className="text-sm text-gray-500">{phone.brand}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary-600">
            ₹{phone.price_inr.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-gray-500 uppercase">{phone.price_range}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-gray-500 text-xs">Battery</div>
          <div className="font-semibold text-gray-900">{phone.battery_mah}mAh</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-gray-500 text-xs">Camera</div>
          <div className="font-semibold text-gray-900">{phone.camera_mp}MP</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-gray-500 text-xs">Display</div>
          <div className="font-semibold text-gray-900">{phone.screen_inches}" {phone.refresh_rate}Hz</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-gray-500 text-xs">RAM/Storage</div>
          <div className="font-semibold text-gray-900">{phone.ram_gb}GB/{phone.storage_gb}GB</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg col-span-2">
          <div className="text-gray-500 text-xs">Processor</div>
          <div className="font-semibold text-gray-900 text-xs">{phone.processor}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-gray-500 text-xs">Charging</div>
          <div className="font-semibold text-gray-900">{phone.fast_charging_w}W</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-gray-500 text-xs">5G</div>
          <div className="font-semibold text-gray-900">{phone.has_5g ? '✅ Yes' : '❌ No'}</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500 mb-1">Key Features</div>
        <div className="text-sm text-gray-700">{phone.key_features}</div>
      </div>
    </div>
  );
});

PhoneSpecCard.displayName = 'PhoneSpecCard';

export default function ComparePage() {
  const [allPhones, setAllPhones] = useState<PhoneData[]>([]);
  const [phonesLoading, setPhonesLoading] = useState(true);
  const [selectedPhone1, setSelectedPhone1] = useState<string>("");
  const [selectedPhone2, setSelectedPhone2] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [priorities, setPriorities] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<PhoneComparison | null>(null);
  const [phones, setPhones] = useState<PhoneData[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load phones on mount
  useEffect(() => {
    async function loadPhonesData() {
      setPhonesLoading(true);
      const phonesData = await getAllPhones();
      setAllPhones(phonesData);
      setPhonesLoading(false);
    }
    loadPhonesData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setComparison(null);

    try {
      const priorityList = priorities.split(",").map(p => p.trim()).filter(Boolean);

      if (priorityList.length === 0) {
        setError("Please enter at least one priority (e.g., battery, camera, performance)");
        setLoading(false);
        return;
      }

      if (allPhones.length === 0) {
        setError("Phone database is not loaded. Please refresh the page.");
        setLoading(false);
        return;
      }

      const budgetNum = budget ? parseFloat(budget) : undefined;

      // Filter phones by budget
      let filteredPhones = allPhones;
      if (budgetNum) {
        filteredPhones = allPhones.filter(p => p.price_inr <= budgetNum * 1.1); // 10% tolerance
      }

      if (filteredPhones.length < 2) {
        setError(`Not enough phones found within budget ₹${budgetNum?.toLocaleString('en-IN')}`);
        setLoading(false);
        return;
      }

      // Have AI pick the top 2 phones based on priorities
      console.log("AI selecting top 2 phones based on priorities...");
      
      const result = await runAIComparison(filteredPhones, budgetNum, priorityList);

      // Extract the top 2 phones from the result
      const topPhones = filteredPhones
        .filter(p => 
          p.id === result.selected_phone.phone_id || 
          p.id === result.runner_up?.phone_id
        )
        .slice(0, 2);

      if (topPhones.length === 2 && topPhones[0] && topPhones[1]) {
        setSelectedPhone1(topPhones[0].id);
        setSelectedPhone2(topPhones[1].id);
        setPhones(topPhones);
        
        // Compare only these 2 phones
        const finalComparison = await runAIComparison(topPhones, budgetNum, priorityList);
        
        setComparison(finalComparison);
      } else {
        setError("Unable to select 2 phones for comparison");
      }

      setLoading(false);
    } catch (err) {
      console.error("Comparison error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  const phone1 = phones.find(p => p.id === selectedPhone1);
  const phone2 = phones.find(p => p.id === selectedPhone2);

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 transition-colors mb-4 font-medium"
        >
          <span>←</span>
          <span>Back to Home</span>
        </Link>
        <h1 className="text-4xl font-extrabold text-gray-900 flex items-center gap-3">
          <span className="text-4xl">🎯</span>
          <span>AI Phone Comparison - India</span>
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          Set your budget and priorities. AI will pick the top 2 phones and compare them for you.
        </p>
      </div>

      {/* Comparison Form */}
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 mb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Budget */}
          <div>
            <label htmlFor="budget" className="block text-sm font-semibold text-gray-900 mb-2">
              Budget (₹)
            </label>
            <input
              type="number"
              id="budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g., 30000"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
            />
            <p className="mt-1 text-sm text-gray-500">Optional. Leave blank to consider all phones.</p>
          </div>

          {/* Priorities */}
          <div>
            <label htmlFor="priorities" className="block text-sm font-semibold text-gray-900 mb-2">
              Priorities (comma-separated)
            </label>
            <input
              type="text"
              id="priorities"
              value={priorities}
              onChange={(e) => setPriorities(e.target.value)}
              placeholder="e.g., battery, camera, performance, gaming"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
            />
            <p className="mt-1 text-sm text-gray-500">
              Example: battery, camera, gaming, fast charging, display quality
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || phonesLoading}
            className="w-full bg-gradient-to-r from-primary-600 to-accent-600 text-white font-bold py-4 px-6 rounded-xl hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {phonesLoading ? "Loading phones..." : loading ? "AI is analyzing..." : "Find & Compare Best 2 Phones"}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Phone Selection Display */}
      {phone1 && phone2 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>🤖</span>
            <span>AI Selected These 2 Phones for You</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-3">
                <div className="text-sm font-semibold text-primary-700">Phone 1</div>
                <div className="text-lg font-bold text-gray-900">{phone1.name}</div>
              </div>
              <PhoneSpecCard phone={phone1} />
            </div>
            <div className="space-y-2">
              <div className="bg-accent-50 border-2 border-accent-200 rounded-xl p-3">
                <div className="text-sm font-semibold text-accent-700">Phone 2</div>
                <div className="text-lg font-bold text-gray-900">{phone2.name}</div>
              </div>
              <PhoneSpecCard phone={phone2} />
            </div>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-8 animate-fade-in">
          {/* Winner */}
          <div className="bg-gradient-to-br from-success-50 to-primary-50 rounded-2xl p-8 border-2 border-success-200 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">🏆</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Best Match for Your Priorities</h2>
                <p className="text-sm text-gray-600">Recommended by AI Analysis</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 mb-4">
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {comparison.selected_phone.phone_name}
              </div>
              <div className="text-lg text-gray-700 mb-4">
                {comparison.selected_phone.reason_for_selection}
              </div>
              <div className="bg-success-50 rounded-lg p-4">
                <div className="text-sm font-semibold text-success-700 mb-1">How It Matches Your Priorities</div>
                <div className="text-gray-800">{comparison.selected_phone.how_it_matches_priorities}</div>
              </div>
            </div>
          </div>

          {/* Runner Up */}
          {comparison.runner_up && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>🥈</span>
                <span>Runner Up: {comparison.runner_up.phone_name}</span>
              </h3>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-700">{comparison.runner_up.why_not_selected}</p>
              </div>
            </div>
          )}

          {/* Trade-offs */}
          {comparison.tradeoff_analysis.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>⚖️</span>
                <span>Trade-offs Explained</span>
              </h3>
              
              <div className="space-y-4">
                {comparison.tradeoff_analysis.map((tradeoff: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-5 bg-gradient-to-r from-gray-50 to-white">
                    <div className="font-semibold text-lg text-gray-900 mb-3">
                      {tradeoff.phone_a} vs {tradeoff.phone_b}
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-3">
                      <div className="bg-success-50 border border-success-200 rounded-lg p-3">
                        <div className="text-xs font-semibold text-success-700 uppercase mb-1">Gains</div>
                        <div className="text-sm text-gray-900">{tradeoff.what_a_gains}</div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-xs font-semibold text-red-700 uppercase mb-1">Sacrifices</div>
                        <div className="text-sm text-gray-900">{tradeoff.what_a_loses}</div>
                      </div>
                    </div>
                    
                    <div className="bg-primary-50 rounded-lg p-3">
                      <div className="text-xs font-semibold text-primary-700 uppercase mb-1">Recommendation</div>
                      <div className="text-sm text-gray-900">{tradeoff.recommendation}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spec Comparison */}
          {comparison.specification_comparison.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>📊</span>
                <span>Detailed Spec Comparison</span>
              </h3>
              
              <div className="space-y-3">
                {comparison.specification_comparison.map((spec: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{spec.spec_name}</h4>
                      <span className="text-xs bg-success-100 text-success-700 px-2 py-1 rounded-full">
                        Winner: {spec.winner}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {Object.entries(spec.values).map(([phone, value]: [string, any]) => (
                        <div key={phone} className="bg-white rounded p-2 border border-gray-200">
                          <div className="text-xs text-gray-500">{phone}</div>
                          <div className="font-semibold text-sm text-gray-900">{value}</div>
                        </div>
                      ))}
                    </div>
                    
                    <p className="text-sm text-gray-600 mt-2">{spec.analysis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📝</span>
              <span>Summary</span>
            </h3>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{comparison.summary}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
