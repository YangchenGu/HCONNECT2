export const notificationDefaults = {
  channels: {
    email: true,
    sms: false,
    inApp: true,
  },
  priorities: {
    high: true,
    low: true,
  },
  digest: {
    enabled: true,
    frequency: "Daily",
  },
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "07:00",
  },
};

export const notificationOptions = {
  digestFrequencies: ["Off", "Daily", "Weekly"],
};
