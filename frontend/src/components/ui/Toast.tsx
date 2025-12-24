"use client";

/**
 * Toast 通知组件
 * 
 * 显示临时消息提示,自动消失
 * 支持 success/error/warning/info 四种类型
 */

import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/useToast";

const toastStyles = {
    success: {
        icon: "check_circle",
        bgClass: "bg-accent-500/10 dark:bg-accent-500/20",
        borderClass: "border-accent-500/30",
        textClass: "text-accent-600 dark:text-accent-400",
        iconClass: "text-accent-500"
    },
    error: {
        icon: "error",
        bgClass: "bg-red-500/10 dark:bg-red-500/20",
        borderClass: "border-red-500/30",
        textClass: "text-red-600 dark:text-red-400",
        iconClass: "text-red-500"
    },
    warning: {
        icon: "warning",
        bgClass: "bg-yellow-500/10 dark:bg-yellow-500/20",
        borderClass: "border-yellow-500/30",
        textClass: "text-yellow-600 dark:text-yellow-400",
        iconClass: "text-yellow-500"
    },
    info: {
        icon: "info",
        bgClass: "bg-primary-500/10 dark:bg-primary-500/20",
        borderClass: "border-primary-500/30",
        textClass: "text-primary-600 dark:text-primary-400",
        iconClass: "text-primary-500"
    }
};

export function ToastContainer() {
    const { toasts, remove } = useToast();

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => {
                    const style = toastStyles[toast.type];

                    return (
                        <motion.div
                            key={toast.id}
                            layout
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="pointer-events-auto"
                        >
                            <div
                                className={`
                  flex items-start gap-3 px-4 py-3 rounded-lg border
                  backdrop-blur-xl shadow-lg min-w-[320px] max-w-[420px]
                  ${style.bgClass} ${style.borderClass}
                `}
                            >
                                {/* Icon */}
                                <span className={`material-symbols-outlined text-xl ${style.iconClass} flex-shrink-0`}>
                                    {style.icon}
                                </span>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${style.textClass}`}>
                                        {toast.message}
                                    </p>
                                </div>

                                {/* Action Button */}
                                {toast.action && (
                                    <button
                                        onClick={() => {
                                            toast.action?.onClick();
                                            remove(toast.id);
                                        }}
                                        className={`
                      text-sm font-medium px-3 py-1 rounded-md
                      hover:bg-white/10 transition-colors
                      ${style.textClass}
                    `}
                                    >
                                        {toast.action.label}
                                    </button>
                                )}

                                {/* Close Button */}
                                <button
                                    onClick={() => remove(toast.id)}
                                    className={`
                    hover:bg-white/10 rounded p-1 transition-colors
                    ${style.textClass}
                  `}
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
