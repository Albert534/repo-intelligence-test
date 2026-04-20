'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DayKey } from '@/types/types';
import { Textarea } from '@/components/ui/textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { CommissionRangeForm } from '@/types/types';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	ChevronDown,
	ChevronRight,
	Plus,
	RefreshCcw,
	Trash2,
} from 'lucide-react';
import { useLocale } from '@/components/locale-provider';

import { toPublicImageUrl } from '@/lib/publicImageUrl';

import { normalizePhoneNumbersForForm } from './../../../lib/normalizePhoneNum';
import {
	GroupSettingsForm,
	DAY_KEYS,
	DAY_LABELS,
	DEFAULT_DAILY_INTERVALS,
	DEFAULT_PER_KM_DAILY_INTERVALS,
	DEFAULT_SETTINGS_FORM,
} from '@/lib/groupSettingDefault';

type SettingsSectionKey =
	| 'group_icon'
	| 'contact'
	| 'wallet_guard'
	| 'base'
	| 'discovery'
	| 'commission'
	| 'fare_base_schedule'
	| 'fare_per_km_schedule';

type FareBaseIntervalForm = {
	id: string;
	name: string;
	start: string;
	end: string;
	fare_base: string;
};
type FareBaseScheduleForm = Record<DayKey, FareBaseIntervalForm[]>;
type FarePerKmIntervalForm = {
	id: string;
	name: string;
	start: string;
	end: string;
	fare_per_km: string;
};
type FarePerKmScheduleForm = Record<DayKey, FarePerKmIntervalForm[]>;

type CommissionItemForm = {
	id: number;
	name: string;
	description: string;
	is_default: boolean;
	is_active: boolean;
	driver_to_driver_commission: boolean;
	commission_type: 'percentage' | 'fare_range';
	commission_rate: string;
	commission_ranges: CommissionRangeForm[];
	assigned_driver_count: number;
};
type NewCommissionItemForm = {
	name: string;
	description: string;
	commission_type: 'percentage' | 'fare_range';
	commission_rate: string;
	driver_to_driver_commission: boolean;
};

//To Refactor

const DEFAULT_COMMISSION_RANGES_FORM: Omit<CommissionRangeForm, 'id'>[] = [
	{ from_fare: '0', to_fare: '4999', commission_amount: '300.00' },
	{ from_fare: '5000', to_fare: '14999', commission_amount: '500.00' },
	{ from_fare: '15000', to_fare: '30000', commission_amount: '1000.00' },
	{ from_fare: '30000', to_fare: '', commission_amount: '1500.00' },
];
const DEFAULT_NEW_COMMISSION_ITEM_FORM: NewCommissionItemForm = {
	name: '',
	description: '',
	commission_type: 'percentage',
	commission_rate: '0.05',
	driver_to_driver_commission: false,
};

function toStr(v: unknown, fallback: string) {
	if (v == null) return fallback;
	const s = String(v).trim();
	return s || fallback;
}

function toFixed2Str(v: unknown, fallback: string) {
	const raw = toStr(v, fallback);
	const n = Number(raw);
	if (!Number.isFinite(n)) return raw;
	return n.toFixed(2);
}

function toIntStr(v: unknown, fallback: string) {
	const raw = toStr(v, fallback);
	const n = Number(raw);
	if (!Number.isFinite(n)) return raw;
	return String(Math.floor(n));
}

function round2(n: number) {
	return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseHmToMinute(v: string) {
	const s = String(v || '').trim();
	const m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
	if (!m) return null;
	return Number(m[1]) * 60 + Number(m[2]);
}

function minuteToHm(minuteRaw: number) {
	const m = (((Number(minuteRaw) || 0) % 1440) + 1440) % 1440;
	const hh = String(Math.floor(m / 60)).padStart(2, '0');
	const mm = String(m % 60).padStart(2, '0');
	return `${hh}:${mm}`;
}

function makeIntervalId() {
	return `iv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildDefaultFareBaseScheduleForm(): FareBaseScheduleForm {
	const out = {} as FareBaseScheduleForm;
	for (const day of DAY_KEYS)
		out[day] = DEFAULT_DAILY_INTERVALS.map((x) => ({
			...x,
			id: makeIntervalId(),
		}));
	return out;
}

function cloneScheduleForm(input: FareBaseScheduleForm): FareBaseScheduleForm {
	const out = {} as FareBaseScheduleForm;
	for (const day of DAY_KEYS)
		out[day] = (input[day] || []).map((x) => ({ ...x }));
	return out;
}

function normalizeFareBaseScheduleForForm(raw: unknown): FareBaseScheduleForm {
	let input: any = raw;
	if (typeof input === 'string') {
		try {
			input = JSON.parse(input);
		} catch {
			return buildDefaultFareBaseScheduleForm();
		}
	}
	if (!input || typeof input !== 'object')
		return buildDefaultFareBaseScheduleForm();

	const out = {} as FareBaseScheduleForm;
	for (const day of DAY_KEYS) {
		const rows = Array.isArray(input[day]) ? input[day] : [];
		if (!rows.length) {
			out[day] = DEFAULT_DAILY_INTERVALS.map((x) => ({
				...x,
				id: makeIntervalId(),
			}));
			continue;
		}
		out[day] = rows.map((r: any) => {
			const start = minuteToHm(
				parseHmToMinute(r?.start ?? r?.start_time) ?? 360,
			);
			const end = minuteToHm(parseHmToMinute(r?.end ?? r?.end_time) ?? 1200);
			const name =
				String(r?.name || r?.interval_name || 'Interval').trim() || 'Interval';
			const fareBase = Number(r?.fare_base ?? r?.fareBase ?? 0);
			const fare_base =
				Number.isFinite(fareBase) ? fareBase.toFixed(2) : '0.00';
			return { id: makeIntervalId(), name, start, end, fare_base };
		});
	}
	return out;
}

function validateFareBaseScheduleForm(
	schedule: FareBaseScheduleForm,
): string | null {
	for (const day of DAY_KEYS) {
		const rows = schedule[day] || [];
		if (!rows.length)
			return `${DAY_LABELS[day]} must contain at least one interval`;

		const coverage = new Uint8Array(1440);
		const markRange = (fromMin: number, toMin: number) => {
			for (let m = fromMin; m < toMin; m++) {
				if (coverage[m] === 1) return false;
				coverage[m] = 1;
			}
			return true;
		};

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (!row.name.trim())
				return `${DAY_LABELS[day]} interval #${i + 1}: name is required`;
			const startMin = parseHmToMinute(row.start);
			const endMin = parseHmToMinute(row.end);
			if (startMin == null)
				return `${DAY_LABELS[day]} interval #${i + 1}: invalid start time`;
			if (endMin == null)
				return `${DAY_LABELS[day]} interval #${i + 1}: invalid end time`;
			if (startMin === endMin)
				return `${DAY_LABELS[day]} interval #${i + 1}: start/end cannot be equal`;
			const fareBase = Number(row.fare_base);
			if (!Number.isFinite(fareBase) || fareBase < 0) {
				return `${DAY_LABELS[day]} interval #${i + 1}: fare base must be >= 0`;
			}

			if (endMin > startMin) {
				if (!markRange(startMin, endMin))
					return `${DAY_LABELS[day]} has overlapping intervals`;
			} else {
				if (!markRange(startMin, 1440))
					return `${DAY_LABELS[day]} has overlapping intervals`;
				if (!markRange(0, endMin))
					return `${DAY_LABELS[day]} has overlapping intervals`;
			}
		}

		if (coverage.some((v) => v === 0))
			return `${DAY_LABELS[day]} must cover full 24 hours with no gaps`;
	}
	return null;
}

function serializeFareBaseScheduleForm(schedule: FareBaseScheduleForm) {
	const out: Record<
		DayKey,
		Array<{ name: string; start: string; end: string; fare_base: number }>
	> = {
		mon: [],
		tue: [],
		wed: [],
		thu: [],
		fri: [],
		sat: [],
		sun: [],
	};
	for (const day of DAY_KEYS) {
		out[day] = (schedule[day] || []).map((row) => ({
			name: row.name.trim(),
			start: minuteToHm(parseHmToMinute(row.start) ?? 0),
			end: minuteToHm(parseHmToMinute(row.end) ?? 0),
			fare_base: round2(Math.max(0, Number(row.fare_base) || 0)),
		}));
	}
	return out;
}

function buildDefaultFarePerKmScheduleForm(): FarePerKmScheduleForm {
	const out = {} as FarePerKmScheduleForm;
	for (const day of DAY_KEYS)
		out[day] = DEFAULT_PER_KM_DAILY_INTERVALS.map((x) => ({
			...x,
			id: makeIntervalId(),
		}));
	return out;
}

function clonePerKmScheduleForm(
	input: FarePerKmScheduleForm,
): FarePerKmScheduleForm {
	const out = {} as FarePerKmScheduleForm;
	for (const day of DAY_KEYS)
		out[day] = (input[day] || []).map((x) => ({ ...x }));
	return out;
}

function normalizeFarePerKmScheduleForForm(
	raw: unknown,
): FarePerKmScheduleForm {
	let input: any = raw;
	if (typeof input === 'string') {
		try {
			input = JSON.parse(input);
		} catch {
			return buildDefaultFarePerKmScheduleForm();
		}
	}
	if (!input || typeof input !== 'object')
		return buildDefaultFarePerKmScheduleForm();

	const out = {} as FarePerKmScheduleForm;
	for (const day of DAY_KEYS) {
		const rows = Array.isArray(input[day]) ? input[day] : [];
		if (!rows.length) {
			out[day] = DEFAULT_PER_KM_DAILY_INTERVALS.map((x) => ({
				...x,
				id: makeIntervalId(),
			}));
			continue;
		}
		out[day] = rows.map((r: any) => {
			const start = minuteToHm(
				parseHmToMinute(r?.start ?? r?.start_time) ?? 360,
			);
			const end = minuteToHm(parseHmToMinute(r?.end ?? r?.end_time) ?? 1200);
			const name =
				String(r?.name || r?.interval_name || 'Interval').trim() || 'Interval';
			const rawRate = Number(
				r?.fare_per_km ?? r?.farePerKm ?? r?.per_km ?? r?.perKm ?? 0,
			);
			const fare_per_km =
				Number.isFinite(rawRate) ? rawRate.toFixed(2) : '0.00';
			return { id: makeIntervalId(), name, start, end, fare_per_km };
		});
	}
	return out;
}

