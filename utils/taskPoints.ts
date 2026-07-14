import { collection, doc, getDoc, getDocs, increment, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../services/firebase";

export const TASK_COMPLETION_POINTS = 10;

type AwardTaskPointsInput = {
  requestId?: string | null;
  taskId?: string | null;
  fallbackUserId?: string | null;
  fallbackUserName?: string | null;
  taskTitle?: string | null;
};

const getAwardeeFrom = (...items: any[]) => {
  for (const item of items) {
    const userId = item?.deliveredBy || item?.lastDeliveredBy || item?.assignedTo || item?.completedBy;
    if (userId) {
      return {
        userId,
        userName: item?.deliveredByName || item?.lastDeliveredByName || item?.assignedToName || item?.completedByName || "مستخدم"
      };
    }
  }

  return { userId: "", userName: "" };
};

export const awardTaskCompletionPointsOnce = async ({
  requestId,
  taskId,
  fallbackUserId,
  fallbackUserName,
  taskTitle
}: AwardTaskPointsInput) => {
  const linkedTaskDocs = requestId
    ? (await getDocs(query(collection(db, "tasks"), where("linkedRequestId", "==", requestId)))).docs
    : [];

  const requestRef = requestId ? doc(db, "requests", requestId) : null;
  const taskRef = taskId ? doc(db, "tasks", taskId) : null;

  const requestSnap = requestRef ? await getDoc(requestRef) : null;
  const taskSnap = taskRef ? await getDoc(taskRef) : null;

  const requestData: any = requestSnap?.exists() ? requestSnap.data() : null;
  const taskData: any = taskSnap?.exists() ? taskSnap.data() : null;
  const linkedTasks = linkedTaskDocs.map((taskDoc) => ({ id: taskDoc.id, ref: taskDoc.ref, ...taskDoc.data() }));

  if (requestData?.pointsAwardedTo || taskData?.pointsAwardedTo || linkedTasks.some((task: any) => task.pointsAwardedTo)) {
    return false;
  }

  const awardee = getAwardeeFrom(requestData, taskData, ...linkedTasks);
  const userId = awardee.userId || fallbackUserId || "";
  const userName = awardee.userName || fallbackUserName || "مستخدم";

  if (!userId) return false;

  const title = taskTitle || requestData?.title || taskData?.title || linkedTasks[0]?.title || "مهمة بدون عنوان";
  const batch = writeBatch(db);

  batch.update(doc(db, "users", userId), {
    pointsTotal: increment(TASK_COMPLETION_POINTS),
    pointsFromTasks: increment(TASK_COMPLETION_POINTS),
    pointsUpdatedAt: serverTimestamp()
  });

  const pointFields = {
    pointsAwardedTo: userId,
    pointsAwardedToName: userName,
    pointsAwarded: TASK_COMPLETION_POINTS,
    pointsAwardedAt: serverTimestamp()
  };

  if (requestRef) batch.update(requestRef, pointFields);
  if (taskRef && !linkedTasks.some((task: any) => task.id === taskId)) batch.update(taskRef, pointFields);
  linkedTasks.forEach((task: any) => batch.update(task.ref, pointFields));

  batch.set(doc(collection(db, "points_logs")), {
    userId,
    userName,
    requestId: requestId || null,
    taskId: taskId || linkedTasks[0]?.id || null,
    taskTitle: title,
    points: TASK_COMPLETION_POINTS,
    type: "task_completed",
    reason: "اعتماد نهائي لمهمة",
    createdAt: serverTimestamp()
  });

  batch.set(doc(collection(db, "notifications")), {
    type: "task_points",
    userId,
    targetUserId: userId,
    requestId: requestId || null,
    taskId: taskId || linkedTasks[0]?.id || null,
    title: "نقاط جديدة من اعتماد مهمة",
    body: `+${TASK_COMPLETION_POINTS} نقطة لاعتماد مهمة: ${title}`,
    points: TASK_COMPLETION_POINTS,
    isRead: false,
    createdAt: serverTimestamp()
  });

  await batch.commit();
  return true;
};
