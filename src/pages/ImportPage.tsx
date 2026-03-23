import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { getAccountsByFamily } from '../services/accounts.service';
import { BANK_PRESETS, parseCSV, mapRowsToDraftTransactions } from '../services/csv-parser.service';
import type { BankAccount, CSVColumnMapping, DraftBatch } from '../types';
import { createDraftBatch, saveDraftTransactions, subscribeToFamilyDrafts, deleteDraftBatch } from '../services/drafts.service';
import {
    Upload,
    FileSpreadsheet,
    Check,
    ArrowRight,
    Clock,
    Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

type Step = 'select' | 'configure' | 'preview' | 'done';

export default function ImportPage() {
    const { t } = useTranslation();
    const { family } = useFamily();
    const navigate = useNavigate();
    const fileRef = useRef<HTMLInputElement>(null);

    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [pendingBatches, setPendingBatches] = useState<DraftBatch[]>([]);
    const [step, setStep] = useState<Step>('select');
    const [selectedPreset, setSelectedPreset] = useState('revolut');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [customMapping, setCustomMapping] = useState<CSVColumnMapping>({
        date: '',
        amount: '',
        description: '',
    });
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        if (!family) return;
        
        getAccountsByFamily(family.id).then(setAccounts).catch(console.error);
        
        const unsubDrafts = subscribeToFamilyDrafts(family.id, (batches) => {
            // Only show batches that are not complete to keep it clean
            setPendingBatches(batches.filter(b => b.status !== 'completed'));
        });

        return () => {
            unsubDrafts();
        };
    }, [family]);

    const handleDeleteBatch = async (batchId: string) => {
        if (!confirm('¿Seguro que deseas eliminar este borrador de importación? Perderás el progreso de categorización.')) return;
        try {
            await deleteDraftBatch(batchId);
            toast.success('Borrador eliminado');
        } catch (err) {
            toast.error('Error al eliminar borrador');
        }
    };

    const preset = BANK_PRESETS[selectedPreset];

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);

        try {
            const result = await parseCSV(f, preset);
            setHeaders(result.headers);
            setRows(result.rows);

            // Auto-map if custom
            if (selectedPreset === 'custom') {
                setCustomMapping({
                    date: result.headers[0] || '',
                    amount: result.headers[1] || '',
                    description: result.headers[2] || '',
                });
            }

            setStep('configure');
        } catch (err) {
            toast.error('Error parsing CSV: ' + String(err));
        }
    };

    const handleImport = async () => {
        if (!family || !selectedAccountId || !file) return;
        setImporting(true);

        try {
            const mapping = selectedPreset === 'custom' ? customMapping : undefined;
            const draftTxs = mapRowsToDraftTransactions(
                rows,
                preset,
                mapping,
                family.id,
                selectedAccountId
            );

            if (draftTxs.length === 0) {
                toast.error('No valid transactions found');
                setImporting(false);
                return;
            }

            // 1. Create a Batch Document
            const batchId = await createDraftBatch(family.id, selectedAccountId, file.name, draftTxs.length);

            // 2. Save all rows as Draft Transactions
            await saveDraftTransactions(batchId, draftTxs);

            toast.success(`Borrador guardado. Redirigiendo a categorización...`);

            // 3. Navigate to new Draft Consolidation UI
            navigate(`/import/draft/${batchId}`);
        } catch (err) {
            toast.error('Import error: ' + String(err));
            setImporting(false);
        }
    };

    const mappedPreview = () => {
        const mapping = selectedPreset === 'custom' ? customMapping : preset.mapping;
        return rows.slice(0, 5).map((row) => ({
            date: row[mapping.date] || '—',
            amount: row[mapping.amount] || '—',
            description: row[mapping.description] || '—',
        }));
    };

    const getImportSummary = () => {
        if (!family || !selectedAccountId) return null;
        try {
            const mapping = selectedPreset === 'custom' ? customMapping : undefined;
            const txs = mapRowsToDraftTransactions(rows, preset, mapping, family.id, selectedAccountId);
            const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            return { count: txs.length, income, expense, balance: income - expense };
        } catch {
            return null;
        }
    };

    const formatCurrency = (amount: number, curr?: string) => {
        const c = curr || family?.currency || 'EUR';
        return new Intl.NumberFormat(c === 'MXN' ? 'es-MX' : 'es-ES', {
            style: 'currency',
            currency: c,
        }).format(Math.abs(amount));
    };

    const summary = step === 'configure' ? getImportSummary() : null;

    if (!family) return null;

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold">{t('nav.import')}</h1>

            {/* Resume Pending Work Section */}
            {step === 'select' && pendingBatches.length > 0 && (
                <div className="card space-y-4 border-accent-300 dark:border-accent-500/30">
                    <div className="flex items-center gap-2 text-accent-600 dark:text-accent-400">
                        <Clock size={20} />
                        <h2 className="font-semibold">Importaciones Pendientes</h2>
                    </div>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                        Tienes las siguientes importaciones en curso. Continúa revisándolas o elimínalas si ya no son necesarias.
                    </p>
                    <div className="space-y-2">
                        {pendingBatches.map(batch => (
                            <div key={batch.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 dark:bg-primary-900/10 rounded-xl gap-3">
                                <div className="flex-1">
                                    <p className="font-medium text-sm flex items-center gap-2">
                                        <FileSpreadsheet size={16} className="text-primary-500" />
                                        {batch.fileName}
                                    </p>
                                    <div className="flex gap-3 text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
                                        <span>{batch.totalRows} movimientos</span>
                                        <span>•</span>
                                        <span>Progreso: {Math.round((batch.processedRows / batch.totalRows) * 100) || 0}%</span>
                                        <span>•</span>
                                        <span>{new Date(batch.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDeleteBatch(batch.id)}
                                        className="p-2 text-text-muted-light hover:text-danger-500 dark:text-text-muted-dark dark:hover:text-danger-400 transition-colors"
                                        title="Eliminar borrador"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => navigate(`/import/draft/${batch.id}`)}
                                        className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1"
                                    >
                                        Retomar <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Progress steps */}
            <div className="flex items-center gap-2 text-sm">
                {(['select', 'configure', 'preview', 'done'] as Step[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                        <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s
                                ? 'gradient-primary text-white'
                                : i < ['select', 'configure', 'preview', 'done'].indexOf(step)
                                    ? 'bg-accent-500 text-white'
                                    : 'bg-gray-200 dark:bg-primary-800 text-gray-500'
                                }`}
                        >
                            {i < ['select', 'configure', 'preview', 'done'].indexOf(step) ? (
                                <Check size={14} />
                            ) : (
                                i + 1
                            )}
                        </div>
                        {i < 3 && (
                            <div className={`w-8 h-0.5 transition-colors ${i < ['select', 'configure', 'preview', 'done'].indexOf(step)
                                ? 'bg-accent-500'
                                : 'bg-gray-200 dark:bg-primary-800'
                                }`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step 1: Select bank & file */}
            {step === 'select' && (
                <div className="card space-y-5">
                    <div>
                        <label className="block text-sm font-medium mb-2">Banco</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(BANK_PRESETS).map(([key, p]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedPreset(key)}
                                    className={`p-3 rounded-xl text-sm font-medium text-left transition-all cursor-pointer ${selectedPreset === key
                                        ? 'bg-primary-100 dark:bg-primary-900/40 border-2 border-primary-500 text-primary-700 dark:text-primary-300'
                                        : 'bg-gray-50 dark:bg-primary-900/10 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-primary-900/20'
                                        }`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">{t('transactions.account')}</label>
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="input-field"
                        >
                            <option value="">---</option>
                            {accounts.map((a) => (
                                <option key={a.id} value={a.id}>{a.name} ({a.bank})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Archivo CSV</label>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv,.txt"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={!selectedAccountId}
                            className="w-full p-8 rounded-xl border-2 border-dashed border-gray-300 dark:border-primary-700 hover:border-primary-400 dark:hover:border-primary-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex flex-col items-center gap-3">
                                <Upload size={32} className="text-gray-400" />
                                <div className="text-center">
                                    <p className="text-sm font-medium">Selecciona el archivo CSV</p>
                                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
                                        {preset.name} · {preset.delimiter === ';' ? 'Separado por ;' : 'Separado por ,'}
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Configure mapping (for custom) */}
            {step === 'configure' && (
                <div className="card space-y-5">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet size={20} className="text-primary-500" />
                        <div>
                            <p className="font-medium">{file?.name}</p>
                            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{rows.length} filas detectadas · {headers.length} columnas</p>
                        </div>
                    </div>

                    {selectedPreset === 'custom' && (
                        <div className="space-y-3 p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20">
                            <p className="text-sm font-medium">Mapeo de columnas</p>
                            {(['date', 'amount', 'description'] as const).map((field) => (
                                <div key={field} className="flex items-center gap-3">
                                    <span className="text-sm w-24 capitalize">{field}:</span>
                                    <select
                                        value={customMapping[field]}
                                        onChange={(e) => setCustomMapping({ ...customMapping, [field]: e.target.value })}
                                        className="input-field flex-1"
                                    >
                                        <option value="">---</option>
                                        {headers.map((h) => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary */}
                    {summary && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 dark:bg-primary-900/10 p-4 rounded-xl">
                            <div>
                                <p className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Movimientos</p>
                                <p className="text-lg font-bold">{summary.count}</p>
                            </div>
                            <div>
                                <p className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Ingresos</p>
                                <p className="text-lg font-bold text-accent-500">+{formatCurrency(summary.income)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Gastos</p>
                                <p className="text-lg font-bold text-danger-500">-{formatCurrency(summary.expense)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Balance Neto</p>
                                <p className={`text-lg font-bold ${summary.balance >= 0 ? 'text-accent-500' : 'text-danger-500'}`}>
                                    {summary.balance >= 0 ? '+' : '-'}{formatCurrency(summary.balance)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Preview table */}
                    <div>
                        <p className="text-sm font-medium mb-2">Vista previa (primeras 5 filas)</p>
                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-primary-800">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-primary-900/20">
                                        <th className="px-3 py-2 text-left font-medium">Fecha</th>
                                        <th className="px-3 py-2 text-left font-medium">Descripción</th>
                                        <th className="px-3 py-2 text-right font-medium">Importe</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mappedPreview().map((row, i) => (
                                        <tr key={i} className="border-t border-gray-100 dark:border-primary-800/30">
                                            <td className="px-3 py-2 text-text-muted-light dark:text-text-muted-dark">{row.date}</td>
                                            <td className="px-3 py-2 truncate max-w-[200px]">{row.description}</td>
                                            <td className="px-3 py-2 text-right font-mono">{row.amount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => { setStep('select'); setFile(null); setRows([]); }} className="btn-secondary flex-1">
                            {t('common.back')}
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={importing || rows.length === 0}
                            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {importing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Importando...
                                </>
                            ) : (
                                <>
                                    Importar {rows.length} movimientos
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};