function validateFarePerKmScheduleForm(
	schedule: FarePerKmScheduleForm,
): string | null {
	for (const day of DAY_KEYS) {
		const rows = schedule[day] || [];
		if (!rows.length)
			return `${DAY_LABELS[day]} (per km) must contain at least one interval`;

		const coverage = new Uint8Array(1440);
		const markRange = (fromMin: number, toMin: number) => {
			for (let m = fromMin; m < toMin; m++) {
				if (coverage[m] === 1) return false;
				coverage[m] = 1;
			}
			return true;
		};

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (!row.name.trim())
				return `${DAY_LABELS[day]} (per km) interval #${i + 1}: name is required`;
			const startMin = parseHmToMinute(row.start);
			const endMin = parseHmToMinute(row.end);
			if (startMin == null)
				return `${DAY_LABELS[day]} (per km) interval #${i + 1}: invalid start time`;
			if (endMin == null)
				return `${DAY_LABELS[day]} (per km) interval #${i + 1}: invalid end time`;
			if (startMin === endMin)
				return `${DAY_LABELS[day]} (per km) interval #${i + 1}: start/end cannot be equal`;
			const rate = Number(row.fare_per_km);
			if (!Number.isFinite(rate) || rate < 0)
				return `${DAY_LABELS[day]} (per km) interval #${i + 1}: fare per km must be >= 0`;

			if (endMin > startMin) {
				if (!markRange(startMin, endMin))
					return `${DAY_LABELS[day]} (per km) has overlapping intervals`;
			} else {
				if (!markRange(startMin, 1440))
					return `${DAY_LABELS[day]} (per km) has overlapping intervals`;
				if (!markRange(0, endMin))
					return `${DAY_LABELS[day]} (per km) has overlapping intervals`;
			}
		}

		if (coverage.some((v) => v === 0))
			return `${DAY_LABELS[day]} (per km) must cover full 24 hours with no gaps`;
	}
	return null;
}

function serializeFarePerKmScheduleForm(schedule: FarePerKmScheduleForm) {
	const out: Record<
		DayKey,
		Array<{ name: string; start: string; end: string; fare_per_km: number }>
	> = {
		mon: [],
		tue: [],
		wed: [],
		thu: [],
		fri: [],
		sat: [],
		sun: [],
	};
	for (const day of DAY_KEYS) {
		out[day] = (schedule[day] || []).map((row) => ({
			name: row.name.trim(),
			start: minuteToHm(parseHmToMinute(row.start) ?? 0),
			end: minuteToHm(parseHmToMinute(row.end) ?? 0),
			fare_per_km: round2(Math.max(0, Number(row.fare_per_km) || 0)),
		}));
	}
	return out;
}

function buildDefaultCommissionRangesForm(): CommissionRangeForm[] {
	return DEFAULT_COMMISSION_RANGES_FORM.map((row) => ({
		id: makeIntervalId(),
		from_fare: row.from_fare,
		to_fare: row.to_fare,
		commission_amount: row.commission_amount,
	}));
}

function cloneCommissionRangesForm(
	input: CommissionRangeForm[],
): CommissionRangeForm[] {
	return (input || []).map((row) => ({ ...row }));
}

function normalizeCommissionRangesForForm(raw: unknown): CommissionRangeForm[] {
	let input: any = raw;
	if (typeof input === 'string') {
		try {
			input = JSON.parse(input);
		} catch {
			return buildDefaultCommissionRangesForm();
		}
	}
	if (!Array.isArray(input) || input.length === 0)
		return buildDefaultCommissionRangesForm();

	const rows: CommissionRangeForm[] = [];
	for (const row of input) {
		if (!row || typeof row !== 'object') continue;
		const fromRaw = Number(
			(row as any).from_fare ?? (row as any).fromFare ?? 0,
		);
		const toSource = (row as any).to_fare ?? (row as any).toFare;
		const toRaw =
			toSource == null || toSource === '' ? '' : String(Number(toSource));
		const amtRaw = Number(
			(row as any).commission_amount ??
				(row as any).commissionAmount ??
				(row as any).amount ??
				0,
		);
		rows.push({
			id: makeIntervalId(),
			from_fare: Number.isFinite(fromRaw) ? String(fromRaw) : '0',
			to_fare: toRaw,
			commission_amount: Number.isFinite(amtRaw) ? amtRaw.toFixed(2) : '0.00',
		});
	}
	return rows.length ? rows : buildDefaultCommissionRangesForm();
}

function validateCommissionRangesForm(
	rowsRaw: CommissionRangeForm[],
): string | null {
	if (!Array.isArray(rowsRaw) || rowsRaw.length === 0)
		return 'Commission ranges must contain at least one row';

	const rows = rowsRaw
		.map((row, idx) => {
			const from = Number(row.from_fare);
			const to = row.to_fare.trim() === '' ? null : Number(row.to_fare);
			const amount = Number(row.commission_amount);
			if (!Number.isFinite(from) || from < 0)
				throw new Error(`Commission row #${idx + 1}: From fare must be >= 0`);
			if (to != null && (!Number.isFinite(to) || to < from))
				throw new Error(
					`Commission row #${idx + 1}: To fare must be empty or >= From fare`,
				);
			if (!Number.isFinite(amount) || amount < 0)
				throw new Error(
					`Commission row #${idx + 1}: Commission amount must be >= 0`,
				);
			return { from, to };
		})
		.sort((a, b) => {
			if (a.from !== b.from) return a.from - b.from;
			const aTo = a.to == null ? Number.POSITIVE_INFINITY : a.to;
			const bTo = b.to == null ? Number.POSITIVE_INFINITY : b.to;
			return aTo - bTo;
		});

	if (rows[0]?.from !== 0) return 'Commission ranges must start from 0';
	for (let i = 0; i < rows.length - 1; i++) {
		const cur = rows[i];
		const nxt = rows[i + 1];
		if (cur.to == null)
			return `Commission row #${i + 1} is open-ended and must be the last row`;
		if (nxt.from < cur.to) return 'Commission ranges have overlap';
	}
	if (rows[rows.length - 1]?.to != null)
		return 'Last commission range must be open-ended (leave To fare empty)';
	return null;
}

function serializeCommissionRangesForm(rowsRaw: CommissionRangeForm[]) {
	return rowsRaw
		.map((row) => {
			const from = round2(Math.max(0, Number(row.from_fare) || 0));
			const to = row.to_fare.trim() === '' ? null : round2(Number(row.to_fare));
			const amount = round2(Math.max(0, Number(row.commission_amount) || 0));
			return { from_fare: from, to_fare: to, commission_amount: amount };
		})
		.sort((a, b) => {
			if (a.from_fare !== b.from_fare) return a.from_fare - b.from_fare;
			const aTo = a.to_fare == null ? Number.POSITIVE_INFINITY : a.to_fare;
			const bTo = b.to_fare == null ? Number.POSITIVE_INFINITY : b.to_fare;
			return aTo - bTo;
		});
}

