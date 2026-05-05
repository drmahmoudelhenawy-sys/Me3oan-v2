export type TelegramNotifyMode = "manager_only" | "manager_and_deputy";
export type WamanNoticeType = "distress" | "donors";

const unique = <T,>(items: T[]) => Array.from(new Set(items.filter(Boolean)));
const envVolunteerBotToken = (import.meta as any).env?.VITE_TELEGRAM_VOLUNTEER_BOT_TOKEN || "";

const normalizeTelegramDeptId = (deptId: string = "") => {
  const value = String(deptId || "").trim();
  const lower = value.toLowerCase();

  if (!value) return "general";
  if (["edu", "education", "educational", "تعليمي", "التعليمي"].includes(lower) || value.includes("تعليم")) return "educational";
  if (["art", "design", "media"].includes(lower) || value.includes("فني") || value.includes("إخراج") || value.includes("اخراج")) return "art";
  if (["medical", "medicine", "med"].includes(lower) || value.includes("طبي")) return "medical";
  if (["dawah", "daawa", "دعوي", "دعوة"].includes(lower) || value.includes("دعوي") || value.includes("دعوة")) return "dawah";
  if (["charity", "خيرى", "خيري"].includes(lower) || value.includes("خيري") || value.includes("خيرى")) return "charity";
  if (["blood", "waman", "waman_ahyaaha", "ومن احياها", "ومن أحياها"].includes(lower) || value.includes("أحياها") || value.includes("احياها")) return "waman_ahyaaha";
  if (["hr", "human_resources", "resources"].includes(lower) || value.includes("الموارد")) return "hr";
  if (["management", "admin", "senior_management"].includes(lower) || value.includes("الإدارة") || value.includes("الادارة")) return "management";

  return value;
};

export const getTelegramBotToken = (telegramConfig: any, botId?: string) => {
  if (!telegramConfig) return "";
  const botToken = telegramConfig.bots?.find((bot: any) => bot.id === botId)?.token;
  return botToken || telegramConfig.defaultBotToken || "";
};

export const resolveRecipientChatIds = (telegramConfig: any, recipientIds: string[] = []) => {
  if (!telegramConfig?.people) return [];
  return unique(
    recipientIds
      .map((recipientId) => {
        const person = telegramConfig.people.find((p: any) => (
          p.chatId && (p.id === recipientId || p.uid === recipientId)
        ));
        return person?.chatId || (/^-?\d+$/.test(String(recipientId)) ? recipientId : "");
      })
      .map((chatId) => (chatId ? String(chatId) : ""))
  );
};

export const getDepartmentLeadershipIds = (
  telegramConfig: any,
  deptId: string,
  mode: TelegramNotifyMode = "manager_and_deputy"
) => {
  const normalizedDeptId = normalizeTelegramDeptId(deptId);
  const rule = telegramConfig?.rules?.departments?.[normalizedDeptId];
  if (!rule) return [];

  const deputyIds = Array.isArray(rule.deputyIds)
    ? rule.deputyIds
    : rule.deputyId
      ? [rule.deputyId]
      : [];

  return unique([
    rule.managerId,
    ...(mode === "manager_and_deputy" ? deputyIds : [])
  ]);
};

export const resolveDepartmentLeadership = (
  telegramConfig: any,
  deptId: string,
  mode: TelegramNotifyMode = "manager_and_deputy"
) => {
  const normalizedDeptId = normalizeTelegramDeptId(deptId);
  const rule = telegramConfig?.rules?.departments?.[normalizedDeptId];
  const recipientIds = getDepartmentLeadershipIds(telegramConfig, normalizedDeptId, mode);

  return {
    botToken: getTelegramBotToken(telegramConfig, rule?.botId),
    chatIds: resolveRecipientChatIds(telegramConfig, recipientIds)
  };
};

export const resolveVolunteerRoute = (telegramConfig: any, deptId: string) => {
  const normalizedDeptId = normalizeTelegramDeptId(deptId);
  const volunteerRule = telegramConfig?.rules?.volunteers?.[normalizedDeptId];
  const explicitIds = volunteerRule?.recipientIds || [];
  const recipientIds = explicitIds.length
    ? explicitIds
    : getDepartmentLeadershipIds(telegramConfig, normalizedDeptId, "manager_and_deputy");
  const departmentRule = telegramConfig?.rules?.departments?.[normalizedDeptId];
  const selectedBotId = volunteerRule?.botId || departmentRule?.botId;
  const selectedBotToken = selectedBotId
    ? telegramConfig?.bots?.find((bot: any) => bot.id === selectedBotId)?.token || ""
    : "";

  return {
    botToken: selectedBotToken || envVolunteerBotToken || telegramConfig?.defaultBotToken || "",
    chatIds: resolveRecipientChatIds(telegramConfig, recipientIds)
  };
};

export const resolveWamanRoute = (telegramConfig: any, noticeType: WamanNoticeType) => {
  const wamanRule = telegramConfig?.rules?.wamanAhyaaha?.[noticeType];
  const explicitIds = wamanRule?.recipientIds || [];
  const fallbackIds = getDepartmentLeadershipIds(telegramConfig, "waman_ahyaaha", "manager_and_deputy");
  const departmentRule = telegramConfig?.rules?.departments?.waman_ahyaaha;

  return {
    botToken: getTelegramBotToken(telegramConfig, wamanRule?.botId || departmentRule?.botId),
    chatIds: resolveRecipientChatIds(telegramConfig, explicitIds.length ? explicitIds : fallbackIds)
  };
};

export const resolveMeetingRoute = (telegramConfig: any) => {
  const meetingRule = telegramConfig?.rules?.meetings || {};
  const recipientIds = Array.isArray(meetingRule.attendanceRecipientIds)
    ? meetingRule.attendanceRecipientIds
    : (Array.isArray(meetingRule.recipientIds) ? meetingRule.recipientIds : []);

  return {
    botToken: getTelegramBotToken(telegramConfig, meetingRule.botId),
    chatIds: resolveRecipientChatIds(telegramConfig, recipientIds)
  };
};

export const resolveMeetingAnnouncementRoute = (telegramConfig: any) => {
  const meetingRule = telegramConfig?.rules?.meetings || {};
  const recipientIds = Array.isArray(meetingRule.announcementRecipientIds) ? meetingRule.announcementRecipientIds : [];

  return {
    botToken: getTelegramBotToken(telegramConfig, meetingRule.botId),
    chatIds: resolveRecipientChatIds(telegramConfig, recipientIds)
  };
};

export const sendTelegramToChatIds = (
  onSendTelegram: ((target: string, text: string, botToken?: string) => void) | undefined,
  chatIds: string[],
  message: string,
  botToken?: string
) => {
  if (!onSendTelegram || chatIds.length === 0) return false;
  unique(chatIds).forEach((chatId) => onSendTelegram(chatId, message, botToken));
  return true;
};
