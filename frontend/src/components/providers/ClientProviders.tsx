"use client";

/**
 * 客户端Providers包装器
 * 
 * 包含所有需要在客户端运行的Provider
 */

import { ToastContainer } from "@/components/ui/Toast";

export function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <ToastContainer />
        </>
    );
}
