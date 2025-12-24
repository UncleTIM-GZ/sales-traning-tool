/**
 * Toast 提示系统 Hook
 * 
 * 使用 Zustand 管理 Toast 队列
 * 提供 success/error/warning/info 四种类型
 */

import { create } from 'zustand';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
    action?: ToastAction;
}

interface ToastStore {
    toasts: Toast[];
    add: (toast: Omit<Toast, 'id'>) => void;
    remove: (id: string) => void;
    clear: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],

    add: (toast) => {
        const id = Math.random().toString(36).substring(2, 11);

        set((state) => ({
            // 最多显示3个Toast,新的在前
            toasts: [{ ...toast, id }, ...state.toasts].slice(0, 3)
        }));

        // 自动移除
        const duration = toast.duration || 5000;
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id)
            }));
        }, duration);
    },

    remove: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
    })),

    clear: () => set({ toasts: [] })
}));

/**
 * Toast API
 * 
 * 用法:
 * toast.success("操作成功");
 * toast.error("操作失败", { action: { label: "重试", onClick: retry } });
 */
export const toast = {
    success: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
        useToastStore.getState().add({ type: 'success', message, ...options });
    },

    error: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
        useToastStore.getState().add({ type: 'error', message, ...options });
    },

    warning: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
        useToastStore.getState().add({ type: 'warning', message, ...options });
    },

    info: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
        useToastStore.getState().add({ type: 'info', message, ...options });
    },
};

/**
 * useToast Hook
 * 
 * 提供访问 Toast 状态和操作的 hook
 */
export const useToast = () => {
    const toasts = useToastStore((state) => state.toasts);
    const remove = useToastStore((state) => state.remove);
    const clear = useToastStore((state) => state.clear);

    return {
        toasts,
        remove,
        clear,
        toast
    };
};
