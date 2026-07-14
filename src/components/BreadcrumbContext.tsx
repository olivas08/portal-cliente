"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type BreadcrumbContextValue = {
  breadcrumb: string | undefined;
  setBreadcrumb: (value: string | undefined) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [breadcrumb, setBreadcrumb] = useState<string | undefined>(undefined);
  return (
    <BreadcrumbContext.Provider value={{ breadcrumb, setBreadcrumb }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

function useBreadcrumbContext() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error("useBreadcrumb must be used within a BreadcrumbProvider");
  }
  return ctx;
}

export function useBreadcrumb() {
  return useBreadcrumbContext().breadcrumb;
}

/**
 * Rendered by server-side detail pages to publish a page-specific title
 * (e.g. an order reference) for the shared mobile header, without the
 * layout needing to know about it ahead of time.
 */
export function BreadcrumbSetter({ text }: { text: string | undefined }) {
  const { setBreadcrumb } = useBreadcrumbContext();
  useEffect(() => {
    setBreadcrumb(text);
    return () => setBreadcrumb(undefined);
  }, [text, setBreadcrumb]);
  return null;
}
