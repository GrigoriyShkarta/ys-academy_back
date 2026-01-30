export const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  birthDate: true,
  isActive: true,
  accessExpiryDate: true,
  subscriptions: true,
  notifications: true,
};

export const studentSelect = {
  id: true,
  name: true,
  email: true,
  city: true,
  userLessonAccesses: true,
  photo: true,
  telegram: true,
  instagram: true,
  birthDate: true,
  musicLevel: true,
  vocalExperience: true,
  goals: true,
  isActive: true,
  accessExpiryDate: true,
  notifications: true,
  subscriptions: {
    select: {
      id: true,
      paymentStatus: true,
      paymentDate: true,
      lessonDays: true,
      lessonDates: true,
      amount: true,
      createdAt: true,
      subscription: {
        select: {
          id: true,
          title: true,
          lessons_count: true,
          price: true,
        },
      },
      lessons: {
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          recordingUrl: true,
        },
      },
    },
  },
};
