import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, Dna, Loader2 } from "lucide-react";
import { getGenomes, type GenomeResponse } from "../services/api";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatDateTime = (dateString: string) => {
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }) + " " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function GenomesPage() {
  const navigate = useNavigate();
  const [genomes, setGenomes] = useState<GenomeResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGenomes("acme")
      .then(setGenomes)
      .catch(() => setGenomes([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl mb-1">
              Application Genomes
            </h1>
            <p className="text-sm text-muted-foreground">
              Captured application structures, workflows, and migration
              analytics.
            </p>
          </div>
          <Link
            to="/genomes/capture"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Capture Genome
          </Link>
        </div>

        {/* Table */}
        <div className="bg-white border border-border rounded-lg overflow-x-auto">
          <table className="min-w-[1200px] w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Application Name
                </th>
                <th className="text-left px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Vendor
                </th>
                <th className="text-left px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Source Platform
                </th>
                <th className="text-left px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Target Platform
                </th>
                <th className="text-right px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Objects
                </th>
                <th className="text-right px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Workflows
                </th>
                <th className="text-right px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Legacy Cost
                </th>
                <th className="text-right px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Migrated Cost
                </th>
                <th className="text-right px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Operational Cost
                </th>
                <th className="text-left px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Created
                </th>
                <th className="text-left px-6 py-3 text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    <Loader2 className="w-6 h-6 text-gray-400 mx-auto mb-2 animate-spin" />
                    Loading genomes…
                  </td>
                </tr>
              ) : genomes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    <Dna className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p>
                      No genomes captured yet. Click Capture Genome to get
                      started.
                    </p>
                  </td>
                </tr>
              ) : (
                genomes.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => navigate(`/genomes/${g.id}`)}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {g.application_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {g.vendor}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
                        {g.source_platform}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono bg-blue-50 px-2 py-1 rounded text-blue-700">
                        {g.target_platform}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 font-mono whitespace-nowrap">
                      {g.object_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 font-mono whitespace-nowrap">
                      {g.workflow_count}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 font-mono whitespace-nowrap">
                      {formatCurrency(g.legacy_cost)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 font-mono whitespace-nowrap">
                      {formatCurrency(g.migrated_cost)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600 font-mono whitespace-nowrap">
                      {formatCurrency(g.operational_cost)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {formatDateTime(g.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {formatDateTime(g.updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}
