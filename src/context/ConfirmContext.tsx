import { createContext, useContext, useState, type ReactNode, useCallback } from 'react';
import { Modal } from '../components/ui/Modal';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';

interface ConfirmOptions {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

interface ConfirmContextType {
    confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
}

interface ConfirmProviderProps {
    children: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [options, setOptions] = useState<ConfirmOptions>({});
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
        setMessage(message);
        setOptions(options);
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            setResolvePromise(() => resolve);
        });
    }, []);

    const handleConfirm = () => {
        setIsOpen(false);
        if (resolvePromise) resolvePromise(true);
    };

    const handleCancel = () => {
        setIsOpen(false);
        if (resolvePromise) resolvePromise(false);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <Modal isOpen={isOpen} onClose={handleCancel} title={options.title || t('common.confirm')}>
                <div className="flex flex-col items-center sm:flex-row sm:items-start text-center sm:text-left">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-danger-500/10 dark:bg-danger-500/20 sm:mx-0 sm:h-10 sm:w-10">
                        <AlertCircle className="h-6 w-6 text-danger-600 dark:text-danger-400" aria-hidden="true" />
                    </div>
                    <div className="mt-3 sm:mt-0 sm:ml-4 flex-1">
                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                            {message}
                        </p>
                    </div>
                </div>
                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-primary-800/30 bg-surface-light dark:bg-surface-card-dark px-4 py-2 text-base font-medium text-text-light dark:text-text-dark shadow-sm hover:bg-gray-50 dark:hover:bg-primary-900/20 focus:outline-none sm:w-auto sm:text-sm"
                    >
                        {options.cancelText || t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className={`w-full inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none sm:w-auto sm:text-sm ${
                            options.isDestructive !== false 
                                ? 'bg-danger-600 hover:bg-danger-700' 
                                : 'bg-primary-600 hover:bg-primary-700'
                        }`}
                    >
                        {options.confirmText || t('common.confirm')}
                    </button>
                </div>
            </Modal>
        </ConfirmContext.Provider>
    );
}
