/**
 * 会員限定（レベルごとに順に開けていく。WordPress の「ユーザーアクセス」の置き換え）
 *
 * - 固定ページの項目「会員レベル」（member_level。"0"〜"6"、空なら誰でも見られる）
 * - コレクション「会員」（members）: タイトル＝メールアドレス、levels＝見られるレベル（複数選択）
 *   ※ 会員の一覧は公開しない（下書きのままでよい。ここでは状態に関係なくデータベースから直接読む）
 * - 会員は管理画面の「ユーザー → 招待」で「購読者（Subscriber）」として招待し、メールのリンクでログインしてもらう
 * - 編集者（Editor）以上は、すべてのページを見られる
 */
import { getDb } from "emdash/runtime";
import { sql } from "kysely";

export const LEVEL_FIELD = "member_level";

/** ページの会員レベル（なし＝誰でも見られる） */
export function pageLevel(data: any): number | null {
	const v = data?.[LEVEL_FIELD];
	if (v === null || v === undefined || v === "") return null;
	const n = Number(String(v).replace(/[^0-9]/g, ""));
	return Number.isFinite(n) ? n : null;
}

/** 会員が見られるレベルの一覧（会員の表にないときは空） */
export async function memberLevels(email: string | undefined | null): Promise<number[]> {
	if (!email) return [];
	try {
		const db = await getDb();
		const r = await sql<{ levels: string | null }>`SELECT levels FROM ec_members WHERE lower(trim(title)) = lower(trim(${email})) AND deleted_at IS NULL LIMIT 1`.execute(db);
		const raw = r.rows[0]?.levels;
		if (!raw) return [];
		let list: unknown = raw;
		try {
			list = JSON.parse(raw);
		} catch {}
		const arr = Array.isArray(list) ? list : String(list).split(/[,\s]+/);
		return arr.map((x) => Number(String(x).replace(/[^0-9]/g, ""))).filter((n) => Number.isFinite(n));
	} catch {
		return [];
	}
}

export type Access = { allowed: true } | { allowed: false; reason: "login" | "level"; level: number };

/** このページを今の人が見られるか */
export async function checkAccess(data: any, user: any): Promise<Access> {
	const level = pageLevel(data);
	if (level === null) return { allowed: true };
	if (!user) return { allowed: false, reason: "login", level };
	if (Number(user.role ?? 0) >= 40) return { allowed: true }; // 編集者・管理者
	const levels = await memberLevels(user.email);
	return levels.includes(level) ? { allowed: true } : { allowed: false, reason: "level", level };
}
