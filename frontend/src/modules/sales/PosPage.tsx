import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { FloatingSearchPopover } from '../../components/FloatingSearchPopover';
import { Article, articlesService } from '../../services/articles.service';
import { apiErrorMessage } from '../../services/apiError';
import { cashService } from '../../services/cash.service';
import { insuranceService } from '../../services/insurance.service';
import { lotsService } from '../../services/lots.service';
import { CustomerItem, referenceService } from '../../services/reference.service';
import { salesService } from '../../services/sales.service';
import { settingsService } from '../../services/settings.service';
import { sitesService } from '../../services/sites.service';
import { stocksService } from '../../services/stocks.service';
import { formatDate } from '../../utils/date';
import { fetchAllPages } from '../../utils/fetchAllPages';
import { formatMoney } from '../../utils/money';
import { workstationsService } from '../../services/workstations.service';
import { formatDateTime } from '../../utils/date';

type PosForm = {
  siteId: string;
  saleType: 'CASH' | 'INSURANCE';
  customerId: string;
  exchangeRate: string;
  membershipId: string;
};

const initialForm = (): PosForm => ({ siteId: '', saleType: 'CASH', customerId: '', exchangeRate: '1', membershipId: '' });
const POS_USD_CDF_FALLBACK_RATE = 2800;
const SETTLEMENT_TOLERANCE_USD = 0.02;

