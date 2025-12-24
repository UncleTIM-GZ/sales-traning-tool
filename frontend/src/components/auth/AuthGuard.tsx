"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, token } = useAuthStore();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        // Determine if we are authenticated based on store state
        // We also check localStorage directly as a fallback/initial check to avoid flicker
        const storedAuth = typeof window !== 'undefined' ? localStorage.getItem('auth-storage') : null;
        const hasToken = token || (storedAuth && JSON.parse(storedAuth).state?.token);

        if (!hasToken) {
            // Redirect to login if no token found
            const returnUrl = encodeURIComponent(pathname);
            router.push(`/login?returnUrl=${returnUrl}`);
        } else {
            setIsChecking(false);
        }
    }, [isAuthenticated, token, router, pathname]);

    if (isChecking) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background-dark">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return <>{children}</>;
}
