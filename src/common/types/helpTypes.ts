export type LessonNode = {
  type?: string;
  props?: Record<string, unknown>;
  children?: LessonNode[];
  content?: LessonNode[];
  [key: string]: unknown;
};

export type LessonBlock = {
  blockId?: number | string;
  content?: LessonNode[];
  [key: string]: unknown;
};

export type MediaRecord = {
  id: number;
  url: string;
  publicId?: string | null;
  title?: string | null;
  bankId: number;
};