export function PosPage() {
  const qc = useQueryClient();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<PosForm>(initialForm);
  const [sale, setSale] = useState<any>(null);
  const [articleQuery, setArticleQuery] = useState('');
  const [articlePopoverOpen, setArticlePopoverOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [quantityArticle, setQuantityArticle] = useState<Article | null>(null);
  const [paidUsd, setPaidUsd] = useState('');
  const [paidFc, setPaidFc] = useState('');
  const [returnedUsd, setReturnedUsd] = useState('0');
  const [returnedFc, setReturnedFc] = useState('0');
  const [settlementReason, setSettlementReason] = useState('');
  const [settlementNote, setSettlementNote] = useState('');
  const [exactPayment, setExactPayment] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [clientError, setClientError] = useState('');
  const [customerDisplayMessage, setCustomerDisplayMessage] = useState('');
  const [itemQuantityDrafts, setItemQuantityDrafts] = useState<Record<string, string>>({});
  const [cashMode, setCashMode] = useState(() => localStorage.getItem('posCashMode') === 'true');
  const [cashOpenModalOpen, setCashOpenModalOpen] = useState(false);
  const [cashOpenAutoPrompted, setCashOpenAutoPrompted] = useState(false);
  const [cashOpenWorkstationId, setCashOpenWorkstationId] = useState('');
  const [cashOpenOpeningUsd, setCashOpenOpeningUsd] = useState('0');
  const [cashOpenOpeningCdf, setCashOpenOpeningCdf] = useState('0');
  const [cashOpenNote, setCashOpenNote] = useState('');
  const [cashOpenError, setCashOpenError] = useState('');
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const paymentInputRef = useRef<HTMLInputElement | null>(null);
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const cashOpenUsdInputRef = useRef<HTMLInputElement | null>(null);
  const saleTypeSelectRef = useRef<HTMLSelectElement | null>(null);
  const membershipSelectRef = useRef<HTMLSelectElement | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const deviceUuid = useMemo(() => getOrCreateDeviceUuid(), []);
  const permissions = currentUser?.permissions ?? [];
  const canOpenCash = permissions.includes('cash_sessions.open');

  const sites = useQuery({ queryKey: ['sites'], queryFn: async () => (await sitesService.getAll()).data });
  const workstations = useQuery({ queryKey: ['workstations', 'pos'], queryFn: async () => (await workstationsService.getAll()).data });
  const saleIdParam = searchParams.get('saleId') ?? '';
  const articles = useQuery({
    queryKey: ['articles', 'pos'],
    queryFn: async () =>
      fetchAllPages(
        async ({ page, limit }) => (await articlesService.getAll({ page, limit })).data,
        { getKey: (article) => article.articleId },
      ),
  });
  const lots = useQuery({ queryKey: ['lots', 'pos'], queryFn: async () => (await lotsService.getAll()).data });
  const stocks = useQuery({ queryKey: ['stocks', 'pos'], queryFn: async () => (await stocksService.getAll()).data });
  const customers = useQuery({ queryKey: ['customers'], queryFn: async () => (await referenceService.customers.getAll()).data });
  const productUnits = useQuery({
    queryKey: ['product-units', 'pos'],
    queryFn: async () => (await referenceService.productUnits.getAll()).data,
    staleTime: 5 * 60 * 1000,
  });
  const siteWorkstations = useMemo(
    () => (workstations.data ?? []).filter((item) => item.isActive && (!form.siteId || item.siteId === form.siteId)),
    [form.siteId, workstations.data],
  );
  const currentWorkstation = useMemo(
    () => siteWorkstations.find((item) => item.deviceUuid === deviceUuid) ?? siteWorkstations[0] ?? null,
    [deviceUuid, siteWorkstations],
  );
  const sessionWorkstationId = cashOpenWorkstationId || currentWorkstation?.workstationId || '';
  const memberships = useQuery({ queryKey: ['customer-memberships', form.customerId], queryFn: async () => (await insuranceService.memberships.getByCustomer(form.customerId)).data, enabled: Boolean(form.customerId) });
  const currentCashSession = useQuery({
    queryKey: ['cash-current', form.siteId, deviceUuid, sessionWorkstationId],
    queryFn: async () => (await cashService.getCurrentSession(form.siteId, deviceUuid, sessionWorkstationId || undefined)).data,
    enabled: Boolean(form.siteId),
  });
  const exchangeRateQuery = useQuery({ queryKey: ['settings', 'exchange-rate'], queryFn: async () => (await settingsService.getExchangeRate()).data });

  const currentSite = useMemo(() => (sites.data ?? []).find((site) => site.siteId === form.siteId), [form.siteId, sites.data]);
  const articleById = useMemo(() => new Map((articles.data ?? []).map((article) => [article.articleId, article])), [articles.data]);
  const unitLabelById = useMemo(() => new Map((productUnits.data ?? []).map((unit) => [unit.productUnitId, unit.unitLabel])), [productUnits.data]);
  const selectedCustomer = useMemo(() => (customers.data ?? []).find((customer) => customer.customerId === form.customerId), [customers.data, form.customerId]);
  const sellableLotById = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return new Map((lots.data ?? [])
      .filter((lot) => !lot.isBlocked && String(lot.expiryDate).slice(0, 10) > today)
      .map((lot) => [lot.lotId, lot]));
  }, [lots.data]);
  const sellableStocks = useMemo(() => (stocks.data ?? []).filter((stock) => {
    if (form.siteId && stock.siteId !== form.siteId) return false;
    if (Number(stock.quantityAvailable ?? 0) <= 0) return false;
    return sellableLotById.has(stock.lotId);
  }), [form.siteId, sellableLotById, stocks.data]);
  const stockByArticle = useMemo(() => {
    const map = new Map<string, number>();
    for (const stock of sellableStocks) map.set(stock.articleId, (map.get(stock.articleId) ?? 0) + Number(stock.quantityAvailable ?? 0));
    return map;
  }, [sellableStocks]);
  const fefoByArticle = useMemo(() => {
    const map = new Map<string, { lot: string; expiry: string }>();
    const rows = [...sellableStocks].sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
    for (const stock of rows) if (!map.has(stock.articleId)) map.set(stock.articleId, { lot: stock.lotNumber, expiry: stock.expiryDate });
    return map;
  }, [sellableStocks]);
  const posArticles = useMemo<Article[]>(() => {
    const rows = new Map<string, Article>();
    for (const stock of sellableStocks) {
      const article = articleById.get(stock.articleId);
      if (rows.has(stock.articleId)) continue;
      rows.set(stock.articleId, {
        articleId: stock.articleId,
        articleCode: article?.articleCode ?? stock.articleCode ?? '',
        commercialName: article?.commercialName ?? stock.commercialName ?? '',
        dci: article?.dci ?? null,
        barcode: article?.barcode ?? null,
        categoryId: article?.categoryId ?? null,
        subCategoryId: article?.subCategoryId ?? null,
        formId: article?.formId ?? null,
        routeId: article?.routeId ?? null,
        productTypeId: article?.productTypeId ?? null,
        dosage: article?.dosage ?? null,
        atcCode: article?.atcCode ?? null,
        prescriptionRequired: article?.prescriptionRequired ?? false,
        defaultStockMin: article?.defaultStockMin ?? Number(stock.stockMin ?? 0),
        defaultStockMax: article?.defaultStockMax ?? Number(stock.stockMax ?? 0),
        isActive: article?.isActive ?? true,
        stockAvailable: stockByArticle.get(stock.articleId) ?? 0,
        sellingPrice: article?.sellingPrice ?? sellableLotById.get(stock.lotId)?.sellingPrice ?? 0,
      });
    }
    return Array.from(rows.values()).sort((a, b) => a.commercialName.localeCompare(b.commercialName));
  }, [articles.data, sellableLotById, sellableStocks, stockByArticle]);
  const resumeSale = useQuery({
    queryKey: ['sale-resume', saleIdParam],
    enabled: Boolean(saleIdParam),
    queryFn: async () => (await salesService.getById(saleIdParam)).data,
  });
  const articleSuggestions = useMemo(() => {
    const query = articleQuery.trim().toLowerCase();
    if (!query) return posArticles.slice(0, 80);
    return prioritizeExactBarcode(posArticles.filter((article) =>
      [article.articleCode, article.commercialName, article.dci, article.dosage, article.barcode]
        .some((value) => String(value ?? '').toLowerCase().includes(query)),
    ), articleQuery);
  }, [articleQuery, posArticles]);
  const customerSuggestions = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    const rows = customers.data ?? [];
    if (!query) return rows.slice(0, 80);
    return rows.filter((customer) =>
      [customer.customerCode, customer.customerName, customer.phone]
        .some((value) => String(value ?? '').toLowerCase().includes(query)),
    );
  }, [customerQuery, customers.data]);

  const items = sale?.items ?? [];
  const currencyCode = sale?.currencyCode ?? 'USD';
  const currencySymbol = sale?.currencySymbol;
  const loadedExchangeRate = Number(exchangeRateQuery.data?.rate);
  const currentExchangeRate = Number.isFinite(loadedExchangeRate) && loadedExchangeRate > 0 ? loadedExchangeRate : POS_USD_CDF_FALLBACK_RATE;
  const storedSaleExchangeRate = Number(sale?.exchangeRate);
  const saleExchangeRate = Number.isFinite(storedSaleExchangeRate) && storedSaleExchangeRate > 0 ? storedSaleExchangeRate : currentExchangeRate;
  const subtotal = Number(sale?.subtotal ?? sale?.totalAmount ?? 0);
  const discount = Number(sale?.discountAmount ?? 0);
  const total = Number(sale?.totalAmount ?? 0);
  const patientPayable = Number(sale?.customerPayableAmount ?? total);
  const insuranceAmount = Number(sale?.insuranceCoveredAmount ?? 0);
  const paidUsdAmount = Number(paidUsd || 0);
  const paidFcAmount = Number(paidFc || 0);
  const returnedUsdAmount = Number(returnedUsd || 0);
  const returnedFcAmount = Number(returnedFc || 0);
  const paidEquivalentFc = paidFcAmount + paidUsdAmount * saleExchangeRate;
  const patientPayableFc = patientPayable * saleExchangeRate;
  const suggestedChangeFc = Math.max(0, roundMoney(paidEquivalentFc - patientPayableFc));
  const suggestedChangeUsd = roundMoney(suggestedChangeFc / saleExchangeRate);
  const returnedEquivalentFc = returnedFcAmount + returnedUsdAmount * saleExchangeRate;
  const netReceivedUsd = roundMoney(paidUsdAmount - returnedUsdAmount);
  const netReceivedCdf = roundMoney(paidFcAmount - returnedFcAmount);
  const netReceivedEquivalentUsd = roundMoney(netReceivedCdf / saleExchangeRate);
  const netTotalEquivalentUsd = roundMoney(netReceivedUsd + netReceivedEquivalentUsd);
  const netTotalEquivalentFc = roundMoney(netReceivedUsd * saleExchangeRate + netReceivedCdf);
  const settlementDifferenceUsd = roundMoney(netTotalEquivalentUsd - patientPayable);
  const settlementDifferenceFc = roundMoney(netTotalEquivalentFc - patientPayableFc);
  const settlementStatus = classifySettlementDifference(settlementDifferenceUsd, paidFcAmount, paidUsdAmount);
  const settlementStatusLabel = settlementLabel(settlementStatus);
  const actualChangeDueFc = Math.max(0, returnedEquivalentFc);
  const actualChangeDueUsd = roundMoney(actualChangeDueFc / saleExchangeRate);
  const hasChangeDue = actualChangeDueFc > 0;
  const quantityTotal = items.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0);

  const createDraft = useMutation({
    mutationFn: async () => (await salesService.create({ siteId: form.siteId, saleType: form.saleType, customerId: form.customerId || undefined, exchangeRate: currentExchangeRate })).data,
    onSuccess: (created) => {
      setSale(created);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('saleId', created.saleId);
      setSearchParams(nextParams, { replace: true });
      setPaidUsd('');
      setPaidFc('');
      setReturnedUsd('0');
      setReturnedFc('0');
      setSettlementReason('');
      setSettlementNote('');
      setExactPayment(false);
      setTimeout(() => focusArticleSearch(), 0);
    },
  });
  const addItem = useMutation({
    mutationFn: ({ articleId, lineQuantity }: { articleId: string; lineQuantity: number }) =>
      salesService.addItemFefo(sale.saleId, { articleId, quantity: lineQuantity }),
    onSuccess: (response) => {
      setSale(response.data);
      setItemQuantityDrafts(syncQuantityDrafts(response.data?.items ?? []));
      setPaidUsd('');
      setPaidFc('');
      setReturnedUsd('0');
      setReturnedFc('0');
      setSettlementReason('');
      setSettlementNote('');
      setExactPayment(false);
      setArticleQuery('');
      setQuantity('1');
      setQuantityArticle(null);
      setClientError('');
      playBeep('success');
      setTimeout(() => focusArticleSearch(), 0);
    },
    onError: () => {
      playBeep('error');
      setTimeout(() => focusArticleSearch(), 0);
    },
  });
  const updateItemQuantity = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      salesService.updateItem(sale.saleId, itemId, { quantity }),
    onSuccess: (response, variables) => {
      setSale(response.data);
      setItemQuantityDrafts((current) => ({ ...current, [variables.itemId]: String(variables.quantity) }));
      setClientError('');
    },
    onError: () => {
      playBeep('error');
    },
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => salesService.removeItem(sale.saleId, itemId),
    onSuccess: (response) => {
      setSale(response.data);
      setItemQuantityDrafts(syncQuantityDrafts(response.data?.items ?? []));
      setPaidUsd('');
      setPaidFc('');
      setReturnedUsd('0');
      setReturnedFc('0');
      setSettlementReason('');
      setSettlementNote('');
      setExactPayment(false);
    },
  });
  const applyInsurance = useMutation({
    mutationFn: () => salesService.applyInsurance(sale.saleId, { membershipId: form.membershipId }),
    onSuccess: (response) => {
      setSale(response.data);
      setItemQuantityDrafts(syncQuantityDrafts(response.data?.items ?? []));
      setPaidUsd('');
      setPaidFc('');
      setReturnedUsd('0');
      setReturnedFc('0');
      setSettlementReason('');
      setSettlementNote('');
      setExactPayment(false);
    },
  });
  const updateDraft = useMutation({
    mutationFn: (payload: Record<string, unknown>) => salesService.updateDraft(sale.saleId, payload),
    onSuccess: (response) => {
      setSale(response.data);
      setItemQuantityDrafts(syncQuantityDrafts(response.data?.items ?? []));
      setPaidUsd('');
      setPaidFc('');
      setReturnedUsd('0');
      setReturnedFc('0');
      setSettlementReason('');
      setSettlementNote('');
      setExactPayment(false);
      setClientError('');
      setTimeout(() => focusArticleSearch(), 0);
    },
    onError: () => {
      playBeep('error');
      setTimeout(() => focusArticleSearch(), 0);
    },
  });
  const validate = useMutation({
    mutationFn: (overrideAmount?: number) => salesService.validate(sale.saleId, {
      amountPaid: Number(overrideAmount ?? netTotalEquivalentUsd ?? 0),
      amountPaidUsd: paidUsdAmount,
      amountPaidCdf: paidFcAmount,
      amountReturnedUsd: returnedUsdAmount,
      amountReturnedCdf: returnedFcAmount,
      settlementDifferenceReason: settlementReason.trim() || undefined,
      settlementDifferenceNote: settlementNote.trim() || undefined,
      cashSessionId: currentCashSession.data?.cashSessionId,
    }),
    onSuccess: async (response) => {
      setSale(response.data);
      await qc.invalidateQueries({ queryKey: ['sales'] });
      await qc.invalidateQueries({ queryKey: ['stocks'] });
      playBeep('sale');
      setTimeout(() => {
        window.print();
        prepareNextSale();
      }, 0);
    },
    onError: () => playBeep('error'),
  });
  const cancel = useMutation({ mutationFn: () => salesService.cancel(sale.saleId), onSuccess: () => prepareNextSale() });
  const openCashSession = useMutation({
    mutationFn: async () => {
      if (!form.siteId) throw new Error('SITE_NOT_SELECTED');
      const openingUsd = Number(cashOpenOpeningUsd || 0);
      const openingCdf = Number(cashOpenOpeningCdf || 0);
      if ([openingUsd, openingCdf].some((amount) => !Number.isFinite(amount) || amount < 0)) {
        throw new Error('INVALID_OPENING_BALANCE');
      }
      const openingBalance = roundMoney(openingUsd + (openingCdf / currentExchangeRate));
      return (await cashService.openSession({
        siteId: form.siteId,
        openingBalance,
        workstationId: cashOpenWorkstationId || currentWorkstation?.workstationId || undefined,
        deviceUuid,
        notes: cashOpenNote.trim() || undefined,
      })).data;
    },
    onSuccess: async () => {
      closeCashAssistant();
      setClientError('');
      await qc.invalidateQueries({ queryKey: ['cash-current'] });
      await qc.invalidateQueries({ queryKey: ['cash-sessions'] });
      await qc.invalidateQueries({ queryKey: ['cash-movements'] });
    },
    onError: (error) => {
      const responseCode = (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message
        ?? (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error
        ?? (error as { message?: string }).message
        ?? '';
      if (responseCode === 'INVALID_OPENING_BALANCE') {
        setCashOpenError('Les montants initiaux doivent etre superieurs ou egaux a 0.');
        return;
      }
      if (responseCode === 'CASH_SESSION_ALREADY_OPEN') {
        setCashOpenError('Une session caisse est deja ouverte pour ce vendeur sur un autre poste.');
        return;
      }
      if (responseCode === 'WORKSTATION_SESSION_ALREADY_OPEN') {
        setCashOpenError('Une session caisse est deja ouverte pour ce poste.');
        return;
      }
      setCashOpenError(apiErrorMessage(error));
    },
  });

  useEffect(() => {
    if (!currentUser?.siteId) return;
    setForm((current) => current.siteId === currentUser.siteId ? current : { ...current, siteId: currentUser.siteId ?? '', exchangeRate: '1' });
  }, [currentUser?.siteId]);

  useEffect(() => {
    if (!saleIdParam || !resumeSale.data) return;
    const resumed = resumeSale.data;
    setSale(resumed);
    setForm((current) => ({
      ...current,
      siteId: resumed.siteId ?? current.siteId,
      saleType: (resumed.saleType as PosForm['saleType']) ?? 'CASH',
      customerId: resumed.customerId ?? '',
      membershipId: resumed.membershipId ?? '',
      exchangeRate: String(resumed.exchangeRate ?? currentExchangeRate),
    }));
    setItemQuantityDrafts(syncQuantityDrafts(resumed.items ?? []));
    setPaidUsd(Number(resumed.amountPaidUsd ?? 0) > 0 ? String(resumed.amountPaidUsd ?? 0) : '');
    setPaidFc(Number(resumed.amountPaidCdf ?? 0) > 0 ? String(resumed.amountPaidCdf ?? 0) : '');
    setReturnedUsd(Number(resumed.amountReturnedUsd ?? 0) > 0 ? String(resumed.amountReturnedUsd ?? 0) : '0');
    setReturnedFc(Number(resumed.amountReturnedCdf ?? 0) > 0 ? String(resumed.amountReturnedCdf ?? 0) : '0');
    setSettlementReason(resumed.settlementDifferenceReason ?? '');
    setSettlementNote(resumed.settlementDifferenceNote ?? '');
    setExactPayment(false);
    setClientError('');
  }, [currentExchangeRate, resumeSale.data, saleIdParam]);

  useEffect(() => {
    if (!saleIdParam || !resumeSale.isError) return;
    setClientError('Brouillon introuvable. Une nouvelle vente sera preparee.');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('saleId');
    setSearchParams(nextParams, { replace: true });
  }, [resumeSale.isError, saleIdParam, searchParams, setSearchParams]);

  useEffect(() => {
    setTimeout(() => focusArticleSearch(), 0);
  }, []);

  useEffect(() => {
    if (!form.siteId || sale || createDraft.isPending || createDraft.isSuccess || saleIdParam || resumeSale.isLoading) return;
    if (exchangeRateQuery.isLoading) return;
    if (form.saleType === 'INSURANCE' && !form.customerId) return;
    createDraft.mutate();
  }, [createDraft, exchangeRateQuery.isLoading, form.customerId, form.saleType, form.siteId, resumeSale.isLoading, sale, saleIdParam]);

  useEffect(() => {
    if (!cashOpenModalOpen && currentWorkstation?.workstationId) {
      setCashOpenWorkstationId((current) => current || currentWorkstation.workstationId);
    }
  }, [cashOpenModalOpen, currentWorkstation?.workstationId]);

  useEffect(() => {
    if (quantityArticle) setTimeout(() => quantityInputRef.current?.focus(), 0);
  }, [quantityArticle]);

  useEffect(() => {
    document.documentElement.classList.toggle('pos-cash-mode-active', cashMode);
    localStorage.setItem('posCashMode', String(cashMode));
    return () => document.documentElement.classList.remove('pos-cash-mode-active');
  }, [cashMode]);

  useEffect(() => {
    localStorage.setItem('posCustomerDisplay', JSON.stringify({
      items: items.map((item: any) => ({
        name: item.commercialName ?? 'Article',
        quantity: Number(item.quantity ?? 0),
        totalFc: Number(item.lineTotal ?? 0) * saleExchangeRate,
      })),
      totalFc: patientPayableFc,
      message: sale?.status === 'VALIDATED' ? 'Merci pour votre confiance.' : 'Merci pour votre patience.',
    }));
  }, [items, patientPayableFc, sale?.status, saleExchangeRate]);

  useEffect(() => {
    if (!items.length) {
      setItemQuantityDrafts({});
      return;
    }
    setItemQuantityDrafts((current) => syncQuantityDrafts(items, current));
  }, [items]);

  useEffect(() => {
    if (!canOpenCash || currentCashSession.data || currentCashSession.isLoading || currentCashSession.isError || resumeSale.isLoading || workstations.isLoading || workstations.isError || cashOpenModalOpen || cashOpenAutoPrompted) return;
    if (!form.siteId) return;
    const timeout = window.setTimeout(() => {
      setCashOpenModalOpen(true);
      setCashOpenError('');
      setCashOpenAutoPrompted(true);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [canOpenCash, cashOpenAutoPrompted, cashOpenModalOpen, currentCashSession.data, currentCashSession.isError, currentCashSession.isLoading, form.siteId, resumeSale.isLoading, workstations.isError, workstations.isLoading]);

  useEffect(() => {
    if (currentCashSession.data && cashOpenModalOpen) {
      setCashOpenModalOpen(false);
      setCashOpenError('');
    }
  }, [cashOpenModalOpen, currentCashSession.data]);

  useEffect(() => {
    if (!cashOpenModalOpen) return;
    setTimeout(() => cashOpenUsdInputRef.current?.focus(), 0);
  }, [cashOpenModalOpen]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'F2') { event.preventDefault(); focusArticleSearch(); setArticlePopoverOpen(true); }
      if (event.key === 'F3') { event.preventDefault(); applyExactPayment(); }
      if (event.key === 'F4') { event.preventDefault(); openQuantityForCurrentScan(); }
      if (event.key === 'F5') { event.preventDefault(); openCustomerSearch(); }
      if (event.key === 'F6') { event.preventDefault(); toggleSaleType(); }
      if (event.key === 'F8') { event.preventDefault(); prepareNextSale(); }
      if (event.key === 'F9') { event.preventDefault(); printDraft(); }
      if (event.key === 'F10') { event.preventDefault(); quickCheckout(); }
      if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); quickCheckout(); }
      if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); focusArticleSearch(); setArticlePopoverOpen(true); }
      if (event.ctrlKey && event.key === 'Delete' && selectedLineId) { event.preventDefault(); removeItem.mutate(selectedLineId); }
      if (event.key === 'Escape' && quantityArticle) { event.preventDefault(); closeQuantityBox(); }
      if (event.key === 'Enter' && event.target === scanInputRef.current && !articleQuery.trim() && items.length > 0) {
        event.preventDefault();
        focusPayment();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function update<K extends keyof PosForm>(key: K, value: PosForm[K]) {
    setForm((current) => ({ ...current, [key]: value, ...(key === 'saleType' && value === 'CASH' ? { membershipId: '' } : {}) }));
  }
  function patchDraft(nextForm: Partial<Pick<PosForm, 'customerId' | 'saleType'>>) {
    if (!sale?.saleId || sale.status !== 'DRAFT') return;
    updateDraft.mutate({
      customerId: nextForm.customerId === '' ? null : nextForm.customerId,
      saleType: nextForm.saleType ?? form.saleType,
    });
  }
  function focusArticleSearch() {
    scanInputRef.current?.focus();
  }
  function focusPayment() {
    paymentInputRef.current?.focus();
  }
  function openCashAssistant(message?: string) {
    if (!canOpenCash) return;
    setCashOpenWorkstationId(currentWorkstation?.workstationId ?? siteWorkstations[0]?.workstationId ?? '');
    setCashOpenOpeningUsd('0');
    setCashOpenOpeningCdf('0');
    setCashOpenNote('');
    setCashOpenError(message ?? '');
    setCashOpenAutoPrompted(true);
    setCashOpenModalOpen(true);
    setTimeout(() => cashOpenUsdInputRef.current?.focus(), 0);
  }
  function closeCashAssistant() {
    setCashOpenModalOpen(false);
    setCashOpenError('');
    setCashOpenAutoPrompted(true);
  }
  function openCustomerDisplay() {
    setCustomerDisplayMessage('');
    const opened = window.open('/pos/customer-display', 'pos-customer-display', 'popup,width=900,height=700');
    if (!opened) {
      setCustomerDisplayMessage('Pop-up bloquee. Autorisez les pop-ups pour ouvrir l affichage client.');
      playBeep('error');
      return;
    }
    opened.focus();
  }
  function startSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sale && form.siteId) createDraft.mutate();
  }
  function selectArticle(article: Article) {
    if (!sale?.saleId) { setClientError('Vente en preparation. Reessayez dans un instant.'); return; }
    addArticleQuick(article, 1);
    setArticlePopoverOpen(false);
  }
  function openCustomerSearch() {
    if (!customerPopoverOpen) setCustomerQuery('');
    setCustomerPopoverOpen(true);
    setTimeout(() => customerInputRef.current?.focus(), 0);
  }
  function selectCustomer(customer: CustomerItem) {
    setForm((current) => ({ ...current, customerId: customer.customerId, membershipId: '' }));
    setCustomerQuery(customer.customerName);
    setCustomerPopoverOpen(false);
    patchDraft({ customerId: customer.customerId });
    setTimeout(() => focusArticleSearch(), 0);
  }
  function resetCounterCustomer() {
    const nextSaleType = form.saleType === 'INSURANCE' ? 'CASH' : form.saleType;
    setForm((current) => ({ ...current, customerId: '', membershipId: '', saleType: nextSaleType }));
    setCustomerQuery('');
    setCustomerPopoverOpen(false);
    patchDraft({ customerId: '', saleType: nextSaleType });
    setTimeout(() => focusArticleSearch(), 0);
  }
  function setSaleType(nextSaleType: PosForm['saleType']) {
    if (nextSaleType === 'INSURANCE' && !form.customerId) {
      setClientError('Veuillez selectionner un client assure.');
      playBeep('error');
      setTimeout(() => focusArticleSearch(), 0);
      return;
    }
    setForm((current) => ({ ...current, saleType: nextSaleType, membershipId: nextSaleType === 'CASH' ? '' : current.membershipId }));
    patchDraft({ saleType: nextSaleType, customerId: form.customerId });
  }
  function toggleSaleType() {
    setSaleType(form.saleType === 'CASH' ? 'INSURANCE' : 'CASH');
  }
  function handleArticleKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter') {
      if (!articleQuery.trim() && items.length > 0) {
        event.preventDefault();
        focusPayment();
        return;
      }
      const parsed = parseScan(articleQuery, posArticles);
      if (parsed) {
        event.preventDefault();
        addArticleQuick(parsed.article, parsed.quantity);
      }
    }
  }
  function confirmQuantity(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!quantityArticle) return;
    const requested = Number(quantity || 0);
    const available = Number(stockByArticle.get(quantityArticle.articleId) ?? quantityArticle.stockAvailable ?? 0);
    if (!Number.isFinite(requested) || requested <= 0) { setClientError('Quantite invalide.'); return; }
    if (requested > available) { setClientError(`Stock insuffisant. Disponible : ${available}.`); return; }
    setClientError('');
    addArticleQuick(quantityArticle, requested);
  }
  function canValidate() {
    if (!sale?.saleId || sale.status !== 'DRAFT' || items.length === 0 || validate.isPending) return false;
    if (returnedUsdAmount > paidUsdAmount || returnedFcAmount > paidFcAmount) return false;
    if (settlementDifferenceUsd < -SETTLEMENT_TOLERANCE_USD) return false;
    if (settlementDifferenceUsd > SETTLEMENT_TOLERANCE_USD && !settlementReason.trim()) return false;
    return true;
  }
  function closeQuantityBox() {
    setQuantityArticle(null);
    setQuantity('1');
    setTimeout(() => focusArticleSearch(), 0);
  }
  function prepareNextSale() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('saleId');
    setSearchParams(nextParams, { replace: true });
    setSale(null);
    setArticleQuery('');
    setQuantity('1');
    setQuantityArticle(null);
    setItemQuantityDrafts({});
    setPaidUsd('');
    setPaidFc('');
    setReturnedUsd('0');
    setReturnedFc('0');
    setSettlementReason('');
    setSettlementNote('');
    setExactPayment(false);
    setSelectedLineId('');
    setClientError('');
    setForm((current) => ({ ...current, saleType: 'CASH', customerId: '', membershipId: '', exchangeRate: '1' }));
    createDraft.reset();
    validate.reset();
    setTimeout(() => focusArticleSearch(), 0);
  }
  function addArticleQuick(article: Article, lineQuantity: number) {
    if (!sale?.saleId) { setClientError('Vente en preparation. Reessayez dans un instant.'); playBeep('error'); return; }
    const available = Number(stockByArticle.get(article.articleId) ?? article.stockAvailable ?? 0);
    if (lineQuantity > available) {
      setClientError(`Stock insuffisant. Disponible : ${available}.`);
      playBeep('error');
      setTimeout(() => focusArticleSearch(), 0);
      return;
    }
    setClientError('');
    addItem.mutate({ articleId: article.articleId, lineQuantity });
  }
  async function saveDraft() {
    const syncedSale = await flushEditedQuantities();
    if (!syncedSale) return;
    if (!sale?.saleId || sale.status !== 'DRAFT') {
      if (form.siteId && !createDraft.isPending) createDraft.mutate();
      return;
    }
    patchDraft({ customerId: form.customerId, saleType: form.saleType });
  }
  function openQuantityForCurrentScan() {
    const parsed = parseScan(articleQuery, posArticles);
    const article = parsed?.article ?? articleSuggestions[0];
    if (!article) { playBeep('error'); return; }
    setQuantity(String(parsed?.quantity ?? 1));
    setQuantityArticle(article);
    setArticlePopoverOpen(false);
  }
  async function quickCheckout() {
    const syncedSale = await flushEditedQuantities();
    if (!syncedSale) return;
    const saleSnapshot = syncedSale ?? sale;
    const saleExchangeRateSnapshot = Number(saleSnapshot?.exchangeRate ?? saleExchangeRate);
    const patientPayableSnapshot = Number(saleSnapshot?.saleType === 'INSURANCE' ? saleSnapshot.customerPayableAmount : (saleSnapshot?.totalAmount ?? 0));
    const paidUsdSnapshot = Number(paidUsd || 0);
    const paidFcSnapshot = Number(paidFc || 0);
    const returnedUsdSnapshot = Number(returnedUsd || 0);
    const returnedFcSnapshot = Number(returnedFc || 0);
    const netReceivedUsdSnapshot = roundMoney(paidUsdSnapshot - returnedUsdSnapshot);
    const netReceivedCdfSnapshot = roundMoney(paidFcSnapshot - returnedFcSnapshot);
    const netReceivedEquivalentUsdSnapshot = roundMoney(netReceivedCdfSnapshot / saleExchangeRateSnapshot);
    const netTotalEquivalentUsdSnapshot = roundMoney(netReceivedUsdSnapshot + netReceivedEquivalentUsdSnapshot);
    const settlementDifferenceUsdSnapshot = roundMoney(netTotalEquivalentUsdSnapshot - patientPayableSnapshot);
    const hasPayment = Boolean(paidUsd || paidFc);
    const cashPaymentRequired = form.saleType === 'CASH' || hasPayment || exactPayment || paidUsdSnapshot > 0 || paidFcSnapshot > 0 || returnedUsdSnapshot > 0 || returnedFcSnapshot > 0;
    if (!currentCashSession.data && cashPaymentRequired) {
      if (!canOpenCash) {
        setClientError('Vous n avez pas la permission d ouvrir une caisse.');
        playBeep('error');
        return;
      }
      openCashAssistant('Caisse non ouverte. Ouvrez la caisse maintenant.');
      playBeep('error');
      return;
    }
    if (!hasPayment && !exactPayment) {
      setClientError('Saisissez le montant recu ou utilisez Paiement exact.');
      playBeep('error');
      if ((saleSnapshot?.items?.length ?? items.length) > 0) focusPayment();
      return;
    }
    if (returnedUsdSnapshot > paidUsdSnapshot || returnedFcSnapshot > paidFcSnapshot) {
      setClientError('La monnaie rendue ne peut pas depasser le montant remis.');
      playBeep('error');
      focusPayment();
      return;
    }
    if (!saleSnapshot?.saleId || saleSnapshot.status !== 'DRAFT' || (saleSnapshot?.items?.length ?? 0) === 0 || validate.isPending) {
      setClientError('Aucune vente a encaisser.');
      playBeep('error');
      return;
    }
    if (settlementDifferenceUsdSnapshot < -SETTLEMENT_TOLERANCE_USD) {
      setClientError('Paiement insuffisant.');
      playBeep('error');
      if ((saleSnapshot?.items?.length ?? items.length) > 0) focusPayment();
      return;
    }
    if (settlementDifferenceUsdSnapshot > SETTLEMENT_TOLERANCE_USD && !settlementReason.trim()) {
      setClientError('Un motif est requis pour ce surplus.');
      playBeep('error');
      return;
    }
    setClientError('');
    validate.mutate(netTotalEquivalentUsdSnapshot);
  }
  function applyExactPayment() {
    setPaidUsd('');
    setPaidFc(String(roundMoney(patientPayableFc)));
    setReturnedUsd('0');
    setReturnedFc('0');
    setSettlementReason('');
    setSettlementNote('');
    setExactPayment(true);
    setClientError('');
    setTimeout(() => focusPayment(), 0);
  }
  function playBeep(kind: 'success' | 'error' | 'sale') {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioRef.current ?? new AudioContextClass();
      audioRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const frequency = kind === 'error' ? 180 : kind === 'sale' ? 880 : 660;
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gain.gain.value = 0.045;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (kind === 'sale' ? 0.16 : 0.09));
    } catch {
      // Browser audio can be blocked before user interaction; POS flow must continue.
    }
  }
  function printDraft() {
    window.print();
  }

  function syncQuantityDrafts(nextItems: any[], current: Record<string, string> = {}) {
    const nextDrafts = { ...current };
    for (const item of nextItems) {
      if (nextDrafts[item.saleItemId] === undefined) nextDrafts[item.saleItemId] = String(item.quantity ?? 0);
    }
    for (const key of Object.keys(nextDrafts)) {
      if (!nextItems.some((item) => item.saleItemId === key)) delete nextDrafts[key];
    }
    return nextDrafts;
  }

  async function flushEditedQuantities() {
    if (!sale?.saleId || sale.status !== 'DRAFT' || items.length === 0) return sale;
    let latestSale = sale;
    for (const item of items) {
      const rawValue = itemQuantityDrafts[item.saleItemId];
      if (rawValue === undefined) continue;
      const normalized = Number(String(rawValue).replace(',', '.'));
      if (!Number.isFinite(normalized) || normalized <= 0) {
        setClientError('Quantite invalide.');
        playBeep('error');
        return null;
      }
      if (normalized !== Number(item.quantity ?? 0)) {
        try {
          const response = await updateItemQuantity.mutateAsync({ itemId: item.saleItemId, quantity: normalized });
          setSale(response.data);
          latestSale = response.data;
        } catch {
          return null;
        }
      }
    }
    return latestSale;
  }

  const mutationError = createDraft.error || addItem.error || updateItemQuantity.error || removeItem.error || applyInsurance.error || updateDraft.error || validate.error || cancel.error;
  const showError = Boolean(clientError || mutationError);
  const error = clientError || (mutationError ? apiErrorMessage(mutationError) : '');

  return (
    <div className={`pos-page purchase-erp-window ${cashMode ? 'pos-page-cash-mode' : ''}`}>
      <div className="breadcrumb"><Link to="/sales">Ventes</Link><span>&gt;</span><strong>POS</strong></div>
      <div className="toolbar pos-toolbar">
        <div>
          <h1>POS</h1>
          <p className="muted">Caisse rapide FEFO : scanner, quantite, encaisser.</p>
        </div>
        <div className="pos-cash-status">
          <button className="ghost-button compact-button pos-header-action pos-customer-display-button" type="button" onClick={openCustomerDisplay}>
            Affichage client
          </button>
          <button className="ghost-button compact-button pos-header-action pos-mode-button" type="button" onClick={() => setCashMode((value) => !value)}>
            {cashMode ? 'Quitter mode caisse' : 'Mode caisse'}
          </button>
          <span className={`badge ${currentCashSession.data ? 'badge-success' : 'badge-warning'}`}>{currentCashSession.data ? 'Caisse ouverte' : 'Caisse non ouverte'}</span>
          <small>{currentCashSession.data ? `${currentCashSession.data.registerName ?? 'Caisse'} - Ouverture ${formatMoney(currentCashSession.data.openingBalance, currencyCode, currencySymbol)}` : 'Ouvrez une session caisse pour lier automatiquement les paiements CASH.'}</small>
          {!currentCashSession.data && (
            <button
              className="button compact-button pos-open-cash-button"
              type="button"
              onClick={() => openCashAssistant()}
              disabled={!canOpenCash}
              title={!canOpenCash ? 'Vous n avez pas la permission d ouvrir une caisse.' : undefined}
            >
              Ouvrir la caisse maintenant
            </button>
          )}
          {!currentCashSession.data && !canOpenCash && <small className="muted">Vous n avez pas la permission d ouvrir une caisse.</small>}
        </div>
      </div>
      {showError && <p className="form-error">{error}</p>}
      {customerDisplayMessage && <p className="form-error">{customerDisplayMessage}</p>}
      {cashOpenError && !cashOpenModalOpen && <p className="form-error">{cashOpenError}</p>}
      {exchangeRateQuery.isError && <p className="form-error">Taux USD/CDF non charge. Fallback demo utilise : 1 USD = {formatMoney(POS_USD_CDF_FALLBACK_RATE, 'CDF')}.</p>}

      <section className="pos-status-strip">
        <div><span>Caisse</span><strong>{currentCashSession.data ? 'OUVERTE' : 'FERMEE'}</strong><small>{currentCashSession.data?.registerName ?? 'Aucune session'}</small></div>
        <div><span>Vendeur</span><strong>{currentUser?.fullName ?? '-'}</strong><small>{currentUser?.role ?? '-'}</small></div>
        <div><span>Site</span><strong>{currentSite?.siteName ?? 'Site utilisateur'}</strong></div>
        <div><span>Taux</span><strong>1 USD = {formatMoney(saleExchangeRate, 'CDF')}</strong></div>
        <div><span>Type</span><strong>{form.saleType}</strong></div>
      </section>

      <form className="card compact-card pos-header-grid" onSubmit={startSale}>
        <label><span>Vente no</span><input className="input compact-input" value={sale?.saleNumber ?? 'Auto'} disabled /></label>
        <label className="pos-client-field">
          <span>Client</span>
          <FloatingSearchPopover
            columns={[
              { header: 'Code', render: (customer) => customer.customerCode },
              { header: 'Nom', render: (customer) => <strong>{customer.customerName}</strong> },
              { header: 'Telephone', render: (customer) => customer.phone ?? '-' },
            ]}
            getKey={(customer) => customer.customerId}
            inputClassName="input compact-input"
            inputRef={customerInputRef}
            onChange={setCustomerQuery}
            onClose={() => setCustomerPopoverOpen(false)}
            onFallbackKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setCustomerPopoverOpen(false);
                focusArticleSearch();
              }
            }}
            onFocusNext={focusArticleSearch}
            onOpen={openCustomerSearch}
            onSelect={selectCustomer}
            open={customerPopoverOpen}
            placeholder="Client comptoir"
            searchPlaceholder="Rechercher client (code, nom, telephone...)"
            suggestions={customerSuggestions}
            value={customerPopoverOpen ? customerQuery : selectedCustomer?.customerName ?? 'Client comptoir'}
          />
          {form.customerId && <button className="ghost-button compact-button pos-counter-customer-button" type="button" onClick={resetCounterCustomer}>Client comptoir</button>}
        </label>
        <label><span>Type</span><select ref={saleTypeSelectRef} className="input compact-input" value={form.saleType} disabled={sale?.status && sale.status !== 'DRAFT'} onChange={(event) => setSaleType(event.target.value as PosForm['saleType'])}><option value="CASH">CASH</option><option value="INSURANCE">ASSURANCE</option></select></label>
        <label><span>Assurance</span><select ref={membershipSelectRef} className="input compact-input" value={form.membershipId} disabled={form.saleType !== 'INSURANCE' || !sale || sale.status !== 'DRAFT'} onChange={(event) => update('membershipId', event.target.value)}><option value="">Membership / Plan</option>{(memberships.data ?? []).filter((membership) => membership.isActive).map((membership) => <option key={membership.membershipId} value={membership.membershipId}>{membership.organizationName} - {membership.planName} ({membership.coveragePercent}%)</option>)}</select></label>
        <label><span>Site</span><input className="input compact-input" value={currentSite?.siteName ?? form.siteId ?? 'Site utilisateur'} disabled /></label>
        <label><span>Devise</span><input className="input compact-input" value="USD / FC" disabled /></label>
        <label><span>Taux</span><input className="input compact-input" value={`1 USD = ${formatMoney(saleExchangeRate, 'CDF')}`} disabled /></label>
        {!sale ? <span className="badge badge-warning">{createDraft.isPending ? 'Preparation...' : 'En attente'}</span> : <span className={`badge ${sale.status === 'VALIDATED' ? 'badge-success' : 'badge-warning'}`}>{sale.status}</span>}
      </form>
      {form.saleType === 'INSURANCE' && !form.customerId && <p className="form-error">Veuillez selectionner un client assure.</p>}

      <section className="card compact-card pos-workspace">
        <div className="pos-search-row">
          <FloatingSearchPopover
            columns={[
              { header: 'Code', render: (article) => article.articleCode },
              { header: 'Barcode', render: (article) => article.barcode ?? '-' },
              { header: 'Nom', render: (article) => <strong>{article.commercialName}</strong> },
              { header: 'DCI', render: (article) => article.dci ?? '-' },
              { header: 'Dosage', render: (article) => article.dosage ?? '-' },
              { header: 'Stock', render: (article) => stockByArticle.get(article.articleId) ?? article.stockAvailable ?? 0 },
              { header: 'Prix vente', render: (article) => <PriceDual amountUsd={Number(article.sellingPrice ?? 0)} rate={saleExchangeRate} /> },
              { header: 'Lot FEFO', render: (article) => fefoByArticle.get(article.articleId)?.lot ?? '-' },
            ]}
            getKey={(article) => article.articleId}
            inputClassName="input pos-article-input"
            inputRef={scanInputRef}
            onChange={setArticleQuery}
            onClose={() => setArticlePopoverOpen(false)}
            onFallbackKeyDown={handleArticleKeys}
            onOpen={() => setArticlePopoverOpen(true)}
            onSelect={selectArticle}
            open={articlePopoverOpen}
            placeholder="Scanner code-barres ou rechercher article..."
            searchPlaceholder="Rechercher (code, nom, DCI, dosage, barcode...)"
            suggestions={articleSuggestions}
            maxVisible={50}
            value={articleQuery}
          />
          {form.saleType === 'INSURANCE' && <button className="ghost-button compact-button" type="button" disabled={!form.membershipId || items.length === 0 || applyInsurance.isPending || sale?.status !== 'DRAFT'} onClick={() => applyInsurance.mutate()}>{applyInsurance.isPending ? 'Application...' : 'Appliquer assurance'}</button>}
        </div>

        <div className="table-wrap pos-grid-wrap">
          <table className="data-table pos-lines-table">
            <thead><tr><th>Article</th><th>Lot FEFO</th><th>Exp</th><th>Unite vente</th><th>Conditionnement</th><th>Qte</th><th>Prix</th><th>Total</th><th>Actions</th></tr></thead>
            <tbody>{items.length === 0 ? <tr><td colSpan={9}><p className="empty-state">Aucun article. Utilisez F2, scannez ou recherchez un produit.</p></td></tr> : items.map((item: any) => {
              const article = articleById.get(item.articleId);
              const salesUnitLabel = unitLabelById.get(article?.salesUnitId ?? '') ?? article?.packaging ?? '-';
              const packagingLabel = unitLabelById.get(article?.packagingUnitId ?? '') ?? article?.packaging ?? '-';
              const quantityDraft = itemQuantityDrafts[item.saleItemId] ?? String(item.quantity ?? '');
              return (
              <tr className={selectedLineId === item.saleItemId ? 'selected-row' : ''} key={item.saleItemId} onClick={() => setSelectedLineId(item.saleItemId)}>
                <td><strong>{item.commercialName ?? article?.commercialName ?? 'Article'}</strong><small>{item.articleCode ?? article?.articleCode ?? ''}</small></td>
                <td>{item.lotNumber ?? '-'}</td>
                <td>{item.expiryDate ? formatDate(item.expiryDate) : '-'}</td>
                <td>{salesUnitLabel}</td>
                <td>{packagingLabel}{article?.unitsPerPackage ? ` x${article.unitsPerPackage}` : ''}</td>
                <td className="quantity-cell">
                  <input
                    className="input compact-input numeric-cell pos-line-quantity"
                    type="number"
                    min="0.001"
                    step="0.001"
                    disabled={sale?.status !== 'DRAFT' || updateItemQuantity.isPending}
                    value={quantityDraft}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      event.stopPropagation();
                      setItemQuantityDrafts((current) => ({ ...current, [item.saleItemId]: event.target.value }));
                    }}
                    onBlur={() => {
                      const normalized = Number(String(itemQuantityDrafts[item.saleItemId] ?? item.quantity).replace(',', '.'));
                      if (!Number.isFinite(normalized) || normalized <= 0) {
                        setClientError('Quantite invalide.');
                        setItemQuantityDrafts((current) => ({ ...current, [item.saleItemId]: String(item.quantity ?? '') }));
                        playBeep('error');
                        return;
                      }
                      if (normalized !== Number(item.quantity ?? 0)) {
                        updateItemQuantity.mutate({ itemId: item.saleItemId, quantity: normalized });
                      }
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        const normalized = Number(String(itemQuantityDrafts[item.saleItemId] ?? item.quantity).replace(',', '.'));
                        if (!Number.isFinite(normalized) || normalized <= 0) {
                          setClientError('Quantite invalide.');
                          playBeep('error');
                          return;
                        }
                        if (normalized !== Number(item.quantity ?? 0)) {
                          updateItemQuantity.mutate({ itemId: item.saleItemId, quantity: normalized });
                        }
                      }
                    }}
                  />
                </td>
                <td className="numeric-text"><PriceDual amountUsd={Number(item.unitPrice ?? 0)} rate={saleExchangeRate} /></td>
                <td className="numeric-text"><strong><PriceDual amountUsd={Number(item.lineTotal ?? 0)} rate={saleExchangeRate} /></strong></td>
                <td><button aria-label="Supprimer ligne" className="ghost-button compact-button row-action-button icon-only danger" type="button" disabled={sale?.status !== 'DRAFT' || removeItem.isPending || updateItemQuantity.isPending} onClick={(event) => { event.stopPropagation(); removeItem.mutate(item.saleItemId); }}><TrashIcon /></button></td>
              </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>
      <p className="muted pos-scan-help">Scanner un code-barres ou taper un nom/code/DCI. Entree sans texte passe au paiement.</p>

      <section className="card compact-card pos-summary-panel">
        <div className="pos-cash-metrics">
          <div className="pos-cash-total">
            <span>Total client</span>
            <strong>{formatMoney(patientPayableFc, 'CDF')}</strong>
            <small>{formatMoney(patientPayable, 'USD', currencySymbol)}</small>
          </div>
          <div className={`pos-cash-change ${hasChangeDue ? 'positive' : ''}`}>
            <span>RENDU</span>
            <strong>{formatMoney(actualChangeDueFc, 'CDF')}</strong>
            <small>{formatMoney(actualChangeDueUsd, 'USD', currencySymbol)}</small>
          </div>
        </div>
        <div className="pos-summary-grid">
          <Summary label="Articles" value={String(items.length)} />
          <Summary label="Qte totale" value={String(quantityTotal)} />
          <Summary label="Sous-total USD" value={formatMoney(subtotal, 'USD', currencySymbol)} />
          <Summary label="Total FC" value={formatMoney(total * saleExchangeRate, 'CDF')} strong />
          <Summary label="Part patient USD" value={formatMoney(patientPayable, 'USD', currencySymbol)} />
          <Summary label="Part patient FC" value={formatMoney(patientPayableFc, 'CDF')} strong />
          <Summary label="Part assurance" value={`${formatMoney(insuranceAmount, 'USD', currencySymbol)} / ${formatMoney(insuranceAmount * saleExchangeRate, 'CDF')}`} />
          <label className="pos-paid-field pos-paid-fc"><span>Paye FC</span><input ref={paymentInputRef} className="input compact-input numeric-cell" type="number" min="0" step="1" value={paidFc} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); quickCheckout(); } }} onChange={(event) => { setPaidFc(event.target.value); setExactPayment(false); }} /></label>
          <label className="pos-paid-field"><span>Paye USD</span><input className="input compact-input numeric-cell" type="number" min="0" step="0.01" value={paidUsd} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); quickCheckout(); } }} onChange={(event) => { setPaidUsd(event.target.value); setExactPayment(false); }} /></label>
          <label className="pos-paid-field"><span>Rendu FC</span><input className="input compact-input numeric-cell" type="number" min="0" step="1" value={returnedFc} onChange={(event) => setReturnedFc(event.target.value)} /></label>
          <label className="pos-paid-field"><span>Rendu USD</span><input className="input compact-input numeric-cell" type="number" min="0" step="0.01" value={returnedUsd} onChange={(event) => setReturnedUsd(event.target.value)} /></label>
          <Summary label="Net USD" value={formatMoney(netReceivedUsd, 'USD', currencySymbol)} />
          <Summary label="Net CDF" value={formatMoney(netReceivedCdf, 'CDF')} />
          <Summary label="Net equiv. USD" value={formatMoney(netTotalEquivalentUsd, 'USD', currencySymbol)} strong />
          <Summary label="Ecart USD" value={formatMoney(settlementDifferenceUsd, 'USD', currencySymbol)} strong />
          <Summary label="Ecart FC" value={formatMoney(settlementDifferenceFc, 'CDF')} />
          <Summary label="Type d ecart" value={settlementStatusLabel} />
          <Summary label="Rendu suggere FC" value={formatMoney(suggestedChangeFc, 'CDF')} />
          <Summary label="Rendu suggere USD" value={formatMoney(suggestedChangeUsd, 'USD', currencySymbol)} />
          <label className="pos-paid-field" style={{ gridColumn: 'span 2' }}><span>Motif ecart</span><input className="input compact-input" placeholder="Arrondi, surplus client, conversion..." value={settlementReason} onChange={(event) => setSettlementReason(event.target.value)} /></label>
          <label className="pos-paid-field" style={{ gridColumn: 'span 2' }}><span>Note</span><input className="input compact-input" placeholder="Observation facultative" value={settlementNote} onChange={(event) => setSettlementNote(event.target.value)} /></label>
        </div>
        <div className="page-actions pos-checkout-actions">
          <button className="ghost-button compact-button pos-secondary-action pos-danger-action" type="button" disabled={!sale || sale.status !== 'DRAFT'} onClick={() => cancel.mutate()}>Annuler vente</button>
          <button className="ghost-button compact-button pos-secondary-action pos-print-action" type="button" disabled={!sale} onClick={printDraft}>Imprimer facture</button>
          <button className="ghost-button compact-button pos-secondary-action pos-exact-action" type="button" disabled={!sale || sale.status !== 'DRAFT' || items.length === 0} onClick={applyExactPayment}>Paiement exact</button>
          <button className="ghost-button compact-button pos-secondary-action" type="button" disabled={!form.siteId || updateDraft.isPending || createDraft.isPending} onClick={saveDraft}>Enregistrer brouillon</button>
          <button className="ghost-button compact-button pos-secondary-action" type="button" onClick={prepareNextSale}>Nouvelle vente</button>
          <div className="pos-checkout-total">
            <span>Total a encaisser</span>
            <strong>{formatMoney(patientPayableFc, 'CDF')}</strong>
            <small>{formatMoney(patientPayable, 'USD', currencySymbol)}</small>
          </div>
          <button className="button pos-checkout-button" type="button" disabled={!sale?.saleId || sale.status !== 'DRAFT' || items.length === 0 || validate.isPending || Boolean((paidUsd || paidFc || exactPayment) && !canValidate())} onClick={quickCheckout}>{validate.isPending ? 'ENCAISSEMENT...' : 'ENCAISSER'}</button>
        </div>
      </section>

      {cashOpenModalOpen && (
        <div className="modal-backdrop pos-open-cash-backdrop" role="dialog" aria-modal="true">
          <form
            className="modal-panel pos-open-cash-panel"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canOpenCash) return;
              openCashSession.mutate();
            }}
          >
            <div className="modal-header">
              <div>
                <h2>Ouvrir la caisse</h2>
                <p className="muted">Confirmez le poste et les fonds initiaux avant d encaisser.</p>
              </div>
              <button className="ghost-button compact-button" type="button" onClick={closeCashAssistant}>Annuler</button>
            </div>
            {cashOpenError && <p className="form-error">{cashOpenError}</p>}
            <div className="cash-open-grid">
              <div><span>Site</span><strong>{currentSite?.siteName ?? form.siteId ?? '-'}</strong></div>
              <div><span>Caissier</span><strong>{currentUser?.fullName ?? '-'}</strong></div>
              <label>
                <span>Poste de travail</span>
                <select
                  className="input compact-input"
                  value={cashOpenWorkstationId}
                  onChange={(event) => {
                    setCashOpenWorkstationId(event.target.value);
                    setCashOpenError('');
                  }}
                >
                  <option value="">{siteWorkstations.length ? 'Selectionnez un poste' : 'Poste non renseigne'}</option>
                  {siteWorkstations.map((workstation) => (
                    <option key={workstation.workstationId} value={workstation.workstationId}>
                      {workstation.workstationName}
                    </option>
                  ))}
                </select>
              </label>
              <div><span>Date et heure</span><strong>{formatDateTime(new Date())}</strong></div>
              <label>
                <span>Fonds initial USD</span>
                <input
                  ref={cashOpenUsdInputRef}
                  className="input compact-input numeric-cell"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashOpenOpeningUsd}
                  onChange={(event) => {
                    setCashOpenOpeningUsd(event.target.value);
                    setCashOpenError('');
                  }}
                />
              </label>
              <label>
                <span>Fonds initial CDF</span>
                <input
                  className="input compact-input numeric-cell"
                  type="number"
                  min="0"
                  step="1"
                  value={cashOpenOpeningCdf}
                  onChange={(event) => {
                    setCashOpenOpeningCdf(event.target.value);
                    setCashOpenError('');
                  }}
                />
              </label>
              <label className="cash-open-note">
                <span>Note facultative</span>
                <input
                  className="input compact-input"
                  type="text"
                  placeholder="Observation optionnelle"
                  value={cashOpenNote}
                  onChange={(event) => {
                    setCashOpenNote(event.target.value);
                    setCashOpenError('');
                  }}
                />
              </label>
            </div>
            <div className="cash-open-summary">
              <span>Montant enregistre</span>
              <strong>{formatMoney(roundMoney(Number(cashOpenOpeningUsd || 0) + (Number(cashOpenOpeningCdf || 0) / currentExchangeRate)), 'USD')}</strong>
              <small>Le montant CDF est converti au taux courant pour l ouverture.</small>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={closeCashAssistant}>Annuler</button>
              <button className="button" type="submit" disabled={!canOpenCash || openCashSession.isPending}>
                {openCashSession.isPending ? 'Ouverture...' : 'Ouvrir la caisse'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="print-invoice">
        <h1>PharmaERP</h1>
        <p>Facture {sale?.saleNumber ?? '-'}</p>
        <p>Date: {sale?.saleDate ? formatDate(sale.saleDate) : '-'}</p>
        <p>Client: {(customers.data ?? []).find((customer) => customer.customerId === form.customerId)?.customerName ?? 'Comptoir'}</p>
        <p>Taux utilise: 1 USD = {formatMoney(saleExchangeRate, 'CDF')}</p>
        <table><tbody>{items.map((item: any) => <tr key={item.saleItemId}><td>{item.commercialName}</td><td>{item.quantity}</td><td>{formatMoney(Number(item.lineTotal ?? 0) * saleExchangeRate, 'CDF')}</td><td>{formatMoney(item.lineTotal, 'USD', currencySymbol)}</td></tr>)}</tbody></table>
        <h2>Total FC: {formatMoney(total * saleExchangeRate, 'CDF')}</h2>
        <p>Total USD: {formatMoney(total, 'USD', currencySymbol)}</p>
        <p>Paye FC: {formatMoney(paidFcAmount, 'CDF')}</p>
        <p>Paye USD: {formatMoney(paidUsdAmount, 'USD', currencySymbol)}</p>
        <p>Rendu FC: {formatMoney(returnedFcAmount, 'CDF')}</p>
        <p>Rendu USD: {formatMoney(returnedUsdAmount, 'USD', currencySymbol)}</p>
        <p>Net paye FC: {formatMoney(netTotalEquivalentFc, 'CDF')}</p>
        <p>Net paye USD: {formatMoney(netTotalEquivalentUsd, 'USD', currencySymbol)}</p>
        <p>Merci pour votre confiance.</p>
      </div>

      {quantityArticle && (
        <div className="modal-backdrop pos-quantity-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel pos-quantity-panel" onSubmit={confirmQuantity}>
            <div className="modal-header">
              <div>
                <h2>Quantite</h2>
                <p className="muted">{quantityArticle.articleCode} - {quantityArticle.commercialName}</p>
              </div>
              <button className="ghost-button compact-button" type="button" onClick={closeQuantityBox}>Fermer</button>
            </div>
            <div className="detail-grid">
              <div><span>Lot FEFO</span><strong>{fefoByArticle.get(quantityArticle.articleId)?.lot ?? '-'}</strong></div>
              <div><span>Stock disponible</span><strong>{stockByArticle.get(quantityArticle.articleId) ?? quantityArticle.stockAvailable ?? 0}</strong></div>
              <div><span>Prix</span><strong>{formatMoney(quantityArticle.sellingPrice ?? 0, currencyCode, currencySymbol)}</strong></div>
            </div>
            <label className="pos-paid-field">
              <span>Quantite</span>
              <input
                ref={quantityInputRef}
                className="input compact-input numeric-cell"
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    confirmQuantity();
                  }
                }}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={closeQuantityBox}>Annuler</button>
              <button className="button" type="submit" disabled={addItem.isPending}>{addItem.isPending ? 'Ajout...' : 'Ajouter'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return <svg aria-hidden="true" className="row-action-icon" focusable="false" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M9 10v8M15 10v8M6 6l1 14h10l1-14" /></svg>;
}

