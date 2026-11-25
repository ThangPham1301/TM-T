export const supportTopics = {
  DELIVERY: "Đặt hàng và giao nhận",
  RETURNS: "Đổi trả và hoàn tiền",
  PRIVACY: "Quyền riêng tư và dữ liệu",
  OTHER: "Khác",
};

export const supportStatuses = {
  SUBMITTED: "Đã tiếp nhận",
  IN_REVIEW: "Đang xử lý",
  RESOLVED: "Đã phản hồi và đóng",
};

export type SupportTicket = {
  id: string;
  topic: keyof typeof supportTopics;
  status: keyof typeof supportStatuses;
  message: string;
  reply: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
