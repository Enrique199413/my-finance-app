import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppLayout() {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-auto">
                <div className="max-w-7xl mx-auto animate-fade-in">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