function prioritizeExactBarcode(articles: Article[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return articles;
  return [...articles].sort((a, b) => Number(String(b.barcode ?? '').toLowerCase() === needle) - Number(String(a.barcode ?? '').toLowerCase() === needle));
}

function getOrCreateDeviceUuid() {
  const key = 'deviceUuid';
  const current = localStorage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

function parseScan(raw: string, articles: Article[]) {
  const value = raw.trim();
  if (!value) return null;
  const exact = findExactArticle(value, articles);
  if (exact) return { article: exact, quantity: 1 };

  const separated = value.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|\*|-|\s)\s*(.+)$/i);
  if (separated) {
    const quantity = Number(separated[1].replace(',', '.'));
    const article = findExactArticle(separated[2], articles);
    if (article && quantity > 0) return { article, quantity };
  }

  for (let size = 1; size <= 2 && size < value.length; size += 1) {
    const quantity = Number(value.slice(0, size));
    const article = findExactArticle(value.slice(size), articles);
    if (article && quantity > 0) return { article, quantity };
  }

  return null;
}

function findExactArticle(raw: string, articles: Article[]) {
  const value = raw.trim().toLowerCase();
  return articles.find((article) =>
    [article.articleCode, article.barcode].some((candidate) => String(candidate ?? '').trim().toLowerCase() === value),
  ) ?? null;
}

