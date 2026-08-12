import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';

export default function AppLayout() {
    const location = useLocation();
    const element = useOutlet();

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 15, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -15, scale: 0.99 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="max-w-7xl mx-auto h-full"
                    >
                        {element}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}
