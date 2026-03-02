import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTenants } from '../context/TenantContext';

export function TopBar() {
  const [isOpen, setIsOpen] = useState(false);
  const { tenants, currentTenant, currentTenantId, setCurrentTenantId } = useTenants();

  const handleTenantSelect = (tenantId: string) => {
    setCurrentTenantId(tenantId);
    setIsOpen(false);
  };

  const displayStatus = (status: string) =>
    status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="h-14 border-b border-border bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* Tenant Selector */}
        <div className="relative">
          {tenants.length === 0 ? (
            <button
              disabled
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground opacity-50 cursor-not-allowed"
            >
              No tenants
            </button>
          ) : (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
            >
              <span className="text-sm">{currentTenant?.name || 'Select Tenant'}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {isOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-border rounded-lg shadow-lg z-20 py-1">
                {tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleTenantSelect(tenant.id)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between"
                  >
                    <span>{tenant.name}</span>
                    {currentTenantId === tenant.id && (
                      <span className="text-xs text-muted-foreground">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Status Badge */}
        {currentTenant && (
          <div
            className={`
              px-2 py-0.5 rounded text-xs
              ${
                currentTenant.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }
            `}
          >
            {displayStatus(currentTenant.status)}
          </div>
        )}
      </div>
    </div>
  );
}