function PriceDual({ amountUsd, rate }: { amountUsd: number; rate: number }) {
  return (
    <span className="money-dual">
      <span>{formatMoney(amountUsd, 'USD')}</span>
      <small>~ {formatMoney(amountUsd * rate, 'CDF')}</small>
    </span>
  );
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="form-summary pos-summary-item"><span>{label}</span><strong className={strong ? 'pos-total-text' : ''}>{value}</strong></div>;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function classifySettlementDifference(differenceUsd: number, paidCdf: number, paidUsd: number) {
  if (differenceUsd === 0) return 'NONE';
  if (Math.abs(differenceUsd) <= SETTLEMENT_TOLERANCE_USD) {
    return paidCdf > 0 && paidUsd === 0 ? 'EXCHANGE_ROUNDING' : 'ROUNDING';
  }
  return differenceUsd > 0 ? 'OVERPAYMENT' : 'UNDERPAYMENT';
}

function settlementLabel(type: string) {
  if (type === 'NONE') return 'Reglement exact';
  if (type === 'ROUNDING') return 'Arrondi / miette';
  if (type === 'EXCHANGE_ROUNDING') return 'Arrondi de conversion';
  if (type === 'OVERPAYMENT') return 'Surplus encaisse';
  if (type === 'UNDERPAYMENT') return 'Montant manquant';
  return 'Ajustement';
}
