import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FamilyProvider, useFamily } from './context/FamilyContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import FamilySetupPage from './pages/FamilySetupPage';
import DashboardPage from './pages/DashboardPage';
import FamilyPage from './pages/FamilyPage';
import AccountsPage from './pages/AccountsPage';
import CategoriesPage from './pages/CategoriesPage';
import TransactionsPage from './pages/TransactionsPage';
import DebtsPage from './pages/DebtsPage';
import ImportPage from './pages/ImportPage';
import SettingsPage from './pages/SettingsPage';
import DraftConsolidationPage from './pages/DraftConsolidationPage';
import ShoppingListsPage from './pages/ShoppingListsPage';
import VaultUnlockGuard from './components/layout/VaultUnlockGuard';
import './i18n';

function LoadingScreen({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/30">
          <span className="text-white font-bold text-xl">F</span>
        </div>
        <div className="w-8 h-8 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
        <p className="mt-2 text-sm font-medium text-text-muted-light dark:text-text-muted-dark animate-pulse">{message}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen message="Consultando preferencias..." />;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen message="Consultando preferencias..." />;
  return user ? <Navigate to="/" /> : <>{children}</>;
}

// Wraps app content — if no family, show setup page
function FamilyGuard({ children }: { children: React.ReactNode }) {
  const { family, loading } = useFamily();
  const [showSetup, setShowSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    // If they have no family or need vault setup, enforce setup mode
    if (!family || !family.isVaultEnabled) {
      if (showSetup !== true) {
        setShowSetup(true);
      }
    } else if (showSetup === null) {
      // If we are initialized and they are fully set up, skip setup.
      setShowSetup(false);
    }
  }, [loading, family?.isVaultEnabled, family, showSetup]);

  if (loading || showSetup === null) return <LoadingScreen />;

  if (showSetup) {
    return <FamilySetupPage onComplete={() => setShowSetup(false)} />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <FamilyProvider>
              <FamilyGuard>
                <VaultUnlockGuard>
                  <AppLayout />
                </VaultUnlockGuard>
              </FamilyGuard>
            </FamilyProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/debts" element={<DebtsPage />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/shopping" element={<ShoppingListsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/import/draft/:batchId" element={<DraftConsolidationPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: '!bg-surface-light dark:!bg-surface-dark !text-text-light dark:!text-text-dark !shadow-lg !rounded-xl !border !border-gray-100 dark:!border-primary-800/30',
              duration: 3000,
            }}
          />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
