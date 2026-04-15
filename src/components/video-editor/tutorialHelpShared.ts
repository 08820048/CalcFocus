import { toast } from "sonner";

export const CALCFOCUS_WEBSITE_URL = "https://calcfocus.cc";
export const CALCFOCUS_ISSUES_URL = "https://github.com/08820048/CalcFocus_Pro/issues";
export const CALCFOCUS_QQ_URL = "https://qm.qq.com/q/KQHPN90Yg0";
const CONTACT_CHANNEL_NOT_CONFIGURED = "This contact channel is not configured yet.";

export const APP_HEADER_ACTION_BUTTON_CLASS =
	"h-7 px-2 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all gap-1.5";
export const APP_HEADER_ICON_BUTTON_CLASS =
	"h-7 w-7 p-0 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all";

export async function openExternalLink(url: string, errorMessage: string) {
	if (!url) {
		toast.info(CONTACT_CHANNEL_NOT_CONFIGURED);
		return;
	}

	try {
		const result = await window.electronAPI.openExternalUrl(url);
		if (!result.success) {
			toast.error(result.error || errorMessage);
		}
	} catch (error) {
		toast.error(`${errorMessage} ${String(error)}`);
	}
}
