export type TelegramNotifyMode = "manager_only" | "manager_and_deputy";
export type WamanNoticeType = "distress" | "donors";

const unique = <T,>(items: T[]) => Array.from(new Set(items.filter(Boolean)));

export const getTelegramBotToken = (telegramConfig: any, botId?: string) => {
  if (!telegramConfig) return "";
  const botToken = telegramConfig.bots?.find((bot: any) => bot.id === botId)?.token;
  return botToken || telegramConfig.defaultBotToken || "";
};

export const resolveRecipientChatIds = (telegramConfig: any, recipientIds: string[] = []) => {
  if (!telegramConfig?.people) return [];
  return unique(
    recipientIds
      .map((recipientId) => telegramConfig.people.find((person: any) => person.id === recipientId)?.chatId)
      .map((chatId) => (chatId ? String(chatId) : ""))
  );
};

export const getDepartmentLeadershipIds = (
  telegramConfig: any,
  deptId: string,
  mode: TelegramNotifyMode = "manager_and_deputy"
) => {
  const rule = telegramConfig?.rules?.departments?.[deptId];
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
  const rule = telegramConfig?.rules?.departments?.[deptId];
  const recipientIds = getDepartmentLeadershipIds(telegramConfig, deptId, mode);

  return {
    botToken: getTelegramBotToken(telegramConfig, rule?.botId),
    chatIds: resolveRecipientChatIds(telegramConfig, recipientIds)
  };
};

export const resolveVolunteerRoute = (telegramConfig: any, deptId: string) => {
  const volunteerRule = telegramConfig?.rules?.volunteers?.[deptId] || telegramConfig?.rules?.volunteers?.general;
  const explicitIds = volunteerRule?.recipientIds || [];
  const fallbackIds = getDepartmentLeadershipIds(telegramConfig, deptId, "manager_and_deputy");
  const departmentRule = telegramConfig?.rules?.departments?.[deptId];

  return {
    botToken: getTelegramBotToken(telegramConfig, volunteerRule?.botId || departmentRule?.botId),
    chatIds: resolveRecipientChatIds(telegramConfig, explicitIds.length ? explicitIds : fallbackIds)
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

export const sendTelegramToChatIds = (
  onSendTelegram: ((target: string, text: string, botToken?: string) => void) | undefined,
  chatIds: string[],
  message: string,
  botToken?: string
) => {
  if (!onSendTelegram || !botToken || chatIds.length === 0) return false;
  unique(chatIds).forEach((chatId) => onSendTelegram(chatId, message, botToken));
  return true;
};