export default function GroupSettingsPage() {
	const params = useParams<{ group_code?: string }>();
	const groupCode =
		typeof params?.group_code === 'string' ? params.group_code : '';
	const { t } = useLocale();

	const [groupName, setGroupName] = useState('');
	const [groupDescription, setGroupDescription] = useState('');
	const [groupIcon, setGroupIcon] = useState('');
	const [groupIconAccent, setGroupIconAccent] = useState('');
	const [loading, setLoading] = useState(true);
	const [savingSection, setSavingSection] = useState<SettingsSectionKey | ''>(
		'',
	);
	const [uploadingGroupIcon, setUploadingGroupIcon] = useState(false);
	const [settingsForm, setSettingsForm] = useState<GroupSettingsForm>(
		DEFAULT_SETTINGS_FORM,
	);
	const [fareBaseScheduleForm, setFareBaseScheduleForm] =
		useState<FareBaseScheduleForm>(buildDefaultFareBaseScheduleForm());
	const [farePerKmScheduleForm, setFarePerKmScheduleForm] =
		useState<FarePerKmScheduleForm>(buildDefaultFarePerKmScheduleForm());
	const [commissionRangesForm, setCommissionRangesForm] = useState<
		CommissionRangeForm[]
	>(buildDefaultCommissionRangesForm());
	const [commissionItems, setCommissionItems] = useState<CommissionItemForm[]>(
		[],
	);
	const [commissionItemsLoading, setCommissionItemsLoading] = useState(false);
	const [commissionItemsSaving, setCommissionItemsSaving] = useState(false);
	const [commissionItemActionId, setCommissionItemActionId] =
		useState<string>('');
	const [newCommissionItem, setNewCommissionItem] =
		useState<NewCommissionItemForm>(DEFAULT_NEW_COMMISSION_ITEM_FORM);
	const [newCommissionRangesForm, setNewCommissionRangesForm] = useState<
		CommissionRangeForm[]
	>(buildDefaultCommissionRangesForm());
	const [newCommissionRangesOpen, setNewCommissionRangesOpen] = useState(false);
	const [commissionItemRangesOpenById, setCommissionItemRangesOpenById] =
		useState<Record<number, boolean>>({});
	const [activeScheduleDay, setActiveScheduleDay] = useState<DayKey>('mon');
	const [groupPhoneNumbers, setGroupPhoneNumbers] = useState<string[]>(['']);

	const fileToDataUrl = (file: File) =>
		new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || ''));
			reader.onerror = () => reject(new Error('file_read_failed'));
			reader.readAsDataURL(file);
		});

	const uploadGroupIcon = async (file: File) => {
		if (!groupCode) return;
		if (!file.type.startsWith('image/')) {
			alert('Only image files are allowed');
			return;
		}
		if (file.size > 10 * 1024 * 1024) {
			alert('Image must be smaller than 10MB');
			return;
		}
		setUploadingGroupIcon(true);
		try {
			const dataUrl = await fileToDataUrl(file);
			const res = await fetch(
				`/api/group-icon-upload?group_code=${encodeURIComponent(groupCode)}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						filename: file.name,
						mime_type: file.type,
						data_base64: dataUrl,
					}),
				},
			);
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				alert(json?.detail || json?.error || 'Failed to upload group icon');
				return;
			}
			const uploadedPath = String(json?.public_path || json?.url || '').trim();
			if (!uploadedPath) {
				alert('Upload failed: no file path returned');
				return;
			}
			setGroupIcon(uploadedPath);
			setGroupIconAccent(toStr(json?.group_icon_accent, ''));
		} catch {
			alert('Failed to upload group icon');
		} finally {
			setUploadingGroupIcon(false);
		}
	};

	const normalizeCommissionItemForForm = (
		raw: any,
	): CommissionItemForm | null => {
		const id = Number(raw?.id);
		if (!Number.isInteger(id) || id <= 0) return null;
		return {
			id,
			name: toStr(raw?.name, 'Default'),
			description: toStr(raw?.description, ''),
			is_default: raw?.is_default === true,
			is_active: raw?.is_active !== false,
			driver_to_driver_commission: raw?.driver_to_driver_commission === true,
			commission_type:
				raw?.commission_type === 'fare_range' ? 'fare_range' : 'percentage',
			commission_rate: toFixed2Str(raw?.commission_rate, '0.05'),
			commission_ranges: normalizeCommissionRangesForForm(
				raw?.commission_ranges,
			),
			assigned_driver_count: Number(raw?.assigned_driver_count || 0),
		};
	};

	const loadCommissionItems = async () => {
		if (!groupCode) return;
		setCommissionItemsLoading(true);
		try {
			const res = await fetch(
				`/api/group/commission-items?group_code=${encodeURIComponent(groupCode)}`,
				{
					cache: 'no-store',
				},
			);
			const json = await res.json().catch(() => null);
			if (!res.ok || !json) {
				alert(json?.detail || json?.error || 'Failed to load commission plans');
				return;
			}
			const rows = Array.isArray(json?.items) ? json.items : [];
			const normalized = rows
				.map((row: any) => normalizeCommissionItemForForm(row))
				.filter(
					(row: CommissionItemForm | null): row is CommissionItemForm => !!row,
				);
			setCommissionItems(normalized);
		} finally {
			setCommissionItemsLoading(false);
		}
	};

	const withCommissionItemAction = async (
		actionId: string,
		action: () => Promise<void>,
	) => {
		if (commissionItemsSaving) return;
		setCommissionItemsSaving(true);
		setCommissionItemActionId(actionId);
		try {
			await action();
			await loadCommissionItems();
		} finally {
			setCommissionItemsSaving(false);
			setCommissionItemActionId('');
		}
	};

	const saveCommissionItemRow = async (row: CommissionItemForm) => {
		await withCommissionItemAction(`save-${row.id}`, async () => {
			const payload: Record<string, unknown> = {
				id: row.id,
				name: row.name.trim() || 'Default',
				description: row.description.trim() || null,
				is_active: row.is_active,
				driver_to_driver_commission: row.driver_to_driver_commission,
			};
			if (row.commission_type === 'percentage') {
				const rate = parseNum(row.commission_rate, 'COMMISSION_RATE');
				if (rate == null || rate < 0 || rate > 1) {
					alert('COMMISSION_RATE must be between 0 and 1');
					return;
				}
				payload.commission_type = 'percentage';
				payload.commission_rate = round2(rate);
			} else {
				const rangeErr = validateCommissionRangesForm(row.commission_ranges);
				if (rangeErr) {
					alert(`Commission plan "${row.name || row.id}" - ${rangeErr}`);
					return;
				}
				payload.commission_type = 'fare_range';
				payload.commission_ranges = serializeCommissionRangesForm(
					row.commission_ranges,
				);
			}
			const res = await fetch(
				`/api/group/commission-items?group_code=${encodeURIComponent(groupCode)}`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...payload,
					}),
				},
			);
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				alert(json?.detail || json?.error || 'Failed to save commission plan');
				return;
			}
			alert('Commission plan saved');
		});
	};

	const setCommissionItemAsDefault = async (itemId: number) => {
		await withCommissionItemAction(`default-${itemId}`, async () => {
			const res = await fetch(
				`/api/group/commission-items?group_code=${encodeURIComponent(groupCode)}`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: itemId,
						is_default: true,
					}),
				},
			);
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				alert(
					json?.detail ||
						json?.error ||
						'Failed to set default commission plan',
				);
				return;
			}
			alert('Default commission plan updated');
		});
	};

	const deleteCommissionItem = async (itemId: number) => {
		if (!confirm('Delete this commission plan?')) return;
		await withCommissionItemAction(`delete-${itemId}`, async () => {
			const res = await fetch(
				`/api/group/commission-items?id=${itemId}&group_code=${encodeURIComponent(groupCode)}`,
				{ method: 'DELETE' },
			);
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				alert(
					json?.detail || json?.error || 'Failed to delete commission plan',
				);
				return;
			}
			alert('Commission plan deleted');
		});
	};

	const addCommissionItem = async () => {
		await withCommissionItemAction('create', async () => {
			const payload: Record<string, unknown> = {
				name: newCommissionItem.name.trim() || 'Default',
				description: newCommissionItem.description.trim() || null,
				commission_type: newCommissionItem.commission_type,
				driver_to_driver_commission:
					newCommissionItem.driver_to_driver_commission,
			};
			if (newCommissionItem.commission_type === 'percentage') {
				const rate = parseNum(
					newCommissionItem.commission_rate,
					'COMMISSION_RATE',
				);
				if (rate == null || rate < 0 || rate > 1) {
					alert('COMMISSION_RATE must be between 0 and 1');
					return;
				}
				payload.commission_rate = round2(rate);
			} else {
				const rangeErr = validateCommissionRangesForm(newCommissionRangesForm);
				if (rangeErr) {
					alert(rangeErr);
					return;
				}
				payload.commission_ranges = serializeCommissionRangesForm(
					newCommissionRangesForm,
				);
			}

			const res = await fetch(
				`/api/group/commission-items?group_code=${encodeURIComponent(groupCode)}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...payload,
					}),
				},
			);
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				alert(
					json?.detail || json?.error || 'Failed to create commission plan',
				);
				return;
			}
			setNewCommissionItem(DEFAULT_NEW_COMMISSION_ITEM_FORM);
			setNewCommissionRangesForm(buildDefaultCommissionRangesForm());
			alert('Commission plan created');
		});
	};

	const loadSettings = async () => {
		if (!groupCode) return;
		setLoading(true);
		try {
			const res = await fetch(
				`/api/group_settings?group_code=${encodeURIComponent(groupCode)}`,
				{ cache: 'no-store' },
			);
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				alert(json?.detail || json?.error || 'Failed to load group settings');
				return;
			}

			setGroupName(toStr(json?.group_name, ''));
			setGroupDescription(toStr(json?.description, ''));
			setGroupIcon(toStr(json?.group_icon, ''));
			setGroupIconAccent(toStr(json?.group_icon_accent, ''));
			setSettingsForm({
				fare_base: toFixed2Str(
					json?.fare_base,
					DEFAULT_SETTINGS_FORM.fare_base,
				),
				fare_per_km: toFixed2Str(
					json?.fare_per_km,
					DEFAULT_SETTINGS_FORM.fare_per_km,
				),
				fare_per_min: toFixed2Str(
					json?.fare_per_min,
					DEFAULT_SETTINGS_FORM.fare_per_min,
				),
				fare_min: toFixed2Str(json?.fare_min, DEFAULT_SETTINGS_FORM.fare_min),
				fare_ccy: toStr(json?.fare_ccy, DEFAULT_SETTINGS_FORM.fare_ccy),
				fare_traffic_mult: toFixed2Str(
					json?.fare_traffic_mult,
					DEFAULT_SETTINGS_FORM.fare_traffic_mult,
				),
				fare_extra_dropoff: toFixed2Str(
					json?.fare_extra_dropoff,
					DEFAULT_SETTINGS_FORM.fare_extra_dropoff,
				),
				wait_free_min: toIntStr(
					json?.wait_free_min,
					DEFAULT_SETTINGS_FORM.wait_free_min,
				),
				wait_per_min: toFixed2Str(
					json?.wait_per_min,
					DEFAULT_SETTINGS_FORM.wait_per_min,
				),
				wallet_online_min_balance: toFixed2Str(
					json?.wallet_online_min_balance,
					DEFAULT_SETTINGS_FORM.wallet_online_min_balance,
				),
				wallet_online_mode:
					(
						json?.wallet_online_mode === 'ordinary' ||
						json?.wallet_online_mode === 'promo'
					) ?
						json.wallet_online_mode
					:	'combined',
				passenger_driver_limit: toIntStr(
					json?.passenger_driver_limit,
					DEFAULT_SETTINGS_FORM.passenger_driver_limit,
				),
				passenger_driver_radius_km: toFixed2Str(
					json?.passenger_driver_radius_km,
					DEFAULT_SETTINGS_FORM.passenger_driver_radius_km,
				),
				driver_scan_band_km: toFixed2Str(
					json?.driver_scan_band_km,
					DEFAULT_SETTINGS_FORM.driver_scan_band_km,
				),
				offer_ttl_seconds: toIntStr(
					json?.offer_ttl_seconds,
					DEFAULT_SETTINGS_FORM.offer_ttl_seconds,
				),
				allow_schedule_trip:
					json?.allow_schedule_trip === true ||
					String(json?.allow_schedule_trip ?? '')
						.trim()
						.toLowerCase() === 'true',
				schedule_min_lead_hours: toIntStr(
					json?.schedule_min_lead_hours,
					DEFAULT_SETTINGS_FORM.schedule_min_lead_hours,
				),
				allow_post_accept_dropoff_change:
					json?.allow_post_accept_dropoff_change === true ||
					String(json?.allow_post_accept_dropoff_change ?? '')
						.trim()
						.toLowerCase() === 'true',
				post_accept_dropoff_change_surcharge: toFixed2Str(
					json?.post_accept_dropoff_change_surcharge,
					DEFAULT_SETTINGS_FORM.post_accept_dropoff_change_surcharge,
				),
				call_mode: json?.call_mode === 'group' ? 'group' : 'driver',
				commission_type:
					json?.commission_type === 'fare_range' ? 'fare_range' : 'percentage',
				commission_rate: toFixed2Str(
					json?.commission_rate,
					DEFAULT_SETTINGS_FORM.commission_rate,
				),
			});
			setFareBaseScheduleForm(
				normalizeFareBaseScheduleForForm(json?.fare_base_schedule),
			);
			setFarePerKmScheduleForm(
				normalizeFarePerKmScheduleForForm(json?.fare_per_km_schedule),
			);
			setCommissionRangesForm(
				normalizeCommissionRangesForForm(json?.commission_ranges),
			);
			setGroupPhoneNumbers(
				normalizePhoneNumbersForForm(json?.group_phone_numbers),
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadSettings();
		loadCommissionItems();
	}, [groupCode]);

	const isSaving = (section: SettingsSectionKey) => savingSection === section;

	const saveSection = async (
		section: SettingsSectionKey,
		payload: Record<string, unknown>,
		successMessage: string,
	) => {
		if (!groupCode || savingSection) return;
		setSavingSection(section);
		try {
			const res = await fetch('/api/group_settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					group_code: groupCode,
					...payload,
				}),
			});
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				alert(json?.detail || json?.error || 'Failed to save settings');
				return;
			}
			alert(successMessage);
		} finally {
			setSavingSection('');
		}
	};

	const parseNum = (value: string, fieldName: string) => {
		const n = Number(value);
		if (!Number.isFinite(n)) {
			alert(`${fieldName} must be a valid number`);
			return null;
		}
		return n;
	};

	const collectGroupPhones = () => {
		const cleaned = Array.from(
			new Set(
				groupPhoneNumbers.map((x) => x.trim()).filter((x) => x.length > 0),
			),
		);
		if (cleaned.some((x) => x.length > 32)) {
			alert('Each group phone number must be 32 characters or less');
			return null;
		}
		return cleaned;
	};

	const saveGroupIcon = async () => {
		await saveSection(
			'group_icon',
			{
				description: groupDescription.trim() || null,
				group_icon: groupIcon.trim() || null,
				group_icon_accent: groupIconAccent.trim() || null,
			},
			'Group profile saved',
		);
	};

	const saveContactSettings = async () => {
		const cleanedGroupPhones = collectGroupPhones();
		if (!cleanedGroupPhones) return;
		await saveSection(
			'contact',
			{
				call_mode: settingsForm.call_mode,
				group_phone_numbers: cleanedGroupPhones,
			},
			'Contact settings saved',
		);
	};

	const saveCallModeOnly = async (nextMode: 'driver' | 'group') => {
		await saveSection(
			'contact',
			{
				call_mode: nextMode,
			},
			'Call mode saved',
		);
		await loadSettings();
	};

	const saveWalletGuardSettings = async () => {
		const minBalance = parseNum(
			settingsForm.wallet_online_min_balance,
			'WALLET_ONLINE_MIN_BALANCE',
		);
		if (minBalance == null || minBalance < 0) {
			alert('WALLET_ONLINE_MIN_BALANCE must be zero or greater');
			return;
		}
		await saveSection(
			'wallet_guard',
			{
				wallet_online_min_balance: round2(minBalance),
				wallet_online_mode: settingsForm.wallet_online_mode,
			},
			'Driver wallet guard settings saved',
		);
	};

	const saveBaseSettings = async () => {
		const fareBase = parseNum(settingsForm.fare_base, 'FARE_BASE');
		const farePerKm = parseNum(settingsForm.fare_per_km, 'FARE_PER_KM');
		const farePerMin = parseNum(settingsForm.fare_per_min, 'FARE_PER_MIN');
		const fareMin = parseNum(settingsForm.fare_min, 'FARE_MIN');
		const fareTrafficMult = parseNum(
			settingsForm.fare_traffic_mult,
			'FARE_TRAFFIC_MULT',
		);
		const fareExtraDropoff = parseNum(
			settingsForm.fare_extra_dropoff,
			'FARE_EXTRA_DROPOFF',
		);
		const waitFreeMinRaw = parseNum(
			settingsForm.wait_free_min,
			'WAIT_FREE_MIN',
		);
		const waitPerMin = parseNum(settingsForm.wait_per_min, 'WAIT_PER_MIN');
		const fareCcy = settingsForm.fare_ccy.trim();
		if (
			fareBase == null ||
			farePerKm == null ||
			farePerMin == null ||
			fareMin == null ||
			fareTrafficMult == null ||
			fareExtraDropoff == null ||
			waitFreeMinRaw == null ||
			waitPerMin == null
		) {
			return;
		}
		if (
			fareBase < 0 ||
			farePerKm < 0 ||
			farePerMin < 0 ||
			fareMin < 0 ||
			fareExtraDropoff < 0
		) {
			alert('Fare values must be zero or greater');
			return;
		}
		if (fareTrafficMult <= 0) {
			alert('FARE_TRAFFIC_MULT must be greater than 0');
			return;
		}
		const waitFreeMin = Math.floor(waitFreeMinRaw);
		if (waitFreeMin < 0 || waitPerMin < 0) {
			alert('WAIT_FREE_MIN and WAIT_PER_MIN must be zero or greater');
			return;
		}
		if (!fareCcy) {
			alert('FARE_CCY is required');
			return;
		}
		await saveSection(
			'base',
			{
				fare_base: round2(fareBase),
				fare_per_km: round2(farePerKm),
				fare_per_min: round2(farePerMin),
				fare_min: round2(fareMin),
				fare_ccy: fareCcy,
				fare_traffic_mult: round2(fareTrafficMult),
				fare_extra_dropoff: round2(fareExtraDropoff),
				wait_free_min: waitFreeMin,
				wait_per_min: round2(waitPerMin),
			},
			'Base settings saved',
		);
	};

	const saveDiscoverySettings = async () => {
		const passengerDriverLimitRaw = parseNum(
			settingsForm.passenger_driver_limit,
			'PASSENGER_DRIVER_LIMIT',
		);
		const passengerDriverRadiusKm = parseNum(
			settingsForm.passenger_driver_radius_km,
			'PASSENGER_DRIVER_RADIUS_KM',
		);
		const driverScanBandKm = parseNum(
			settingsForm.driver_scan_band_km,
			'DRIVER_SCAN_BAND_KM',
		);
		const offerTtlSecondsRaw = parseNum(
			settingsForm.offer_ttl_seconds,
			'OFFER_TTL_SECONDS',
		);
		if (passengerDriverLimitRaw == null) return;
		if (passengerDriverRadiusKm == null) return;
		if (driverScanBandKm == null) return;
		if (offerTtlSecondsRaw == null) return;
		const fallbackScheduleMinLeadHours = (() => {
			const n = Number(settingsForm.schedule_min_lead_hours);
			if (!Number.isFinite(n)) return 3;
			return Math.max(0, Math.min(168, Math.floor(n)));
		})();
		let scheduleMinLeadHours = fallbackScheduleMinLeadHours;
		if (settingsForm.allow_schedule_trip) {
			const scheduleMinLeadHoursRaw = parseNum(
				settingsForm.schedule_min_lead_hours,
				'SCHEDULE_MIN_LEAD_HOURS',
			);
			if (scheduleMinLeadHoursRaw == null) return;
			scheduleMinLeadHours = Math.floor(scheduleMinLeadHoursRaw);
			if (scheduleMinLeadHours < 0 || scheduleMinLeadHours > 168) {
				alert('SCHEDULE_MIN_LEAD_HOURS must be between 0 and 168');
				return;
			}
		}
		const passengerDriverLimit = Math.floor(passengerDriverLimitRaw);
		const offerTtlSeconds = Math.floor(offerTtlSecondsRaw);
		let postAcceptDropoffChangeSurcharge = 5000;
		if (settingsForm.allow_post_accept_dropoff_change) {
			const surchargeRaw = parseNum(
				settingsForm.post_accept_dropoff_change_surcharge,
				'POST_ACCEPT_DROPOFF_CHANGE_SURCHARGE',
			);
			if (surchargeRaw == null) return;
			if (surchargeRaw < 0) {
				alert('POST_ACCEPT_DROPOFF_CHANGE_SURCHARGE must be zero or greater');
				return;
			}
			postAcceptDropoffChangeSurcharge = round2(surchargeRaw);
		}
		if (passengerDriverLimit < 0) {
			alert('PASSENGER_DRIVER_LIMIT must be zero or greater');
			return;
		}
		if (passengerDriverRadiusKm <= 0) {
			alert('PASSENGER_DRIVER_RADIUS_KM must be greater than 0');
			return;
		}
		if (driverScanBandKm <= 0) {
			alert('DRIVER_SCAN_BAND_KM must be greater than 0');
			return;
		}
		if (offerTtlSeconds < 5 || offerTtlSeconds > 300) {
			alert('OFFER_TTL_SECONDS must be between 5 and 300');
			return;
		}
		await saveSection(
			'discovery',
			{
				passenger_driver_limit: passengerDriverLimit,
				passenger_driver_radius_km: round2(passengerDriverRadiusKm),
				driver_scan_band_km: round2(driverScanBandKm),
				offer_ttl_seconds: offerTtlSeconds,
				allow_schedule_trip: settingsForm.allow_schedule_trip,
				schedule_min_lead_hours: scheduleMinLeadHours,
				allow_post_accept_dropoff_change:
					settingsForm.allow_post_accept_dropoff_change,
				post_accept_dropoff_change_surcharge: postAcceptDropoffChangeSurcharge,
			},
			'Passenger driver discovery saved',
		);
	};

	const saveCommissionSettings = async () => {
		if (settingsForm.commission_type === 'percentage') {
			const commissionRate = parseNum(
				settingsForm.commission_rate,
				'COMMISSION_RATE',
			);
			if (commissionRate == null || commissionRate < 0 || commissionRate > 1) {
				alert('COMMISSION_RATE must be between 0 and 1');
				return;
			}
			await saveSection(
				'commission',
				{
					commission_type: 'percentage',
					commission_rate: round2(commissionRate),
				},
				'Commission settings saved',
			);
			return;
		}

		const commissionRangesErr =
			validateCommissionRangesForm(commissionRangesForm);
		if (commissionRangesErr) {
			alert(commissionRangesErr);
			return;
		}
		await saveSection(
			'commission',
			{
				commission_type: 'fare_range',
				commission_ranges: serializeCommissionRangesForm(commissionRangesForm),
			},
			'Commission settings saved',
		);
	};

	const saveFareBaseSchedule = async () => {
		const scheduleErr = validateFareBaseScheduleForm(fareBaseScheduleForm);
		if (scheduleErr) {
			alert(scheduleErr);
			return;
		}
		await saveSection(
			'fare_base_schedule',
			{
				fare_base_schedule: serializeFareBaseScheduleForm(fareBaseScheduleForm),
			},
			'Fare base schedule saved',
		);
	};

	const saveFarePerKmSchedule = async () => {
		const perKmScheduleErr = validateFarePerKmScheduleForm(
			farePerKmScheduleForm,
		);
		if (perKmScheduleErr) {
			alert(perKmScheduleErr);
			return;
		}
		await saveSection(
			'fare_per_km_schedule',
			{
				fare_per_km_schedule: serializeFarePerKmScheduleForm(
					farePerKmScheduleForm,
				),
			},
			'Fare per km schedule saved',
		);
	};

	const updateScheduleRow = (
		day: DayKey,
		index: number,
		patch: Partial<FareBaseIntervalForm>,
	) => {
		setFareBaseScheduleForm((prev) => {
			const next = cloneScheduleForm(prev);
			if (!next[day] || !next[day][index]) return prev;
			next[day][index] = { ...next[day][index], ...patch };
			return next;
		});
	};
	const addScheduleRow = (day: DayKey) => {
		setFareBaseScheduleForm((prev) => {
			const next = cloneScheduleForm(prev);
			next[day] = [
				...(next[day] || []),
				{
					id: makeIntervalId(),
					name: 'Interval',
					start: '00:00',
					end: '01:00',
					fare_base: '0.00',
				},
			];
			return next;
		});
	};
	const removeScheduleRow = (day: DayKey, index: number) => {
		setFareBaseScheduleForm((prev) => {
			const next = cloneScheduleForm(prev);
			if ((next[day] || []).length <= 1) return prev;
			next[day] = next[day].filter((_, i) => i !== index);
			return next;
		});
	};
	const applyDefaultScheduleToAllDays = () =>
		setFareBaseScheduleForm(buildDefaultFareBaseScheduleForm());
	const copyDayToAllDays = (day: DayKey) => {
		setFareBaseScheduleForm((prev) => {
			const source = (prev[day] || []).map((x) => ({
				...x,
				id: makeIntervalId(),
			}));
			const next = {} as FareBaseScheduleForm;
			for (const d of DAY_KEYS)
				next[d] = source.map((x) => ({ ...x, id: makeIntervalId() }));
			return next;
		});
	};

	const updatePerKmScheduleRow = (
		day: DayKey,
		index: number,
		patch: Partial<FarePerKmIntervalForm>,
	) => {
		setFarePerKmScheduleForm((prev) => {
			const next = clonePerKmScheduleForm(prev);
			if (!next[day] || !next[day][index]) return prev;
			next[day][index] = { ...next[day][index], ...patch };
			return next;
		});
	};
	const addPerKmScheduleRow = (day: DayKey) => {
		setFarePerKmScheduleForm((prev) => {
			const next = clonePerKmScheduleForm(prev);
			next[day] = [
				...(next[day] || []),
				{
					id: makeIntervalId(),
					name: 'Interval',
					start: '00:00',
					end: '01:00',
					fare_per_km: '0.00',
				},
			];
			return next;
		});
	};
	const removePerKmScheduleRow = (day: DayKey, index: number) => {
		setFarePerKmScheduleForm((prev) => {
			const next = clonePerKmScheduleForm(prev);
			if ((next[day] || []).length <= 1) return prev;
			next[day] = next[day].filter((_, i) => i !== index);
			return next;
		});
	};
	const applyDefaultPerKmScheduleToAllDays = () =>
		setFarePerKmScheduleForm(buildDefaultFarePerKmScheduleForm());
	const copyPerKmDayToAllDays = (day: DayKey) => {
		setFarePerKmScheduleForm((prev) => {
			const source = (prev[day] || []).map((x) => ({
				...x,
				id: makeIntervalId(),
			}));
			const next = {} as FarePerKmScheduleForm;
			for (const d of DAY_KEYS)
				next[d] = source.map((x) => ({ ...x, id: makeIntervalId() }));
			return next;
		});
	};

	const updateCommissionRangeRow = (
		index: number,
		patch: Partial<CommissionRangeForm>,
	) => {
		setCommissionRangesForm((prev) => {
			const next = cloneCommissionRangesForm(prev);
			if (!next[index]) return prev;
			next[index] = { ...next[index], ...patch };
			return next;
		});
	};
	const addCommissionRangeRow = () => {
		setCommissionRangesForm((prev) => [
			...cloneCommissionRangesForm(prev),
			{
				id: makeIntervalId(),
				from_fare: '0',
				to_fare: '',
				commission_amount: '0.00',
			},
		]);
	};
	const removeCommissionRangeRow = (index: number) => {
		setCommissionRangesForm((prev) =>
			prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
		);
	};
	const applyDefaultCommissionRanges = () =>
		setCommissionRangesForm(buildDefaultCommissionRangesForm());
	const updateCommissionItemRow = (
		itemId: number,
		patch: Partial<CommissionItemForm>,
	) => {
		setCommissionItems((prev) =>
			prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
		);
	};
	const updateCommissionItemRangeRow = (
		itemId: number,
		index: number,
		patch: Partial<CommissionRangeForm>,
	) => {
		setCommissionItems((prev) =>
			prev.map((item) => {
				if (item.id !== itemId) return item;
				const nextRanges = cloneCommissionRangesForm(
					item.commission_ranges || [],
				);
				if (!nextRanges[index]) return item;
				nextRanges[index] = { ...nextRanges[index], ...patch };
				return { ...item, commission_ranges: nextRanges };
			}),
		);
	};
	const addCommissionItemRangeRow = (itemId: number) => {
		setCommissionItems((prev) =>
			prev.map((item) => {
				if (item.id !== itemId) return item;
				return {
					...item,
					commission_ranges: [
						...cloneCommissionRangesForm(item.commission_ranges || []),
						{
							id: makeIntervalId(),
							from_fare: '0',
							to_fare: '',
							commission_amount: '0.00',
						},
					],
				};
			}),
		);
	};
	const removeCommissionItemRangeRow = (itemId: number, index: number) => {
		setCommissionItems((prev) =>
			prev.map((item) => {
				if (item.id !== itemId) return item;
				if ((item.commission_ranges || []).length <= 1) return item;
				return {
					...item,
					commission_ranges: item.commission_ranges.filter(
						(_, i) => i !== index,
					),
				};
			}),
		);
	};
	const applyDefaultCommissionItemRanges = (itemId: number) => {
		setCommissionItems((prev) =>
			prev.map((item) =>
				item.id === itemId ?
					{ ...item, commission_ranges: buildDefaultCommissionRangesForm() }
				:	item,
			),
		);
	};
	const updateNewCommissionRangeRow = (
		index: number,
		patch: Partial<CommissionRangeForm>,
	) => {
		setNewCommissionRangesForm((prev) => {
			const next = cloneCommissionRangesForm(prev);
			if (!next[index]) return prev;
			next[index] = { ...next[index], ...patch };
			return next;
		});
	};
	const addNewCommissionRangeRow = () => {
		setNewCommissionRangesForm((prev) => [
			...cloneCommissionRangesForm(prev),
			{
				id: makeIntervalId(),
				from_fare: '0',
				to_fare: '',
				commission_amount: '0.00',
			},
		]);
	};
	const removeNewCommissionRangeRow = (index: number) => {
		setNewCommissionRangesForm((prev) =>
			prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
		);
	};
	const applyDefaultNewCommissionRanges = () => {
		setNewCommissionRangesForm(buildDefaultCommissionRangesForm());
	};
	const isCommissionItemBusy = (actionPrefix: string, itemId?: number) => {
		if (!commissionItemsSaving) return false;
		if (itemId == null) return commissionItemActionId === actionPrefix;
		return commissionItemActionId === `${actionPrefix}-${itemId}`;
	};
	const isCommissionItemRangesOpen = (itemId: number) =>
		commissionItemRangesOpenById[itemId] === true;
	const toggleCommissionItemRangesOpen = (itemId: number) => {
		setCommissionItemRangesOpenById((prev) => ({
			...prev,
			[itemId]: !(prev[itemId] === true),
		}));
	};
	const updateGroupPhoneAt = (index: number, value: string) => {
		setGroupPhoneNumbers((prev) =>
			prev.map((p, i) => (i === index ? value : p)),
		);
	};
	const addGroupPhone = () => {
		setGroupPhoneNumbers((prev) => [...prev, '']);
	};
	const removeGroupPhone = (index: number) => {
		setGroupPhoneNumbers((prev) => {
			if (prev.length <= 1) return [''];
			const next = prev.filter((_, i) => i !== index);
			return next.length ? next : [''];
		});
	};

	return (
		<div className='p-4 space-y-4'>
			<div className='flex items-center gap-2'>
				<h1 className='text-xl font-semibold'>
					{t('settings.title', 'Group Fare Settings')}
				</h1>
				<div className='text-xs rounded-md border px-2 py-1 font-mono'>
					{groupCode || 'unknown'}
				</div>
				<Button
					variant='ghost'
					size='icon'
					onClick={loadSettings}
					title={t('settings.reload', 'Reload')}
				>
					<RefreshCcw className='h-4 w-4' />
				</Button>
			</div>
			{groupName ?
				<div className='text-sm text-muted-foreground'>{groupName}</div>
			:	null}

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>
						{t('settings.group_profile', 'Group Profile')}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className='rounded-md border bg-white p-3 space-y-4'>
						<div className='flex items-center justify-between gap-4'>
							<div className='flex items-center gap-3 min-w-0'>
								{toPublicImageUrl(groupIcon) ?
									<img
										src={toPublicImageUrl(groupIcon)}
										alt={groupName || groupCode || 'Group icon'}
										className='h-12 w-12 rounded-md border object-cover'
									/>
								:	<div className='h-12 w-12 rounded-md border bg-slate-50 text-[10px] text-slate-500 flex items-center justify-center'>
										{t('settings.no_icon', 'No Icon')}
									</div>
								}
								<div className='min-w-0'>
									<div className='text-sm font-medium truncate'>
										{groupName || groupCode || 'Group'}
									</div>
									<div className='text-xs text-muted-foreground truncate'>
										{toPublicImageUrl(groupIcon) ?
											t('settings.icon_uploaded', 'Icon uploaded')
										:	t('settings.no_icon_uploaded', 'No icon uploaded')}
									</div>
								</div>
							</div>
							<div className='flex items-center gap-2'>
								<label
									className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-xs font-medium ${uploadingGroupIcon ? 'opacity-60 cursor-not-allowed' : ''}`}
								>
									<input
										type='file'
										accept='image/*'
										className='hidden'
										disabled={uploadingGroupIcon}
										onChange={(e) => {
											const file = e.target.files?.[0];
											e.currentTarget.value = '';
											if (!file) return;
											void uploadGroupIcon(file);
										}}
									/>
									{uploadingGroupIcon ?
										t('common.uploading', 'Uploading...')
									: toPublicImageUrl(groupIcon) ?
										t('settings.change_icon', 'Change Icon')
									:	t('settings.upload_icon', 'Upload Icon')}
								</label>
								<Button
									type='button'
									size='sm'
									onClick={saveGroupIcon}
									disabled={uploadingGroupIcon || isSaving('group_icon')}
								>
									{isSaving('group_icon') ?
										t('common.saving', 'Saving...')
									:	t('settings.save_group_profile', 'Save Profile')}
								</Button>
							</div>
						</div>
						<div className='space-y-2'>
							<div className='space-y-0.5'>
								<div className='text-sm font-semibold text-slate-700'>
									{t('settings.group_description', 'Group Description')}
								</div>
								<div className='text-[11px] font-mono tracking-wide text-slate-400'>
									DESCRIPTION
								</div>
							</div>
							<Textarea
								value={groupDescription}
								onChange={(e) => setGroupDescription(e.target.value)}
								rows={4}
								placeholder={t(
									'settings.group_description_placeholder',
									'Short summary shown on passenger home group cards.',
								)}
							/>
							<div className='text-xs text-muted-foreground'>
								{t(
									'settings.group_description_help',
									'Passenger home cards show up to 2 lines of this description.',
								)}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{loading ?
				<div className='text-sm text-muted-foreground'>
					{t('settings.loading', 'Loading settings...')}
				</div>
			:	<>
					<Card>
						<CardHeader>
							<CardTitle className='text-base'>
								{t('settings.group_contact_numbers', 'Group Contact Numbers')}
							</CardTitle>
						</CardHeader>
						<CardContent className='space-y-3'>
							<div className='rounded-md border bg-white px-3 py-3'>
								<div className='flex items-center justify-between gap-3'>
									<div>
										<div className='space-y-0.5'>
											<div className='text-sm font-semibold text-slate-700'>
												{t('settings.field.call_mode.label', 'Call Mode')}
											</div>
											<div className='text-[11px] font-mono tracking-wide text-slate-400'>
												CALL_MODE
											</div>
										</div>
										<div className='text-xs text-muted-foreground leading-relaxed'>
											{settingsForm.call_mode === 'group' ?
												t(
													'settings.field.call_mode.desc_group',
													"Passengers and drivers call this group's configured contact numbers.",
												)
											:	t(
													'settings.field.call_mode.desc_direct',
													'Passengers and drivers call each other directly.',
												)
											}
										</div>
									</div>
									<div className='flex items-center gap-2'>
										<span
											className={`text-xs font-medium ${settingsForm.call_mode === 'driver' ? 'text-[#1E3A5F]' : 'text-slate-500'}`}
										>
											{t('settings.direct', 'Direct')}
										</span>
										<Switch
											checked={settingsForm.call_mode === 'group'}
											disabled={isSaving('contact')}
											onCheckedChange={(checked) => {
												const nextMode: 'driver' | 'group' =
													checked ? 'group' : 'driver';
												setSettingsForm((s) => ({ ...s, call_mode: nextMode }));
												void saveCallModeOnly(nextMode);
											}}
											aria-label='Switch call mode'
										/>
										<span
											className={`text-xs font-medium ${settingsForm.call_mode === 'group' ? 'text-[#1E3A5F]' : 'text-slate-500'}`}
										>
											{t('settings.group', 'Group')}
										</span>
									</div>
								</div>
							</div>

							<div className='text-sm text-muted-foreground'>
								{t(
									'settings.contact_help',
									'Drivers and passengers can call these group numbers.',
								)}
							</div>
							{groupPhoneNumbers.map((phone, idx) => (
								<div
									key={`group-phone-${idx}`}
									className='grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_auto]'
								>
									<Input
										placeholder='+95...'
										value={phone}
										onChange={(e) => updateGroupPhoneAt(idx, e.target.value)}
									/>
									<Button
										type='button'
										variant='ghost'
										size='icon'
										title={t('settings.remove_number', 'Remove number')}
										onClick={() => removeGroupPhone(idx)}
									>
										<Trash2 className='h-4 w-4 text-red-500' />
									</Button>
								</div>
							))}
							<div className='flex flex-wrap justify-end gap-2'>
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={addGroupPhone}
								>
									<Plus className='mr-1 h-4 w-4' />
									{t('settings.add_number', 'Add Number')}
								</Button>
								<Button
									type='button'
									size='sm'
									onClick={saveContactSettings}
									disabled={isSaving('contact')}
								>
									{isSaving('contact') ?
										t('common.saving', 'Saving...')
									:	t('settings.save_contact', 'Save Contact')}
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className='text-base'>
								{t('settings.wallet_guard', 'Driver Wallet Online Guard')}
							</CardTitle>
						</CardHeader>
						<CardContent className='space-y-3'>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
								<SettingField
									label={t(
										'settings.field.wallet_online_min_balance.label',
										'Wallet Online Min Balance',
									)}
									keyLabel='WALLET_ONLINE_MIN_BALANCE'
									description={t(
										'settings.field.wallet_online_min_balance.desc',
										'Minimum balance required for a driver to go online. If current mode balance is below this value, online status is blocked.',
									)}
									value={settingsForm.wallet_online_min_balance}
									onChange={(v) =>
										setSettingsForm((s) => ({
											...s,
											wallet_online_min_balance: v,
										}))
									}
									type='number'
									step='0.01'
								/>
								<div className='rounded-md border bg-white px-3 py-2 space-y-1'>
									<div className='space-y-0.5'>
										<div className='text-sm font-semibold text-slate-700'>
											{t(
												'settings.field.wallet_online_mode.label',
												'Wallet Online Balance Mode',
											)}
										</div>
										<div className='text-[11px] font-mono tracking-wide text-slate-400'>
											WALLET_ONLINE_MODE
										</div>
									</div>
									<Select
										value={settingsForm.wallet_online_mode}
										onValueChange={(v: 'combined' | 'ordinary' | 'promo') =>
											setSettingsForm((s) => ({ ...s, wallet_online_mode: v }))
										}
									>
										<SelectTrigger>
											<SelectValue
												placeholder={t(
													'settings.wallet_guard_mode',
													'Select balance mode',
												)}
											/>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='combined'>
												{t(
													'settings.wallet_guard_combined',
													'Combined (ordinary + promo)',
												)}
											</SelectItem>
											<SelectItem value='ordinary'>
												{t('settings.wallet_guard_ordinary', 'Ordinary only')}
											</SelectItem>
											<SelectItem value='promo'>
												{t('settings.wallet_guard_promo', 'Promo only')}
											</SelectItem>
										</SelectContent>
									</Select>
									<div className='text-xs text-muted-foreground leading-relaxed'>
										{settingsForm.wallet_online_mode === 'ordinary' ?
											t(
												'settings.field.wallet_online_mode.desc_ordinary',
												'Only ordinary wallet balance is checked.',
											)
										: settingsForm.wallet_online_mode === 'promo' ?
											t(
												'settings.field.wallet_online_mode.desc_promo',
												'Only promo wallet balance is checked.',
											)
										:	t(
												'settings.field.wallet_online_mode.desc_combined',
												'Ordinary + promo total balance is checked.',
											)
										}
									</div>
								</div>
							</div>
							<div className='flex justify-end'>
								<Button
									type='button'
									size='sm'
									onClick={saveWalletGuardSettings}
									disabled={isSaving('wallet_guard')}
								>
									{isSaving('wallet_guard') ?
										t('common.saving', 'Saving...')
									:	t('settings.save_wallet_guard', 'Save Wallet Guard')}
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className='text-base'>
								{t('settings.base', 'Base Settings')}
							</CardTitle>
						</CardHeader>
						<CardContent className='grid grid-cols-1 md:grid-cols-2 gap-3'>
							<SettingField
								label={t('settings.field.fare_base.label', 'Fare Base')}
								keyLabel='FARE_BASE'
								description={t(
									'settings.field.fare_base.desc',
									'Fallback fixed base charge added at trip start when no time-interval override applies.',
								)}
								value={settingsForm.fare_base}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, fare_base: v }))
								}
								type='number'
								step='0.01'
							/>
							<SettingField
								label={t('settings.field.fare_per_km.label', 'Fare Per KM')}
								keyLabel='FARE_PER_KM'
								description={t(
									'settings.field.fare_per_km.desc',
									'Distance charge per kilometer when no time-interval per-km override applies.',
								)}
								value={settingsForm.fare_per_km}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, fare_per_km: v }))
								}
								type='number'
								step='0.01'
							/>
							<SettingField
								label={t(
									'settings.field.fare_per_min.label',
									'Fare Per Minute',
								)}
								keyLabel='FARE_PER_MIN'
								description={t(
									'settings.field.fare_per_min.desc',
									'Time-based charge added per trip minute while the ride is in progress.',
								)}
								value={settingsForm.fare_per_min}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, fare_per_min: v }))
								}
								type='number'
								step='0.01'
							/>
							<SettingField
								label={t('settings.field.fare_min.label', 'Minimum Fare')}
								keyLabel='FARE_MIN'
								description={t(
									'settings.field.fare_min.desc',
									'Minimum final fare floor applied after fare calculation completes.',
								)}
								value={settingsForm.fare_min}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, fare_min: v }))
								}
								type='number'
								step='0.01'
							/>
							<SettingField
								label={t('settings.field.fare_ccy.label', 'Fare Currency')}
								keyLabel='FARE_CCY'
								description={t(
									'settings.field.fare_ccy.desc',
									'Currency label shown in fare UI and reports, for example Ks or MMK.',
								)}
								value={settingsForm.fare_ccy}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, fare_ccy: v }))
								}
							/>
							<SettingField
								label={t(
									'settings.field.fare_traffic_mult.label',
									'Traffic Multiplier',
								)}
								keyLabel='FARE_TRAFFIC_MULT'
								description={t(
									'settings.field.fare_traffic_mult.desc',
									'Multiplier applied on fare during traffic conditions. Use 1.00 for no traffic adjustment.',
								)}
								value={settingsForm.fare_traffic_mult}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, fare_traffic_mult: v }))
								}
								type='number'
								step='0.01'
							/>
							<SettingField
								label={t(
									'settings.field.fare_extra_dropoff.label',
									'Extra Drop-off Charge',
								)}
								keyLabel='FARE_EXTRA_DROPOFF'
								description={t(
									'settings.field.fare_extra_dropoff.desc',
									'Charge added per additional drop-off point after the first drop-off.',
								)}
								value={settingsForm.fare_extra_dropoff}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, fare_extra_dropoff: v }))
								}
								type='number'
								step='0.01'
							/>
							<SettingField
								label={t(
									'settings.field.wait_free_min.label',
									'Free Wait Minutes',
								)}
								keyLabel='WAIT_FREE_MIN'
								description={t(
									'settings.field.wait_free_min.desc',
									'Number of free waiting minutes before waiting charges start.',
								)}
								value={settingsForm.wait_free_min}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, wait_free_min: v }))
								}
								type='number'
								step='1'
							/>
							<SettingField
								label={t(
									'settings.field.wait_per_min.label',
									'Wait Charge Per Minute',
								)}
								keyLabel='WAIT_PER_MIN'
								description={t(
									'settings.field.wait_per_min.desc',
									'Waiting fee charged per minute after free waiting minutes are used.',
								)}
								value={settingsForm.wait_per_min}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, wait_per_min: v }))
								}
								type='number'
								step='0.01'
							/>
							<div className='flex justify-end md:col-span-2'>
								<Button
									type='button'
									size='sm'
									onClick={saveBaseSettings}
									disabled={isSaving('base')}
								>
									{isSaving('base') ?
										t('common.saving', 'Saving...')
									:	t('settings.save_base', 'Save Base')}
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className='text-base'>
								{t('settings.discovery', 'Passenger Driver Discovery')}
							</CardTitle>
						</CardHeader>
						<CardContent className='grid grid-cols-1 md:grid-cols-2 gap-3'>
							<SettingField
								label={t(
									'settings.field.passenger_driver_limit.label',
									'Passenger Driver Limit',
								)}
								keyLabel='PASSENGER_DRIVER_LIMIT'
								description={t(
									'settings.field.passenger_driver_limit.desc',
									'Maximum nearest drivers to include for this group when Passenger or TMS starts dispatch (0 means no limit).',
								)}
								value={settingsForm.passenger_driver_limit}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, passenger_driver_limit: v }))
								}
								type='number'
								step='1'
							/>
							<SettingField
								label={t(
									'settings.field.passenger_driver_radius_km.label',
									'Passenger Driver Radius (KM)',
								)}
								keyLabel='PASSENGER_DRIVER_RADIUS_KM'
								description={t(
									'settings.field.passenger_driver_radius_km.desc',
									'Search radius in kilometers for eligible drivers in this group for both Passenger and TMS.',
								)}
								value={settingsForm.passenger_driver_radius_km}
								onChange={(v) =>
									setSettingsForm((s) => ({
										...s,
										passenger_driver_radius_km: v,
									}))
								}
								type='number'
								step='0.1'
							/>
							<SettingField
								label={t(
									'settings.field.offer_ttl_seconds.label',
									'Offer TTL (Seconds)',
								)}
								keyLabel='OFFER_TTL_SECONDS'
								description={t(
									'settings.field.offer_ttl_seconds.desc',
									'How long each driver offer stays active before expiring and moving to the next driver.',
								)}
								value={settingsForm.offer_ttl_seconds}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, offer_ttl_seconds: v }))
								}
								type='number'
								step='1'
							/>
							<SettingField
								label={t(
									'settings.field.driver_scan_band_km.label',
									'Driver Scan Band (KM)',
								)}
								keyLabel='DRIVER_SCAN_BAND_KM'
								description={t(
									'settings.field.driver_scan_band_km.desc',
									'Re-rank nearby drivers by reachability within each distance band. Smaller band keeps nearest ordering stricter.',
								)}
								value={settingsForm.driver_scan_band_km}
								onChange={(v) =>
									setSettingsForm((s) => ({ ...s, driver_scan_band_km: v }))
								}
								type='number'
								step='0.1'
							/>
							<div className='rounded-md border bg-white px-3 py-2 space-y-2'>
								<div className='space-y-0.5'>
									<div className='text-sm font-semibold text-slate-700'>
										{t(
											'settings.field.allow_schedule_trip.label',
											'Allow Schedule Trip',
										)}
									</div>
									<div className='text-[11px] font-mono tracking-wide text-slate-400'>
										ALLOW_SCHEDULE_TRIP
									</div>
								</div>
								<div className='flex items-center gap-3'>
									<span
										className={`text-xs font-medium ${settingsForm.allow_schedule_trip ? 'text-slate-500' : 'text-[#1E3A5F]'}`}
									>
										{t('settings.disabled', 'Disabled')}
									</span>
									<Switch
										checked={settingsForm.allow_schedule_trip}
										onCheckedChange={(checked) =>
											setSettingsForm((s) => ({
												...s,
												allow_schedule_trip: checked,
											}))
										}
									/>
									<span
										className={`text-xs font-medium ${settingsForm.allow_schedule_trip ? 'text-[#1E3A5F]' : 'text-slate-500'}`}
									>
										{t('settings.enabled', 'Enabled')}
									</span>
								</div>
								<div className='text-xs text-muted-foreground leading-relaxed'>
									{t(
										'settings.field.allow_schedule_trip.desc',
										'Enable or disable Ride Later / scheduled trip option in Passenger app and TMS order flow for this group.',
									)}
								</div>
							</div>
							{settingsForm.allow_schedule_trip ?
								<SettingField
									label={t(
										'settings.field.schedule_min_lead_hours.label',
										'Schedule Min Lead Hours',
									)}
									keyLabel='SCHEDULE_MIN_LEAD_HOURS'
									description={t(
										'settings.field.schedule_min_lead_hours.desc',
										'Minimum hours from now before users can choose a scheduled pickup time.',
									)}
									value={settingsForm.schedule_min_lead_hours}
									onChange={(v) =>
										setSettingsForm((s) => ({
											...s,
											schedule_min_lead_hours: v,
										}))
									}
									type='number'
									step='1'
								/>
							:	null}
							<div className='rounded-md border bg-white px-3 py-2 space-y-2'>
								<div className='space-y-0.5'>
									<div className='text-sm font-semibold text-slate-700'>
										{t(
											'settings.field.allow_post_accept_dropoff_change.label',
											'Allow Post-Accept Drop-off Change',
										)}
									</div>
									<div className='text-[11px] font-mono tracking-wide text-slate-400'>
										ALLOW_POST_ACCEPT_DROPOFF_CHANGE
									</div>
								</div>
								<div className='flex items-center gap-3'>
									<span
										className={`text-xs font-medium ${
											settingsForm.allow_post_accept_dropoff_change ?
												'text-slate-500'
											:	'text-[#1E3A5F]'
										}`}
									>
										{t('settings.disabled', 'Disabled')}
									</span>
									<Switch
										checked={settingsForm.allow_post_accept_dropoff_change}
										onCheckedChange={(checked) =>
											setSettingsForm((s) => ({
												...s,
												allow_post_accept_dropoff_change: checked,
											}))
										}
									/>
									<span
										className={`text-xs font-medium ${
											settingsForm.allow_post_accept_dropoff_change ?
												'text-[#1E3A5F]'
											:	'text-slate-500'
										}`}
									>
										{t('settings.enabled', 'Enabled')}
									</span>
								</div>
								<div className='text-xs text-muted-foreground leading-relaxed'>
									{t(
										'settings.field.allow_post_accept_dropoff_change.desc',
										'Allow passengers to request drop-off changes after trip is accepted. Driver approval is still required.',
									)}
								</div>
							</div>
							{settingsForm.allow_post_accept_dropoff_change ?
								<SettingField
									label={t(
										'settings.field.post_accept_dropoff_change_surcharge.label',
										'Drop-off Change Surcharge',
									)}
									keyLabel='POST_ACCEPT_DROPOFF_CHANGE_SURCHARGE'
									description={t(
										'settings.field.post_accept_dropoff_change_surcharge.desc',
										'Extra fee charged per add/edit/remove drop-off unit after booking acceptance.',
									)}
									value={settingsForm.post_accept_dropoff_change_surcharge}
									onChange={(v) =>
										setSettingsForm((s) => ({
											...s,
											post_accept_dropoff_change_surcharge: v,
										}))
									}
									type='number'
									step='0.01'
								/>
							:	null}
							<div className='flex justify-end md:col-span-2'>
								<Button
									type='button'
									size='sm'
									onClick={saveDiscoverySettings}
									disabled={isSaving('discovery')}
								>
									{isSaving('discovery') ?
										t('common.saving', 'Saving...')
									:	t('settings.save_discovery', 'Save Discovery')}
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className='text-base'>
								{t('settings.commission_items', 'Commission Plans')}
							</CardTitle>
						</CardHeader>
						<CardContent className='space-y-3'>
							<div className='grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.3fr_1.7fr_1fr_1fr_auto_auto]'>
								<Input
									placeholder={t('settings.commission_item.name', 'Plan name')}
									value={newCommissionItem.name}
									onChange={(e) =>
										setNewCommissionItem((prev) => ({
											...prev,
											name: e.target.value,
										}))
									}
								/>
								<Input
									placeholder={t(
										'settings.commission_item.description',
										'Description',
									)}
									value={newCommissionItem.description}
									onChange={(e) =>
										setNewCommissionItem((prev) => ({
											...prev,
											description: e.target.value,
										}))
									}
								/>
								<Select
									value={newCommissionItem.commission_type}
									onValueChange={(value: 'percentage' | 'fare_range') => {
										setNewCommissionItem((prev) => ({
											...prev,
											commission_type: value,
										}));
										if (value !== 'fare_range') {
											setNewCommissionRangesOpen(false);
										}
									}}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='percentage'>
											{t('settings.percentage', 'Percentage')}
										</SelectItem>
										<SelectItem value='fare_range'>
											{t('settings.fare_range_fixed', 'Fare Range Fixed')}
										</SelectItem>
									</SelectContent>
								</Select>
								{newCommissionItem.commission_type === 'percentage' ?
									<Input
										type='number'
										step='0.01'
										placeholder={t(
											'settings.field.commission_rate.label',
											'Commission Rate',
										)}
										value={newCommissionItem.commission_rate}
										onChange={(e) =>
											setNewCommissionItem((prev) => ({
												...prev,
												commission_rate: e.target.value,
											}))
										}
									/>
								:	<div className='rounded-md border bg-white  px-2 py-2 text-xs text-muted-foreground'>
										{t(
											'settings.commission_item.set_ranges',
											'Set fare ranges below',
										)}
									</div>
								}
								<div className='flex items-center gap-2 rounded-md border bg-white px-2 py-1'>
									<span className='mr-2 text-[11px] text-muted-foreground'>
										{t(
											'settings.commission_item.driver_to_driver',
											'Driver order',
										)}
									</span>
									<Switch
										checked={newCommissionItem.driver_to_driver_commission}
										onCheckedChange={(checked) =>
											setNewCommissionItem((prev) => ({
												...prev,
												driver_to_driver_commission: checked,
											}))
										}
									/>
								</div>
								<Button
									type='button'
									size='sm'
									onClick={addCommissionItem}
									disabled={isCommissionItemBusy('create')}
								>
									{isCommissionItemBusy('create') ?
										t('common.saving', 'Saving...')
									:	t('settings.commission_item.add', 'Add')}
								</Button>
							</div>

							{newCommissionItem.commission_type === 'fare_range' ?
								<div className='rounded-md border border-slate-200 bg-white'>
									<button
										type='button'
										className='flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50'
										onClick={() => setNewCommissionRangesOpen((prev) => !prev)}
									>
										<span>
											{t(
												'settings.commission_item.range_settings',
												'Fare Range Settings',
											)}
										</span>
										{newCommissionRangesOpen ?
											<ChevronDown className='h-4 w-4 text-slate-500' />
										:	<ChevronRight className='h-4 w-4 text-slate-500' />}
									</button>
									{newCommissionRangesOpen ?
										<div className='space-y-2 border-t border-slate-200 p-3'>
											<div className='flex flex-wrap gap-2 justify-end'>
												<Button
													type='button'
													variant='outline'
													size='sm'
													onClick={applyDefaultNewCommissionRanges}
												>
													{t('settings.use_default', 'Use Default')}
												</Button>
												<Button
													type='button'
													variant='outline'
													size='sm'
													onClick={addNewCommissionRangeRow}
												>
													<Plus className='mr-1 h-4 w-4' />
													{t('settings.add_range', 'Add Range')}
												</Button>
											</div>
											{newCommissionRangesForm.map((row, idx) => (
												<div
													key={row.id}
													className='grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto]'
												>
													<Input
														type='number'
														step='0.01'
														placeholder={t(
															'settings.range.from_fare',
															'From fare',
														)}
														value={row.from_fare}
														onChange={(e) =>
															updateNewCommissionRangeRow(idx, {
																from_fare: e.target.value,
															})
														}
													/>
													<Input
														type='number'
														step='0.01'
														placeholder={t(
															'settings.range.to_fare_open',
															'To fare (empty = open ended)',
														)}
														value={row.to_fare}
														onChange={(e) =>
															updateNewCommissionRangeRow(idx, {
																to_fare: e.target.value,
															})
														}
													/>
													<Input
														type='number'
														step='0.01'
														placeholder={t(
															'settings.range.commission_amount',
															'Commission amount',
														)}
														value={row.commission_amount}
														onChange={(e) =>
															updateNewCommissionRangeRow(idx, {
																commission_amount: e.target.value,
															})
														}
													/>
													<Button
														type='button'
														variant='ghost'
														size='icon'
														title={t('settings.delete_range', 'Delete range')}
														onClick={() => removeNewCommissionRangeRow(idx)}
													>
														<Trash2 className='h-4 w-4 text-red-500' />
													</Button>
												</div>
											))}
										</div>
									:	null}
								</div>
							:	null}

							{commissionItemsLoading ?
								<div className='rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-muted-foreground'>
									{t('common.loading', 'Loading...')}
								</div>
							:	null}

							{commissionItems.map((item) => (
								<div
									key={item.id}
									className={`rounded-md border p-3 space-y-2 ${
										item.is_default ?
											'border-blue-300 bg-blue-50/40 dark:border-blue-600 dark:bg-blue-600/40'
										:	'border-slate-200 bg-white'
									}`}
								>
									<div className='grid grid-cols-1 gap-2 md:grid-cols-[1.4fr_1.8fr_1fr_1fr_auto]'>
										<Input
											value={item.name}
											onChange={(e) =>
												updateCommissionItemRow(item.id, {
													name: e.target.value,
												})
											}
										/>
										<Input
											value={item.description}
											onChange={(e) =>
												updateCommissionItemRow(item.id, {
													description: e.target.value,
												})
											}
										/>
										<Select
											value={item.commission_type}
											onValueChange={(value: 'percentage' | 'fare_range') => {
												updateCommissionItemRow(item.id, {
													commission_type: value,
												});
												if (value !== 'fare_range') {
													setCommissionItemRangesOpenById((prev) => ({
														...prev,
														[item.id]: false,
													}));
												}
											}}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='percentage'>
													{t('settings.percentage', 'Percentage')}
												</SelectItem>
												<SelectItem value='fare_range'>
													{t('settings.fare_range_fixed', 'Fare Range Fixed')}
												</SelectItem>
											</SelectContent>
										</Select>
										{item.commission_type === 'percentage' ?
											<Input
												type='number'
												step='0.01'
												value={item.commission_rate}
												onChange={(e) =>
													updateCommissionItemRow(item.id, {
														commission_rate: e.target.value,
													})
												}
											/>
										:	<div className='rounded-md border bg-slate-50 px-2 py-2 text-xs text-muted-foreground'>
												{t(
													'settings.commission_item.set_ranges',
													'Set fare ranges below',
												)}
											</div>
										}
										<div className='flex items-center justify-end gap-1'>
											{!item.is_default ?
												<Button
													type='button'
													variant='outline'
													size='sm'
													onClick={() => setCommissionItemAsDefault(item.id)}
													disabled={isCommissionItemBusy('default', item.id)}
												>
													{isCommissionItemBusy('default', item.id) ?
														t('common.saving', 'Saving...')
													:	t(
															'settings.commission_item.set_default',
															'Set Default',
														)
													}
												</Button>
											:	<span className='rounded-full border border-blue-300 bg-blue-100 px-2 py-1 text-[11px] font-medium text-blue-700'>
													{t('settings.commission_item.default', 'Default')}
												</span>
											}
											<div className='flex items-center gap-1 rounded-md border bg-white px-2 py-1'>
												<span className='text-xs text-muted-foreground'>
													{t('settings.commission_item.active', 'Active')}
												</span>
												<Switch
													checked={item.is_active}
													onCheckedChange={(checked) =>
														updateCommissionItemRow(item.id, {
															is_active: checked,
														})
													}
												/>
											</div>
											<div className='flex items-center gap-1 rounded-md border bg-white px-2 py-1'>
												<span className='text-xs text-muted-foreground'>
													{t(
														'settings.commission_item.driver_to_driver',
														'Driver order',
													)}
												</span>
												<Switch
													checked={item.driver_to_driver_commission}
													onCheckedChange={(checked) =>
														updateCommissionItemRow(item.id, {
															driver_to_driver_commission: checked,
														})
													}
												/>
											</div>
											<Button
												type='button'
												size='sm'
												onClick={() => saveCommissionItemRow(item)}
												disabled={isCommissionItemBusy('save', item.id)}
											>
												{isCommissionItemBusy('save', item.id) ?
													t('common.saving', 'Saving...')
												:	t('common.save', 'Save')}
											</Button>
											<Button
												type='button'
												variant='ghost'
												size='icon'
												onClick={() => deleteCommissionItem(item.id)}
												disabled={isCommissionItemBusy('delete', item.id)}
												title={t('common.delete', 'Delete')}
											>
												<Trash2 className='h-4 w-4 text-red-500' />
											</Button>
										</div>
									</div>

									{item.commission_type === 'fare_range' ?
										<div className='rounded-md border border-slate-200 bg-white'>
											<button
												type='button'
												className='flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50'
												onClick={() => toggleCommissionItemRangesOpen(item.id)}
											>
												<span>
													{t(
														'settings.commission_item.range_settings',
														'Fare Range Settings',
													)}
												</span>
												{isCommissionItemRangesOpen(item.id) ?
													<ChevronDown className='h-4 w-4 text-slate-500' />
												:	<ChevronRight className='h-4 w-4 text-slate-500' />}
											</button>
											{isCommissionItemRangesOpen(item.id) ?
												<div className='space-y-2 border-t border-slate-200 p-3'>
													<div className='flex flex-wrap gap-2 justify-end'>
														<Button
															type='button'
															variant='outline'
															size='sm'
															onClick={() =>
																applyDefaultCommissionItemRanges(item.id)
															}
														>
															{t('settings.use_default', 'Use Default')}
														</Button>
														<Button
															type='button'
															variant='outline'
															size='sm'
															onClick={() => addCommissionItemRangeRow(item.id)}
														>
															<Plus className='mr-1 h-4 w-4' />
															{t('settings.add_range', 'Add Range')}
														</Button>
													</div>
													{(item.commission_ranges || []).map((row, idx) => (
														<div
															key={row.id}
															className='grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto]'
														>
															<Input
																type='number'
																step='0.01'
																placeholder={t(
																	'settings.range.from_fare',
																	'From fare',
																)}
																value={row.from_fare}
																onChange={(e) =>
																	updateCommissionItemRangeRow(item.id, idx, {
																		from_fare: e.target.value,
																	})
																}
															/>
															<Input
																type='number'
																step='0.01'
																placeholder={t(
																	'settings.range.to_fare_open',
																	'To fare (empty = open ended)',
																)}
																value={row.to_fare}
																onChange={(e) =>
																	updateCommissionItemRangeRow(item.id, idx, {
																		to_fare: e.target.value,
																	})
																}
															/>
															<Input
																type='number'
																step='0.01'
																placeholder={t(
																	'settings.range.commission_amount',
																	'Commission amount',
																)}
																value={row.commission_amount}
																onChange={(e) =>
																	updateCommissionItemRangeRow(item.id, idx, {
																		commission_amount: e.target.value,
																	})
																}
															/>
															<Button
																type='button'
																variant='ghost'
																size='icon'
																title={t(
																	'settings.delete_range',
																	'Delete range',
																)}
																onClick={() =>
																	removeCommissionItemRangeRow(item.id, idx)
																}
															>
																<Trash2 className='h-4 w-4 text-red-500' />
															</Button>
														</div>
													))}
												</div>
											:	null}
										</div>
									:	null}

									<div className='text-[11px] text-muted-foreground'>
										{t(
											'settings.commission_item.assigned_drivers',
											'Assigned drivers',
										)}
										: {item.assigned_driver_count}
										{item.driver_to_driver_commission ?
											<span className='ml-2 rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700'>
												{t(
													'settings.commission_item.driver_to_driver_tag',
													'Driver Order Plan',
												)}
											</span>
										:	null}
									</div>
								</div>
							))}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className='text-base'>
								{t('settings.fare_base_interval', 'Fare Base By Time Interval')}
							</CardTitle>
						</CardHeader>
						<CardContent className='space-y-3'>
							<div className='flex flex-wrap gap-2 justify-end'>
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={applyDefaultScheduleToAllDays}
								>
									{t('settings.use_default_all_days', 'Use Default (All Days)')}
								</Button>
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={() => copyDayToAllDays(activeScheduleDay)}
								>
									{DAY_LABELS[activeScheduleDay]}{' '}
									{t('settings.copy_day_to_all', 'Copy to All')}
								</Button>
							</div>
							<div className='flex flex-wrap gap-2'>
								{DAY_KEYS.map((day) => (
									<button
										key={day}
										type='button'
										className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${activeScheduleDay === day ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
										onClick={() => setActiveScheduleDay(day)}
									>
										{DAY_LABELS[day]}
									</button>
								))}
							</div>
							{(fareBaseScheduleForm[activeScheduleDay] || []).map(
								(row, idx) => (
									<div
										key={row.id}
										className='grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto]'
									>
										<Input
											value={row.name}
											placeholder={t('settings.interval_name', 'Interval name')}
											onChange={(e) =>
												updateScheduleRow(activeScheduleDay, idx, {
													name: e.target.value,
												})
											}
										/>
										<Input
											type='time'
											value={row.start}
											onChange={(e) =>
												updateScheduleRow(activeScheduleDay, idx, {
													start: e.target.value,
												})
											}
										/>
										<Input
											type='time'
											value={row.end}
											onChange={(e) =>
												updateScheduleRow(activeScheduleDay, idx, {
													end: e.target.value,
												})
											}
										/>
										<Input
											type='number'
											step='0.01'
											value={row.fare_base}
											onChange={(e) =>
												updateScheduleRow(activeScheduleDay, idx, {
													fare_base: e.target.value,
												})
											}
										/>
										<Button
											type='button'
											variant='ghost'
											size='icon'
											title={t('settings.delete_interval', 'Delete interval')}
											onClick={() => removeScheduleRow(activeScheduleDay, idx)}
										>
											<Trash2 className='h-4 w-4 text-red-500' />
										</Button>
									</div>
								),
							)}
							<div className='flex flex-wrap justify-end gap-2'>
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={() => addScheduleRow(activeScheduleDay)}
								>
									<Plus className='mr-1 h-4 w-4' />
									{t('settings.add_interval', 'Add Interval')}
								</Button>
								<Button
									type='button'
									size='sm'
									onClick={saveFareBaseSchedule}
									disabled={isSaving('fare_base_schedule')}
								>
									{isSaving('fare_base_schedule') ?
										t('common.saving', 'Saving...')
									:	t('settings.save_base_schedule', 'Save Base Schedule')}
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className='text-base'>
								{t(
									'settings.fare_per_km_interval',
									'Fare Per KM By Time Interval',
								)}
							</CardTitle>
						</CardHeader>
						<CardContent className='space-y-3'>
							<div className='flex flex-wrap gap-2 justify-end'>
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={applyDefaultPerKmScheduleToAllDays}
								>
									{t('settings.use_default_all_days', 'Use Default (All Days)')}
								</Button>
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={() => copyPerKmDayToAllDays(activeScheduleDay)}
								>
									{DAY_LABELS[activeScheduleDay]}{' '}
									{t('settings.copy_day_to_all', 'Copy to All')}
								</Button>
							</div>
							<div className='flex flex-wrap gap-2'>
								{DAY_KEYS.map((day) => (
									<button
										key={`perkm-${day}`}
										type='button'
										className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${activeScheduleDay === day ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
										onClick={() => setActiveScheduleDay(day)}
									>
										{DAY_LABELS[day]}
									</button>
								))}
							</div>
							{(farePerKmScheduleForm[activeScheduleDay] || []).map(
								(row, idx) => (
									<div
										key={row.id}
										className='grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto]'
									>
										<Input
											value={row.name}
											placeholder={t('settings.interval_name', 'Interval name')}
											onChange={(e) =>
												updatePerKmScheduleRow(activeScheduleDay, idx, {
													name: e.target.value,
												})
											}
										/>
										<Input
											type='time'
											value={row.start}
											onChange={(e) =>
												updatePerKmScheduleRow(activeScheduleDay, idx, {
													start: e.target.value,
												})
											}
										/>
										<Input
											type='time'
											value={row.end}
											onChange={(e) =>
												updatePerKmScheduleRow(activeScheduleDay, idx, {
													end: e.target.value,
												})
											}
										/>
										<Input
											type='number'
											step='0.01'
											value={row.fare_per_km}
											onChange={(e) =>
												updatePerKmScheduleRow(activeScheduleDay, idx, {
													fare_per_km: e.target.value,
												})
											}
										/>
										<Button
											type='button'
											variant='ghost'
											size='icon'
											title={t('settings.delete_interval', 'Delete interval')}
											onClick={() =>
												removePerKmScheduleRow(activeScheduleDay, idx)
											}
										>
											<Trash2 className='h-4 w-4 text-red-500' />
										</Button>
									</div>
								),
							)}
							<div className='flex flex-wrap justify-end gap-2'>
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={() => addPerKmScheduleRow(activeScheduleDay)}
								>
									<Plus className='mr-1 h-4 w-4' />
									{t('settings.add_interval', 'Add Interval')}
								</Button>
								<Button
									type='button'
									size='sm'
									onClick={saveFarePerKmSchedule}
									disabled={isSaving('fare_per_km_schedule')}
								>
									{isSaving('fare_per_km_schedule') ?
										t('common.saving', 'Saving...')
									:	t('settings.save_per_km_schedule', 'Save Per-KM Schedule')}
								</Button>
							</div>
						</CardContent>
					</Card>

					<div className='flex justify-end gap-2'>
						<Button
							variant='outline'
							onClick={loadSettings}
						>
							{t('settings.reload_all', 'Reload All')}
						</Button>
					</div>
				</>
			}
		</div>
	);
}

function SettingField({
	label,
	keyLabel,
	description,
	value,
	onChange,
	type = 'text',
	step,
}: {
	label: string;
	keyLabel?: string;
	description: string;
	value: string;
	onChange: (value: string) => void;
	type?: string;
	step?: string;
}) {
	return (
		<div className='rounded-md border bg-white px-3 py-2 space-y-1'>
			<div className='space-y-0.5'>
				<div className='text-sm font-semibold text-slate-700'>{label}</div>
				{keyLabel ?
					<div className='text-[11px] font-mono tracking-wide text-slate-400'>
						{keyLabel}
					</div>
				:	null}
			</div>
			<Input
				type={type}
				step={step}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
			<div className='text-xs text-muted-foreground leading-relaxed'>
				{description}
			</div>
		</div>
	);
}
